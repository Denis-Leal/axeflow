# Importa todos os models para que sejam registrados no SQLAlchemy
# backend/app/models/__init__.py
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription
from app.models.audit_log import AuditLog