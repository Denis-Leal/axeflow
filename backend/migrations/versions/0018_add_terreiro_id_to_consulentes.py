"""
0018_add_terreiro_id_to_consulentes

Adiciona campo terreiro_id em consulentes com estratégia segura:

1. Cria como nullable
2. Popula dados existentes
3. Torna NOT NULL + índice
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0018_add_terreiro_id_to_consulentes"
down_revision: Union[str, None] = "0017_add_source_and_usuario"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # 1. Adiciona coluna como nullable (evita quebra)
    op.add_column(
        "consulentes",
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # ⚠️ 2. POPULAR DADOS EXISTENTES
    # Você PRECISA decidir isso. Aqui vai um fallback perigoso:
    #
    # Exemplo: atribuir todos ao mesmo terreiro (TEMPORÁRIO)
    #
    op.execute("""
        UPDATE consulentes
        SET terreiro_id = '398dd422-a0e3-4ad8-8169-67a868d73a05'
    """)

    # ⚠️ Se não fizer isso, o próximo passo VAI FALHAR

    # 3. Tornar NOT NULL (somente se já populou)
    op.alter_column(
        "consulentes",
        "terreiro_id",
        nullable=False
    )

    # 4. Índice (você já usa em filtro — isso é obrigatório)
    op.create_index(
        "ix_consulentes_terreiro_id",
        "consulentes",
        ["terreiro_id"],
    )

    # 5. (RECOMENDADO) índice composto para busca
    op.create_index(
        "ix_consulentes_nome_terreiro",
        "consulentes",
        ["nome", "terreiro_id"],
    )


def downgrade() -> None:

    op.drop_index("ix_consulentes_nome_terreiro", table_name="consulentes")
    op.drop_index("ix_consulentes_terreiro_id", table_name="consulentes")

    op.drop_column("consulentes", "terreiro_id")