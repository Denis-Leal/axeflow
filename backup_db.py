import os
import subprocess
from datetime import datetime
from pathlib import Path

BACKUP_DIR = Path("./backups")
BACKUP_DIR.mkdir(exist_ok=True)

DB_URL = "postgresql://terreiro:2WVwY5tBgbY2JhMJ1n2y6tSww8xaMkoB@dpg-d6ncd8k50q8c73b38ku0-a.oregon-postgres.render.com/axeflow"
PG_DUMP_PATH = r"C:\Arquivos de Programas\PostgreSQL\18\bin\pg_dump.exe"
def create_backup():
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = BACKUP_DIR / f"backup_{timestamp}.sql"

    result = subprocess.run(
        [
            PG_DUMP_PATH, 
            DB_URL, "-f",
            "--no-owner",
            "--no-privileges",
            str(filename)],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise Exception(f"Backup failed: {result.stderr}")

    # validação básica
    if not filename.exists() or filename.stat().st_size < 1024:
        raise Exception("Backup inválido (arquivo muito pequeno)")

    print(f"Backup criado: {filename}")

def rotate_backups(days=7):
    files = sorted(BACKUP_DIR.glob("backup_*.sql"))
    cutoff = datetime.now().timestamp() - (days * 86400)

    for f in files:
        if f.stat().st_mtime < cutoff:
            f.unlink()
            print(f"Removido: {f}")

if __name__ == "__main__":
    create_backup()
    rotate_backups()