"""Verifica os arquivos do Git sem divulgar valores encontrados pelo scanner."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile


GITLEAKS_VERSION = "8.30.1"
TEMPLATES = {".env.example", ".env.sample", ".env.template"}
PRIVATE_DIRECTORIES = {".aws", ".ssh", ".azure", ".gcloud", ".next"}
PRIVATE_FILENAMES = {
    "credentials.json", ".netrc", ".npmrc", ".pypirc", "id_rsa", "id_ed25519",
}
PRIVATE_SUFFIXES = (
    ".pem", ".key", ".p12", ".pfx", ".backup", ".dump", ".bak",
    ".sql.gz", ".sql.zip", ".sqlite", ".sqlite3", ".db",
)


class SecurityCheckError(Exception):
    """Transporta apenas códigos de erro seguros para a saída pública."""


def path_violation(path):
    """Classifica caminhos proibidos sem abrir o conteúdo dos arquivos."""
    parts = PurePosixPath(path).parts
    if not parts or PurePosixPath(path).is_absolute() or ".." in parts or "\\" in path or ":" in path:
        return "unsafe-path"
    lowered = [part.lower() for part in parts]
    name = lowered[-1]
    if any(part in PRIVATE_DIRECTORIES for part in lowered):
        return "private-directory"
    if (name == ".env" or name.startswith(".env.")) and name not in TEMPLATES:
        return "environment-file"
    if name in PRIVATE_FILENAMES or name.endswith(PRIVATE_SUFFIXES):
        return "private-file"
    if name.endswith(".json") and any(
        marker in name for marker in ("service-account", "service_account", "firebase-adminsdk")
    ):
        return "service-credentials"
    return None


def run_git(root, *arguments):
    result = subprocess.run(
        ["git", "-C", str(root), *arguments], capture_output=True, check=False,
    )
    if result.returncode:
        raise SecurityCheckError("git-command-failed")
    return result.stdout


def repository_root():
    return Path(os.fsdecode(run_git(Path.cwd(), "rev-parse", "--show-toplevel")).strip()).resolve()


def repository_entries(root, staged):
    if not staged:
        paths = run_git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
        return [(os.fsdecode(path), None, None) for path in paths.split(b"\0") if path]

    entries = []
    for entry in run_git(root, "ls-files", "--stage", "-z").split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, object_id, stage = metadata.decode("ascii").split()
        if stage != "0":
            raise SecurityCheckError("unmerged-index")
        entries.append((os.fsdecode(path), mode, object_id))
    return entries


def source_path(root, relative):
    """Recusa links antes de resolver e ler caminhos da árvore de trabalho."""
    path = root
    for part in PurePosixPath(relative).parts:
        path = path / part
        if path.is_symlink():
            return None
    if not path.resolve().is_relative_to(root):
        return None
    return path


def create_snapshot(root, snapshot, staged):
    findings = []
    included = set()
    for relative, mode, object_id in repository_entries(root, staged):
        rule = path_violation(relative)
        if rule:
            findings.append({"rule": rule, "path": relative, "line": 0})
            continue
        if staged:
            if mode not in {"100644", "100755"}:
                findings.append({"rule": "unsupported-git-mode", "path": relative, "line": 0})
                continue
            content = run_git(root, "cat-file", "blob", object_id)
        else:
            source = source_path(root, relative)
            if source is None:
                findings.append({"rule": "unsafe-link", "path": relative, "line": 0})
                continue
            if not source.exists():
                continue
            if not source.is_file():
                findings.append({"rule": "unsupported-file", "path": relative, "line": 0})
                continue
            content = source.read_bytes()
        if content.startswith(b"PGDMP") or b"-- PostgreSQL database dump" in content[:512]:
            findings.append({"rule": "dump-content", "path": relative, "line": 0})
            continue
        target = snapshot.joinpath(*PurePosixPath(relative).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        included.add(relative)
    return findings, included


def sanitized_findings(report, snapshot, included):
    """Extrai metadados conhecidos e descarta os campos com valores sensíveis."""
    findings = []
    for item in report:
        path = str(item.get("File", "")).replace("\\", "/")
        prefix = snapshot.as_posix().rstrip("/") + "/"
        if path.startswith(prefix):
            path = path[len(prefix):]
        if path.startswith("./"):
            path = path[2:]
        if path not in included:
            path = "[arquivo não identificado]"
        rule = str(item.get("RuleID", ""))
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,100}", rule):
            rule = "gitleaks-finding"
        line = item.get("StartLine", 0)
        if not isinstance(line, int) or line < 0:
            line = 0
        findings.append({"rule": rule, "path": path, "line": line})
    return findings


def scan_snapshot(binary, snapshot, included, report_path):
    version = subprocess.run([binary, "version"], capture_output=True, check=False)
    if version.returncode or version.stdout.decode("utf-8", errors="replace").strip() != GITLEAKS_VERSION:
        raise SecurityCheckError("unsupported-gitleaks-version")
    config = snapshot / ".gitleaks.toml"
    if not config.is_file():
        raise SecurityCheckError("missing-gitleaks-config")
    ignore_path = report_path.parent / "empty.gitleaksignore"
    ignore_path.write_text("", encoding="utf-8")
    result = subprocess.run(
        [
            binary, "dir", str(snapshot), "--config", str(config), "--redact=100",
            "--ignore-gitleaks-allow", "--no-banner", "--report-format", "json",
            "--report-path", str(report_path), "--exit-code", "1",
            "--gitleaks-ignore-path", str(ignore_path),
        ],
        capture_output=True, check=False,
    )
    if result.returncode not in (0, 1):
        raise SecurityCheckError("gitleaks-scan-failed")
    if not report_path.is_file():
        raise SecurityCheckError("missing-gitleaks-report")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if not isinstance(report, list) or any(not isinstance(item, dict) for item in report):
        raise SecurityCheckError("invalid-gitleaks-report")
    findings = sanitized_findings(report, snapshot, included)
    if result.returncode == 1 and not findings:
        raise SecurityCheckError("inconsistent-gitleaks-report")
    return findings


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staged", action="store_true", help="Verifica o conteúdo do índice Git.")
    parser.add_argument("--gitleaks", default="gitleaks", help="Caminho do executável Gitleaks 8.30.1.")
    args = parser.parse_args(argv)
    output = {"status": "error", "mode": "staged" if args.staged else "working", "findings": []}
    try:
        binary = shutil.which(args.gitleaks)
        if binary is None:
            raise SecurityCheckError("gitleaks-not-found")
        root = repository_root()
        with tempfile.TemporaryDirectory(prefix="axeflow-security-") as temporary:
            temporary_path = Path(temporary)
            snapshot = temporary_path / "snapshot"
            snapshot.mkdir()
            findings, included = create_snapshot(root, snapshot, args.staged)
            output["findings"] = findings
            findings.extend(scan_snapshot(binary, snapshot, included, temporary_path / "report.json"))
        output["status"] = "blocked" if findings else "passed"
        exit_code = 1 if findings else 0
    except SecurityCheckError as error:
        output["error"] = str(error)
        exit_code = 2
    except (OSError, ValueError, UnicodeError):
        output["error"] = "security-check-failed"
        exit_code = 2
    print(json.dumps(output, ensure_ascii=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
