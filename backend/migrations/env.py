"""
env.py — Alembic
Configuração do ambiente de migrações.

CORREÇÃO: compare_server_default=True adicionado em ambos os modos
(online e offline). Sem isso o autogenerate ignora divergências de
default entre model Python e coluna do banco, causando drift silencioso.
"""
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importa todos os models para o Alembic detectar as tabelas corretamente
from app.core.database import Base
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """
    Lê DATABASE_URL do ambiente.
    Render/Heroku usam postgres://, mas SQLAlchemy exige postgresql://.
    """
    url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def run_migrations_offline() -> None:
    """Modo offline: gera SQL sem conexão com o banco."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,  # detecta drift de defaults
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Modo online: executa migrações diretamente no banco."""
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,  # detecta drift de defaults
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()