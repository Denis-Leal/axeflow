"""Portal público: perfil, mural e seleção de giras.

Revision ID: 0027_portal_publico
Revises: 0026_financeiro_inicial
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0027_portal_publico"
down_revision: Union[str, None] = "0026_financeiro_inicial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("terreiros", sa.Column("publico_ativo", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("terreiros", sa.Column("slug_publico", sa.String(length=120), nullable=True))
    op.add_column("terreiros", sa.Column("descricao_publica", sa.Text(), nullable=True))
    op.add_column("terreiros", sa.Column("telefone_publico", sa.String(length=30), nullable=True))
    op.add_column("terreiros", sa.Column("whatsapp_publico", sa.String(length=30), nullable=True))
    op.add_column("terreiros", sa.Column("instagram_publico", sa.String(length=255), nullable=True))
    op.add_column("terreiros", sa.Column("endereco_publico", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("terreiros", sa.Column("endereco_linha", sa.String(length=255), nullable=True))
    op.add_column("terreiros", sa.Column("bairro", sa.String(length=120), nullable=True))
    op.add_column("terreiros", sa.Column("uf", sa.String(length=2), nullable=True))
    op.add_column("terreiros", sa.Column("cep", sa.String(length=12), nullable=True))
    op.add_column("terreiros", sa.Column("latitude", sa.String(length=32), nullable=True))
    op.add_column("terreiros", sa.Column("longitude", sa.String(length=32), nullable=True))
    op.create_unique_constraint("uq_terreiros_slug_publico", "terreiros", ["slug_publico"])
    op.add_column("giras", sa.Column("visivel_portal", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "publicacoes_terreiro",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=False),
        sa.Column("titulo", sa.String(length=160), nullable=False),
        sa.Column("conteudo", sa.Text(), nullable=False),
        sa.Column("categoria", sa.String(length=30), nullable=False, server_default="aviso"),
        sa.Column("publicado", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("publicado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_publicacoes_terreiro_publicado", "publicacoes_terreiro", ["terreiro_id", "publicado", "publicado_em"])


def downgrade() -> None:
    op.drop_index("ix_publicacoes_terreiro_publicado", table_name="publicacoes_terreiro")
    op.drop_table("publicacoes_terreiro")
    op.drop_column("giras", "visivel_portal")
    op.drop_constraint("uq_terreiros_slug_publico", "terreiros", type_="unique")
    for column in ["longitude", "latitude", "cep", "uf", "bairro", "endereco_linha", "endereco_publico", "instagram_publico", "whatsapp_publico", "telefone_publico", "descricao_publica", "slug_publico", "publico_ativo"]:
        op.drop_column("terreiros", column)
