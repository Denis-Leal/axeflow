"""
membros_router.py — AxeFlow

CORREÇÃO: todas as operações de inscrição de membro agora usam
InscricaoMembro em vez de InscricaoGira.

Funções afetadas:
  - marcar_presenca_membro       (admin/operador marca presença)
  - confirmar_presenca_propria   (membro confirma em gira fechada)
  - confirmar_presenca_publica   (membro confirma em gira pública)
  - get_presenca_membros         (leitura gira fechada)
  - get_presenca_membros_publica (leitura gira pública)

InscricaoGira (legado) não é mais referenciado nestas funções.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user, require_role, hash_password
from app.models.usuario import Usuario
from app.models.inscricao_membro import InscricaoMembro
from app.models.inscricao_status import StatusInscricaoEnum
from app.services.email_service import send_convite_membro
from app.services.push_service import send_push_to_terreiro
from app.models.terreiro import Terreiro
from app.models.gira import Gira as GiraModel
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/membros", tags=["membros"])


# ── Schemas locais ─────────────────────────────────────────────────────────────

class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    role: str = "membro"


class NotasConsulenteUpdate(BaseModel):
    notas: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observações internas do terreiro sobre o consulente",
    )


# ── Membros ────────────────────────────────────────────────────────────────────

@router.get("")
def list_membros(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista todos os membros ativos do terreiro."""
    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()
    return [
        {
            "id":       str(m.id),
            "nome":     m.nome,
            "email":    m.email,
            "telefone": m.telefone,
            "role":     m.role,
            "ativo":    m.ativo,
        }
        for m in membros
    ]


