"""
0004_email_por_terreiro — AxeFlow

Remove a constraint UNIQUE global no email de usuários e cria uma nova
constraint composta (email + terreiro_id).

Motivação: o mesmo email deve poder ser membro em terreiros diferentes.
Antes: usuarios_email_key  → email único globalmente (errado)
Depois: uq_usuario_email_terreiro → email único por terreiro (correto)

Revision ID: 0004_email_por_terreiro
Revises: 0003_melhorias
Create Date: 2026-03-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0004_email_por_terreiro'
down_revision: Union[str, None] = '0003_melhorias'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def constraint_existe(nome: str) -> bool:
    """Verifica se constraint já existe — garante idempotência."""
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT constraint_name FROM information_schema.table_constraints "
             "WHERE constraint_name = :n"),
        {"n": nome}
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # 1. Remove a constraint global antiga (se existir)
    #    Pode não existir se o banco foi criado em outro momento
    if constraint_existe("usuarios_email_key"):
        op.drop_constraint("usuarios_email_key", "usuarios", type_="unique")

    # 2. Cria constraint composta (email + terreiro_id)
    #    Permite mesmo email em terreiros diferentes
    if not constraint_existe("uq_usuario_email_terreiro"):
        op.create_unique_constraint(
            "uq_usuario_email_terreiro",
            "usuarios",
            ["email", "terreiro_id"],
        )


def downgrade() -> None:
    # Reverte: remove composta e restaura global
    if constraint_existe("uq_usuario_email_terreiro"):
        op.drop_constraint("uq_usuario_email_terreiro", "usuarios", type_="unique")

    if not constraint_existe("usuarios_email_key"):
        op.create_unique_constraint("usuarios_email_key", "usuarios", ["email"])
