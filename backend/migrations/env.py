import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Garante que o diretório backend/ está no path para importar app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importa todos os models para o Alembic detectar as tabelas
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


def get_url():
    """
    Lê DATABASE_URL do ambiente.
    Render usa postgres:// mas SQLAlchemy exige postgresql://.
    """
    url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    # Corrige prefixo antigo do Render/Heroku
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
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
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()