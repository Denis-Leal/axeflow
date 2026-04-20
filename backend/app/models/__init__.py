"""
app/models/__init__.py — AxeFlow
Importa todos os models para que o Alembic e o SQLAlchemy os detectem.

ORDEM: models referenciados por ForeignKey devem vir antes dos que os usam.
"""
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente

# Novos models separados por domínio
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.inscricao_membro import InscricaoMembro

from app.models.push_subscription import PushSubscription
from app.models.device import Device
from app.models.notification_log import NotificationLog


# AuditLog deve estar aqui para o Alembic detectar a tabela no autogenerate
from app.models.audit_log import AuditLog

# ApiKey — autenticação de integrações externas
from app.models.api_key import ApiKey

# Recuperação de senha
from app.models.password_reset_token import PasswordResetToken

# Ajeum — gestão de seleções e confirmações
from app.models.ajeum import Ajeum, AjeumItem, AjeumSelecao

# Inventário e consumo por gira
from app.models.inventory_item import InventoryItem
from app.models.inventory_owner import InventoryOwner
from app.models.inventory_movement import InventoryMovement
from app.models.inventory_alert import InventoryAlert
from app.models.gira_item_consumption import GiraItemConsumption