"""Valida o guard de repositório em snapshots Git temporários e sintéticos."""
import contextlib
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


RAIZ = Path(__file__).resolve().parents[2]
SCRIPT = RAIZ / "scripts" / "check_repository_security.py"


class RepositorySecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("repository_guard", SCRIPT)
        cls.guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.guard)
        cls.gitleaks = os.environ.get("GITLEAKS_BIN") or shutil.which("gitleaks")

    def setUp(self):
        self.temporario = tempfile.TemporaryDirectory(prefix="axeflow-guard-test-")
        self.addCleanup(self.temporario.cleanup)
        self.repo = Path(self.temporario.name)
        self.git("init", "--quiet")
        self.escrever(".gitleaks.toml", (RAIZ / ".gitleaks.toml").read_text(encoding="utf-8"))
        self.escrever("README.md", "Projeto de teste sintético.\n")
        self.git("add", ".")

    def git(self, *argumentos):
        resultado = subprocess.run(["git", "-C", str(self.repo), *argumentos],
                                   capture_output=True, text=True, check=True)
        return resultado.stdout

    def escrever(self, nome, conteudo):
        arquivo = self.repo / nome
        arquivo.parent.mkdir(parents=True, exist_ok=True)
        arquivo.write_text(conteudo, encoding="utf-8")

    def executar(self, staged=False, binario=None):
        argumentos = ["--staged"] if staged else []
        if binario or self.gitleaks:
            argumentos += ["--gitleaks", str(binario or self.gitleaks)]
        anterior = Path.cwd()
        saida = io.StringIO()
        try:
            os.chdir(self.repo)
            with contextlib.redirect_stdout(saida):
                codigo = self.guard.main(argumentos)
        finally:
            os.chdir(anterior)
        return codigo, json.loads(saida.getvalue()), saida.getvalue()

    def exigir_gitleaks(self):
        if not self.gitleaks:
            self.skipTest("Defina GITLEAKS_BIN para executar integração com Gitleaks real")

    def test_paths_bloqueiam_artefatos_e_segredos(self):
        for caminho in (".env", "backend/.env.production", "axeflow.backup", "dados.dump",
                        "backups/db.sql.gz", "frontend/.next/server/pages/index.js",
                        "service-account.json", "private.pem", "chave.key"):
            with self.subTest(caminho=caminho):
                self.assertIsNotNone(self.guard.path_violation(caminho))

    def test_paths_aceitam_codigo_e_templates(self):
        for caminho in ("backend/app/core/security.py", "frontend/services/firebase.js",
                        "backend/.env.example", "frontend/.env.example", ".gitleaks.toml"):
            with self.subTest(caminho=caminho):
                self.assertIsNone(self.guard.path_violation(caminho))

    def test_binario_inexistente_falha_sem_expor_conteudo(self):
        segredo = "valor-sintetico-que-nao-deve-aparecer"
        self.escrever("config.txt", segredo)
        codigo, resultado, saida = self.executar(binario=self.repo / "ausente.exe")
        self.assertEqual(codigo, 2)
        self.assertIn("error", resultado)
        self.assertNotIn(segredo, saida)

    def test_snapshot_limpo_com_publicas_e_placeholders(self):
        self.exigir_gitleaks()
        fonte_publica = (RAIZ / "frontend" / "public" / "firebase-messaging-sw.js").read_text(encoding="utf-8")
        chave_publica = re.search(r'apiKey:\s*"([^"]+)"', fonte_publica).group(1)
        self.escrever("frontend/public/firebase-messaging-sw.js", 'const apiKey = "' + chave_publica + '";\n')
        self.escrever("template.txt", "VAPID_PRIVATE_KEY=troque-este-valor\n")
        codigo, resultado, _ = self.executar()
        self.assertEqual(codigo, 0, resultado)
        self.assertEqual(resultado["findings"], [])

    def test_allowlist_publica_nao_libera_segredo_no_mesmo_arquivo(self):
        self.exigir_gitleaks()
        segredo = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" + "AbCdEf0123456789" * 8
        self.escrever("frontend/public/firebase-messaging-sw.js", "VAPID_PRIVATE_KEY=" + segredo + "\n")
        codigo, resultado, saida = self.executar()
        self.assertEqual(codigo, 1, resultado)
        self.assertNotIn(segredo, saida)

    def test_segredo_vapid_realista_redigido(self):
        self.exigir_gitleaks()
        segredo = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" + "AbCdEf0123456789" * 8
        self.escrever("deploy.yml", "- key: VAPID_PRIVATE_KEY\n  value: " + segredo + "\n")
        codigo, resultado, saida = self.executar()
        self.assertEqual(codigo, 1, resultado)
        self.assertTrue(resultado["findings"])
        self.assertNotIn(segredo, saida)
        for achado in resultado["findings"]:
            self.assertEqual(set(achado), {"rule", "path", "line"})

    def test_staged_inspeciona_index_e_working_inspeciona_arquivo(self):
        self.exigir_gitleaks()
        segredo = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" + "aBcDeF0123456789" * 8
        self.escrever("deploy.yml", "VAPID_PRIVATE_KEY=" + segredo + "\n")
        self.git("add", "deploy.yml")
        self.escrever("deploy.yml", "VAPID_PRIVATE_KEY=troque-este-valor\n")
        codigo, resultado, _ = self.executar(staged=True)
        self.assertEqual(codigo, 1, resultado)
        codigo, resultado, _ = self.executar()
        self.assertEqual(codigo, 0, resultado)

    def test_backup_versionado_bloqueado(self):
        self.exigir_gitleaks()
        (self.repo / "db.backup").write_bytes(b"PGDMP\0sintetico")
        self.git("add", "db.backup")
        codigo, resultado, _ = self.executar()
        self.assertEqual(codigo, 1, resultado)
        self.assertTrue(any(item["path"] == "db.backup" for item in resultado["findings"]))

    def test_link_no_index_bloqueado_sem_seguir_destino(self):
        self.exigir_gitleaks()
        resultado = subprocess.run(["git", "-C", str(self.repo), "hash-object", "-w", "--stdin"],
                                    input=b"../arquivo-externo-sintetico", capture_output=True, check=True)
        objeto = resultado.stdout.decode().strip()
        self.git("update-index", "--add", "--cacheinfo", f"120000,{objeto},link-local")
        codigo, resultado, _ = self.executar(staged=True)
        self.assertEqual(codigo, 1, resultado)
        self.assertTrue(any(item["path"] == "link-local" for item in resultado["findings"]))

    def test_dump_renomeado_bloqueado_pelo_formato(self):
        self.exigir_gitleaks()
        for nome, conteudo in (("export.bin", b"PGDMP\0sintetico"),
                               ("notas.txt", b"-- PostgreSQL database dump\n-- Dados sinteticos\n")):
            with self.subTest(nome=nome):
                (self.repo / nome).write_bytes(conteudo)
                codigo, resultado, _ = self.executar()
                self.assertEqual(codigo, 1, resultado)
                self.assertTrue(any(item["path"] == nome for item in resultado["findings"]))
                (self.repo / nome).unlink()

    def test_migration_alembic_com_sql_inocuo_permitida(self):
        self.exigir_gitleaks()
        self.escrever("backend/migrations/versions/0001_test.py", 'op.execute("CREATE TABLE teste (id INT)")\n')
        self.escrever("migrations/001_test.sql", "SELECT 1;\n")
        codigo, resultado, _ = self.executar()
        self.assertEqual(codigo, 0, resultado)

    def test_arquivo_local_ignorado_preservado(self):
        self.exigir_gitleaks()
        self.escrever(".gitignore", ".env.local\n")
        self.escrever(".env.local", "SEGREDO_LOCAL=sintetico\n")
        codigo, resultado, _ = self.executar()
        self.assertEqual(codigo, 0, resultado)
        self.assertEqual((self.repo / ".env.local").read_text(), "SEGREDO_LOCAL=sintetico\n")

    def test_relatorio_descarta_campos_e_paths_desconhecidos(self):
        segredo = "segredo-sintetico-nunca-na-saida"
        achados = self.guard.sanitized_findings([
            {"File": segredo, "RuleID": segredo + " invalid!", "StartLine": segredo,
             "Secret": segredo, "Match": segredo},
        ], self.repo, {"README.md"})
        self.assertEqual(achados, [{"rule": "gitleaks-finding",
                                   "path": "[arquivo não identificado]", "line": 0}])
        self.assertNotIn(segredo, json.dumps(achados))

    def test_erro_scanner_nao_repassa_stdout_ou_stderr(self):
        segredo = b"segredo-sintetico-saida-processo"
        respostas = [subprocess.CompletedProcess([], 0, b"8.30.1\n", b""),
                     subprocess.CompletedProcess([], 2, segredo, segredo)]
        with patch.object(self.guard.subprocess, "run", side_effect=respostas):
            with self.assertRaises(self.guard.SecurityCheckError) as erro:
                self.guard.scan_snapshot("scanner-sintetico", self.repo, {"README.md"},
                                         self.repo / "report.json")
        self.assertEqual(str(erro.exception), "gitleaks-scan-failed")
        self.assertNotIn(segredo.decode(), str(erro.exception))

    def test_padrao_privado_pem_bloqueado_sem_valor_na_saida(self):
        self.exigir_gitleaks()
        segredo = "MIIEowIBAAKCAQEA" + "AbCdEf0123456789" * 8
        self.escrever("documento.txt", "-----BEGIN RSA PRIVATE KEY-----\n" + segredo +
                      "\n-----END RSA PRIVATE KEY-----\n")
        codigo, resultado, saida = self.executar()
        self.assertEqual(codigo, 1, resultado)
        self.assertNotIn(segredo, saida)

    def test_comentario_allow_nao_suprime_segredo(self):
        self.exigir_gitleaks()
        segredo = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" + "AbCdEf0123456789" * 8
        self.escrever("deploy.txt", "VAPID_PRIVATE_KEY=" + segredo + " # gitleaks:allow\n")
        codigo, resultado, saida = self.executar()
        self.assertEqual(codigo, 1, resultado)
        self.assertNotIn(segredo, saida)

    def test_gitignore_bloqueia_segredos_e_permite_templates(self):
        self.escrever(".gitignore", (RAIZ / ".gitignore").read_text(encoding="utf-8"))
        for caminho in (".env.local", "backend/.env.production", "db.backup", "backend/test.pem",
                        "frontend/.next/server/index.js", "service-account.json"):
            with self.subTest(caminho=caminho):
                resultado = subprocess.run(["git", "-C", str(self.repo), "check-ignore", "--no-index", caminho],
                                            capture_output=True, text=True)
                self.assertEqual(resultado.returncode, 0)
        for caminho in ("backend/.env.example", "frontend/.env.sample", ".env.template"):
            resultado = subprocess.run(["git", "-C", str(self.repo), "check-ignore", "--no-index", caminho],
                                        capture_output=True, text=True)
            self.assertEqual(resultado.returncode, 1)


if __name__ == "__main__":
    unittest.main()
