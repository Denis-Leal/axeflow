from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.core.config import settings
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.schemas.auth_schema import UsuarioResponse
from app.services.email_service import send_convite_membro
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/membros", tags=["membros"])

class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    role: str = "membro"

@router.get("")
def list_membros(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    membros = db.query(Usuario).filter(Usuario.terreiro_id == user.terreiro_id).all()
    return [
        {
            "id": str(m.id),
            "nome": m.nome,
            "email": m.email,
            "telefone": m.telefone,
            "role": m.role,
            "ativo": m.ativo,
        }
        for m in membros
    ]

@router.post("")
def create_membro(data: MembroCreate, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "operador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    novo = Usuario(
        terreiro_id=user.terreiro_id,
        nome=data.nome,
        email=data.email,
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        role=data.role,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    # Buscar nome do terreiro para o email
    terreiro = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
    terreiro_nome = terreiro.nome if terreiro else "seu terreiro"

    # Enviar email de convite (assíncrono — não bloqueia a resposta)
    try:
        enviado = send_convite_membro(
            nome=data.nome,
            email=data.email,
            senha_provisoria=data.senha,
            terreiro_nome=terreiro_nome,
            convidado_por=user.nome,
            app_url=settings.APP_URL,
        )
        if not enviado:
            logger.warning("[Membros] Email de convite não enviado para %s (RESEND_API_KEY configurada?)", data.email)
    except Exception as e:
        logger.error("[Membros] Erro ao enviar email de convite: %s", e)

    return {
        "id": str(novo.id),
        "nome": novo.nome,
        "email": novo.email,
        "role": novo.role,
        "email_convite_enviado": bool(settings.RESEND_API_KEY),
    }


# ── Consulentes ────────────────────────────────────────────────────────────────
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from sqlalchemy import func

@router.get("/consulentes-lista")
def list_consulentes(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retorna todos os consulentes que já se inscreveram em giras deste terreiro,
    incluindo primeira_visita, total de inscrições e comparecimentos.
    """
    from app.models.gira import Gira

    # IDs das giras deste terreiro
    gira_ids = [g.id for g in db.query(Gira.id).filter(Gira.terreiro_id == user.terreiro_id).all()]
    if not gira_ids:
        return []

    # Buscar consulentes que têm inscrições nessas giras
    inscricoes = (
        db.query(InscricaoGira)
        .filter(InscricaoGira.gira_id.in_(gira_ids))
        .all()
    )

    # Agregar por consulente
    dados = {}
    for i in inscricoes:
        c = i.consulente
        if not c:
            continue
        cid = str(c.id)
        if cid not in dados:
            dados[cid] = {
                "id": cid,
                "nome": c.nome,
                "telefone": c.telefone,
                "primeira_visita": c.primeira_visita,
                "criado_em": c.created_at.isoformat() if c.created_at else None,
                "total_inscricoes": 0,
                "comparecimentos": 0,
            }
        if i.status != StatusInscricaoEnum.cancelado:
            dados[cid]["total_inscricoes"] += 1
        if i.status == "compareceu":
            dados[cid]["comparecimentos"] += 1

    return list(dados.values())
