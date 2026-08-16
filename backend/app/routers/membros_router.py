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
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import and_
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.models.inscricao_membro import InscricaoMembro
from app.utils.enuns import StatusInscricaoEnum
from app.services.push_service import send_push_to_terreiro
from app.models.gira import Gira as GiraModel
from app.services import membros_service
from app.schemas.membros_schema import MembroCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/membros", tags=["membros"])

# ── Membros ────────────────────────────────────────────────────────────────────

@router.get("")
def list_membros(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db),):
    """Lista todos os membros ativos do terreiro."""
    return membros_service.list_membros(db=db, terreiro_id=user.terreiro_id)


@router.post("")
def create_membro(
    data: MembroCreate,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    return membros_service.create_membro(
        db=db, 
        terreiro_id=user.terreiro_id, 
        nome=data.nome, 
        email=data.email, 
        senha=data.senha, 
        telefone=data.telefone, 
        role=data.role, 
        convidado_por=user.nome
    )


@router.put("/{membro_id}")
def update_membro(
    membro_id: UUID,
    data: dict,
    user: Usuario = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return membros_service.update_membro(
        db=db,
        membro_id=membro_id,
        terreiro_id=user.terreiro_id,
        nome= data["nome"],
        role=data["role"],
        telefone=data["telefone"],
        current_user_id=user.id,
    )

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

    perfil = membros_service.get_perfil_membro(db, membro_id, user.terreiro_id)
    if not perfil:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    return perfil