@router.post("")
def create_membro(
    data: MembroCreate,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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

    terreiro = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
    terreiro_nome = terreiro.nome if terreiro else "seu terreiro"

    try:
        enviado = send_convite_membro(
            nome=data.nome,
            email=data.email,
            senha_provisoria=data.senha,
            terreiro_nome=terreiro_nome,
            convidado_por=user.nome,
            app_url=settings.app_url_resolved,
        )
        if not enviado:
            logger.warning(
                "[Membros] Email de convite não enviado para %s (BREVO_API_KEY configurada?)",
                data.email,
            )
    except Exception as e:
        logger.error("[Membros] Erro ao enviar email de convite: %s", e)

    return {
        "id":                    str(novo.id),
        "nome":                  novo.nome,
        "email":                 novo.email,
        "role":                  novo.role,
        "email_convite_enviado": bool(settings.BREVO_API_KEY),
    }


@router.put("/{membro_id}")
def update_membro(
    membro_id: UUID,
    data: dict,
    user: Usuario = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Atualiza dados de um membro (admin only)."""
    membro = db.query(Usuario).filter(
        Usuario.id == membro_id,
        Usuario.terreiro_id == user.terreiro_id,
    ).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    if str(membro.id) == str(user.id) and data.get("ativo") is False:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta")

    if "nome"     in data: membro.nome     = data["nome"]
    if "telefone" in data: membro.telefone = data["telefone"]
    if "role"     in data and data["role"] in ("admin", "operador", "membro"):
        membro.role = data["role"]
    if "ativo"    in data: membro.ativo    = bool(data["ativo"])
    if "senha"    in data and data["senha"]:
        membro.senha_hash = hash_password(data["senha"])

    db.commit()
    db.refresh(membro)
    return {
        "id":       str(membro.id),
        "nome":     membro.nome,
        "email":    membro.email,
        "telefone": membro.telefone,
        "role":     membro.role,
        "ativo":    membro.ativo,
    }


# ── Consulentes ────────────────────────────────────────────────────────────────

@router.get("/consulentes-lista")
def list_consulentes(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulentes que já se inscreveram em giras deste terreiro."""
    from app.models.consulente import Consulente
    from app.models.inscricao_consulente import InscricaoConsulente

    consulentes = (
        db.query(Consulente)
        .join(InscricaoConsulente, InscricaoConsulente.consulente_id == Consulente.id)
        .join(GiraModel, GiraModel.id == InscricaoConsulente.gira_id)
        .filter(GiraModel.terreiro_id == user.terreiro_id)
        .distinct()
        .all()
    )

    result = []
    for c in consulentes:
        inscricoes = (
            db.query(InscricaoConsulente)
            .join(GiraModel, GiraModel.id == InscricaoConsulente.gira_id)
            .filter(
                InscricaoConsulente.consulente_id == c.id,
                GiraModel.terreiro_id == user.terreiro_id,
            )
            .all()
        )
        total      = len([i for i in inscricoes if i.status != "cancelado"])
        compareceu = len([i for i in inscricoes if i.status == "compareceu"])
        result.append({
            "id":               str(c.id),
            "nome":             c.nome,
            "telefone":         c.telefone,
            "primeira_visita":  c.primeira_visita,
            "total_inscricoes": total,
            "comparecimentos":  compareceu,
        })

    return result


@router.patch("/consulentes/{consulente_id}/notas")
def update_notas_consulente(
    consulente_id: UUID,
    data: NotasConsulenteUpdate,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Atualiza notas internas do terreiro sobre um consulente (admin/operador)."""
    from app.models.consulente import Consulente
    from app.models.inscricao_consulente import InscricaoConsulente

    consulente = (
        db.query(Consulente)
        .join(InscricaoConsulente, InscricaoConsulente.consulente_id == Consulente.id)
        .join(GiraModel, GiraModel.id == InscricaoConsulente.gira_id)
        .filter(
            Consulente.id == consulente_id,
            GiraModel.terreiro_id == user.terreiro_id,
        )
        .first()
    )
    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    notas_sanitizadas = None
    if data.notas:
        notas_sanitizadas = data.notas.strip()[:1000] or None

    consulente.notas = notas_sanitizadas
    db.commit()

    logger.info("[Consulentes] Notas atualizadas para %s por %s", consulente_id, user.id)

    return {"ok": True, "id": str(consulente.id), "notas": consulente.notas}


# ── Presença em giras FECHADAS ────────────────────────────────────────────────

@router.get("/giras/{gira_id}/presenca-membros")
def get_presenca_membros(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Para giras FECHADAS: retorna todos os membros ativos com status de presença.
    Usa InscricaoMembro — não mais InscricaoGira.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, "acesso", "publica") != "fechada":
        raise HTTPException(status_code=400, detail="Esta gira é pública — use a lista de inscrições")

    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()

    result = []
    for m in membros:
        presenca = db.query(InscricaoMembro).filter(
            and_(
                InscricaoMembro.gira_id == gira_id,
                InscricaoMembro.membro_id == m.id,
            )
        ).first()
        result.append({
            "membro_id":   str(m.id),
            "nome":        m.nome,
            "role":        m.role,
            "status":      presenca.status if presenca else "pendente",
            "presenca_id": str(presenca.id) if presenca else None,
        })

    return result


@router.post("/giras/{gira_id}/presenca-membros/{membro_id}")
def marcar_presenca_membro(
    gira_id: UUID,
    membro_id: UUID,
    data: dict,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Marca ou atualiza presença de um membro em gira fechada (admin/operador)."""
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    status = data.get("status")
    if status not in ("compareceu", "faltou", "pendente"):
        raise HTTPException(status_code=400, detail="Status inválido")

    presenca = db.query(InscricaoMembro).filter(
        and_(InscricaoMembro.gira_id == gira_id, InscricaoMembro.membro_id == membro_id)
    ).first()

    if status == "pendente":
        if presenca:
            db.delete(presenca)
            db.commit()
        return {"ok": True, "status": "pendente"}

    if presenca:
        presenca.status = status
    else:
        # posicao = total de inscrições de membro nesta gira + 1
        max_pos = db.query(InscricaoMembro).filter(
            InscricaoMembro.gira_id == gira_id
        ).count()
        presenca = InscricaoMembro(
            gira_id=gira_id,
            membro_id=membro_id,
            posicao=max_pos + 1,
            status=status,
        )
        db.add(presenca)

    db.commit()
    return {"ok": True, "status": status}


@router.post("/giras/{gira_id}/confirmar-presenca")
def confirmar_presenca_propria(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    O próprio membro confirma/cancela presença em gira FECHADA.
    Toggle: confirmar → cancelar → confirmar...
    Salva em InscricaoMembro.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, "acesso", "publica") != "fechada":
        raise HTTPException(status_code=400, detail="Esta gira é pública")

    presenca = db.query(InscricaoMembro).filter(
        and_(InscricaoMembro.gira_id == gira_id, InscricaoMembro.membro_id == user.id)
    ).first()

    if presenca:
        if presenca.status == StatusInscricaoEnum.confirmado:
            db.delete(presenca)
            db.commit()
            
            payload = {
                "title": "❌ Presença Cancelada",
                "terreiro_id": str(gira.terreiro_id),
                "body": f"{user.nome} cancelou a presença na {gira.titulo}",
                "url": f"/giras/{gira.id}",
            }

            send_push_to_terreiro(
                db=db,
                terreiro_id=gira.terreiro_id,
                payload=payload,
            )
            
            return {"ok": True, "status": "pendente", "acao": "cancelado"}

        # Admin já marcou compareceu/faltou — membro não pode reverter
        return {"ok": False, "status": presenca.status, "acao": "ja_registrado"}

    # Cria nova confirmação de presença
    max_pos = db.query(InscricaoMembro).filter(
        InscricaoMembro.gira_id == gira_id
    ).count()

    presenca = InscricaoMembro(
        gira_id=gira_id,
        membro_id=user.id,
        posicao=max_pos + 1,
        status=StatusInscricaoEnum.confirmado,
    )
    db.add(presenca)
    db.commit()
    
    payload = {
        "title": "✅ Presença Confirmada",
        "terreiro_id": str(gira.terreiro_id),
        "body": f"{user.nome} confirmou presença na {gira.titulo}",
        "url": f"/giras/{gira.id}",
    }

    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return {"ok": True, "status": "confirmado", "acao": "confirmado"}


# ── Presença em giras PÚBLICAS ────────────────────────────────────────────────

@router.get("/giras/{gira_id}/presenca-membros-publica")
def get_presenca_membros_publica(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Para giras PÚBLICAS: retorna todos os membros ativos com status de presença.
    Usa InscricaoMembro — não mais InscricaoGira.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, "acesso", "publica") != "publica":
        raise HTTPException(status_code=400, detail="Esta gira é fechada — use presenca-membros")

    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()

    result = []
    for m in membros:
        presenca = db.query(InscricaoMembro).filter(
            and_(
                InscricaoMembro.gira_id == gira_id,
                InscricaoMembro.membro_id == m.id,
            )
        ).first()
        result.append({
            "membro_id":   str(m.id),
            "nome":        m.nome,
            "role":        m.role,
            "status":      presenca.status if presenca else "pendente",
            "presenca_id": str(presenca.id) if presenca else None,
        })

    return result


@router.post("/giras/{gira_id}/confirmar-presenca-publica")
def confirmar_presenca_publica(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    O próprio membro confirma/cancela presença em gira PÚBLICA.
    Toggle: confirmar → cancelar → confirmar...
    Salva em InscricaoMembro.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, "acesso", "publica") != "publica":
        raise HTTPException(status_code=400, detail="Esta gira é fechada — use confirmar-presenca")

    presenca = db.query(InscricaoMembro).filter(
        and_(InscricaoMembro.gira_id == gira_id, InscricaoMembro.membro_id == user.id)
    ).first()

    if presenca:
        if presenca.status == StatusInscricaoEnum.confirmado:
            db.delete(presenca)
            db.commit()

            payload = {
                "title": "❌ Presença Cancelada",
                "terreiro_id": str(gira.terreiro_id),
                "body": f"{user.nome} cancelou a presença na {gira.titulo}",
                "url": f"/giras/{gira.id}",
            }
            send_push_to_terreiro(
                db=db,
                terreiro_id=gira.terreiro_id,
                payload=payload,
            )
            return {"ok": True, "status": "pendente", "acao": "cancelado"}

        return {"ok": False, "status": presenca.status, "acao": "ja_registrado"}

    # Cria nova confirmação de presença
    max_pos = db.query(InscricaoMembro).filter(
        InscricaoMembro.gira_id == gira_id
    ).count()

    presenca = InscricaoMembro(
        gira_id=gira_id,
        membro_id=user.id,
        posicao=max_pos + 1,
        status=StatusInscricaoEnum.confirmado,
    )
    db.add(presenca)
    db.commit()
    
    payload = {
        "title": "✅ Presença Confirmada",
        "terreiro_id": str(gira.terreiro_id),
        "body": f"{user.nome} confirmou presença na {gira.titulo}",
        "url": f"/giras/{gira.id}",
    }

    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )
    return {"ok": True, "status": "confirmado", "acao": "confirmado"}

# ── Novos endpoints: ranking e perfil de membros ─────────────────────────────
# Adicionar ANTES do fechamento do arquivo membros_router.py
# (após o endpoint confirmar_presenca_publica)

@router.get("/ranking")
def ranking_presenca_membros(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ranking de presença de todos os membros ativos do terreiro.

    Retorna score, comparecimentos, faltas e alerta para cada membro.
    Inclui membros sem nenhuma inscrição (score zerado).
    Ordenado: alertas primeiro, depois por score asc (piores no topo).
    """
    from app.services.presenca_membro_service import get_ranking_membros
    return get_ranking_membros(db, user.terreiro_id)


@router.get("/{membro_id}/perfil")
def perfil_membro(
    membro_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Perfil completo de um membro: score, métricas e histórico de giras.

    Valida que o membro pertence ao mesmo terreiro do usuário autenticado.
    Raises 404 se não encontrado ou se pertencer a outro terreiro.
    """
    from app.services.presenca_membro_service import get_perfil_membro
    from fastapi import HTTPException

    perfil = get_perfil_membro(db, membro_id, user.terreiro_id)
    if not perfil:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    return perfil