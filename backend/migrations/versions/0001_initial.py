"""schema inicial + acesso em giras + membro_id em inscricoes

Revision ID: 0001_initial
Revises: 
Create Date: 2026-03-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_table(name):
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name}).scalar()


def has_column(table, column):
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:

    # ── terreiros ──────────────────────────────────────────────────────────────
    if not has_table("terreiros"):
        op.create_table(
            "terreiros",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("nome", sa.String(255), nullable=False),
            sa.Column("cidade", sa.String(255)),
            sa.Column("slug", sa.String(255), unique=True),
            sa.Column("created_at", sa.DateTime),
        )

    # ── usuarios ───────────────────────────────────────────────────────────────
    if not has_table("usuarios"):
        op.create_table(
            "usuarios",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),
            sa.Column("nome", sa.String(255), nullable=False),
            sa.Column("email", sa.String(255), unique=True, nullable=False),
            sa.Column("senha_hash", sa.String(255), nullable=False),
            sa.Column("telefone", sa.String(20)),
            sa.Column("role", sa.String(50), default="membro"),
            sa.Column("ativo", sa.Boolean, default=True),
            sa.Column("created_at", sa.DateTime),
        )

    # ── consulentes ────────────────────────────────────────────────────────────
    if not has_table("consulentes"):
        op.create_table(
            "consulentes",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("nome", sa.String(255), nullable=False),
            sa.Column("telefone", sa.String(20), unique=True, nullable=False),
            sa.Column("primeira_visita", sa.Boolean, default=True),
            sa.Column("created_at", sa.DateTime),
        )

    # ── giras ──────────────────────────────────────────────────────────────────
    if not has_table("giras"):
        op.create_table(
            "giras",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),
            sa.Column("titulo", sa.String(255), nullable=False),
            sa.Column("tipo", sa.String(100)),
            sa.Column("data", sa.Date, nullable=False),
            sa.Column("horario", sa.Time, nullable=False),
            sa.Column("limite_consulentes", sa.Integer, nullable=False),
            sa.Column("abertura_lista", sa.DateTime, nullable=True),
            sa.Column("fechamento_lista", sa.DateTime, nullable=True),
            sa.Column("responsavel_lista_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("status", sa.String(50), default="aberta"),
            sa.Column("acesso", sa.String(20), nullable=False, server_default="publica"),
            sa.Column("slug_publico", sa.String(255), unique=True, nullable=True),
            sa.Column("created_at", sa.DateTime),
        )
    else:
        if not has_column("giras", "acesso"):
            op.add_column("giras",
                sa.Column("acesso", sa.String(20), nullable=False, server_default="publica"))
        op.execute(sa.text("ALTER TABLE giras ALTER COLUMN slug_publico DROP NOT NULL"))
        op.execute(sa.text("ALTER TABLE giras ALTER COLUMN abertura_lista DROP NOT NULL"))
        op.execute(sa.text("ALTER TABLE giras ALTER COLUMN fechamento_lista DROP NOT NULL"))

    # ── inscricoes_gira ────────────────────────────────────────────────────────
    if not has_table("inscricoes_gira"):
        op.create_table(
            "inscricoes_gira",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("gira_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("giras.id", ondelete="CASCADE"), nullable=False),
            sa.Column("consulente_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("consulentes.id"), nullable=True),
            sa.Column("membro_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("posicao", sa.Integer, nullable=False),
            sa.Column("status", sa.String(50), default="confirmado"),
            sa.Column("created_at", sa.DateTime),
        )
    else:
        if not has_column("inscricoes_gira", "membro_id"):
            op.add_column("inscricoes_gira",
                sa.Column("membro_id", postgresql.UUID(as_uuid=True),
                          sa.ForeignKey("usuarios.id"), nullable=True))
        op.execute(sa.text("ALTER TABLE inscricoes_gira ALTER COLUMN consulente_id DROP NOT NULL"))

    # ── push_subscriptions ─────────────────────────────────────────────────────
    if not has_table("push_subscriptions"):
        op.create_table(
            "push_subscriptions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),
            sa.Column("endpoint", sa.Text, nullable=False),
            sa.Column("p256dh", sa.Text, nullable=False),
            sa.Column("auth", sa.Text, nullable=False),
            sa.Column("created_at", sa.DateTime),
        )


def downgrade() -> None:
    if has_column("inscricoes_gira", "membro_id"):
        op.drop_column("inscricoes_gira", "membro_id")
    if has_column("giras", "acesso"):
        op.drop_column("giras", "acesso")
