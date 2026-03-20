"""
app/models/__init__.py — AxeFlow
Importa todos os models para que o Alembic e o SQLAlchemy os detectem.

ORDEM: models referenciados por ForeignKey devem vir antes dos que os usam.

InscricaoGira (legado) mantido durante transição — remover após 0009_drop_inscricoes_gira.
"""
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente

# Legado — mantido durante período de transição
from app.models.inscricao import InscricaoGira

# Novos models separados por domínio
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.inscricao_membro import InscricaoMembro

from app.models.push_subscription import PushSubscription

# AuditLog deve estar aqui para o Alembic detectar a tabela no autogenerate
from app.models.audit_log import AuditLog

# ApiKey — autenticação de integrações externas
from app.models.api_key import ApiKey