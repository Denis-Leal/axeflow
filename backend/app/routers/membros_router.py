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


# ── Perfil CRM do consulente ───────────────────────────────────────────────────
from app.models.gira import Gira as GiraModel

@router.get("/consulentes/{consulente_id}/perfil")
def get_perfil_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perfil CRM completo de um consulente:
    histórico cronológico, padrões de visita, score e linha do tempo.
    """
    from app.services.presenca_service import calcular_score
    from datetime import date

    consulente = db.query(Consulente).filter(Consulente.id == consulente_id).first()
    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    # Apenas giras deste terreiro
    gira_ids = [g.id for g in db.query(GiraModel.id).filter(GiraModel.terreiro_id == user.terreiro_id).all()]

    inscricoes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.consulente_id == consulente_id,
            InscricaoGira.gira_id.in_(gira_ids),
        )
        .all()
    )

    if not inscricoes:
        raise HTTPException(status_code=404, detail="Consulente não encontrado neste terreiro")

    # Montar histórico cronológico
    historico = []
    for i in inscricoes:
        gira = db.query(GiraModel).filter(GiraModel.id == i.gira_id).first()
        if not gira:
            continue
        historico.append({
            "gira_id":    str(gira.id),
            "gira_titulo": gira.titulo,
            "gira_tipo":  gira.tipo,
            "data":       gira.data.isoformat(),
            "status":     i.status,
            "posicao":    i.posicao,
            "inscrito_em": i.created_at.isoformat(),
        })

    # Ordenar cronológico (mais recente primeiro)
    historico.sort(key=lambda x: x["data"], reverse=True)

    # Métricas
    nao_cancelados  = [h for h in historico if h["status"] != "cancelado"]
    comparecimentos = [h for h in historico if h["status"] == "compareceu"]
    faltas          = [h for h in historico if h["status"] == "faltou"]
    cancelamentos   = [h for h in historico if h["status"] == "cancelado"]

    datas_compareceu = sorted([h["data"] for h in comparecimentos])
    ultima_visita    = datas_compareceu[-1] if datas_compareceu else None
    primeira_data    = datas_compareceu[0]  if datas_compareceu else None

    # Dias desde a última visita
    dias_ausente = None
    if ultima_visita:
        delta = date.today() - date.fromisoformat(ultima_visita)
        dias_ausente = delta.days

    # Tipos de gira que mais frequentou
    tipos = {}
    for h in comparecimentos:
        t = h["gira_tipo"] or "Não especificado"
        tipos[t] = tipos.get(t, 0) + 1
    tipos_favoritos = sorted(tipos.items(), key=lambda x: x[1], reverse=True)

    # Score de presença
    score = calcular_score(len(nao_cancelados), len(comparecimentos), len(faltas))

    # Status de retorno
    if dias_ausente is None:
        status_retorno = "nunca_compareceu"
    elif dias_ausente <= 60:
        status_retorno = "ativo"
    elif dias_ausente <= 180:
        status_retorno = "morno"
    else:
        status_retorno = "inativo"

    return {
        "id":            str(consulente.id),
        "nome":          consulente.nome,
        "telefone":      consulente.telefone,
        "primeira_visita": consulente.primeira_visita,
        "cadastrado_em": consulente.created_at.isoformat(),

        # Métricas
        "total_inscricoes":  len(nao_cancelados),
        "comparecimentos":   len(comparecimentos),
        "faltas":            len(faltas),
        "cancelamentos":     len(cancelamentos),
        "score":             score,

        # Temporalidade
        "primeira_data":   primeira_data,
        "ultima_visita":   ultima_visita,
        "dias_ausente":    dias_ausente,
        "status_retorno":  status_retorno,  # ativo | morno | inativo | nunca_compareceu

        # Preferências
        "tipos_favoritos": tipos_favoritos,

        # Linha do tempo
        "historico":       historico,
    }
