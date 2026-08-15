"""
inscricao_router.py — AxeFlow
Endpoints de inscrição com auditoria completa.

Eventos registrados:
  PRESENCA_UPDATED    — presença marcada (INFO)
  INSCRICAO_CANCELADA — inscrição cancelada (WARNING)
  INSCRICAO_REATIVADA — inscrição reativada (INFO)
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.consulente import Consulente
from app.models.gira import Gira
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.usuario import Usuario
from app.schemas.consulente_schema import ConsulentePutSchema
from app.schemas.inscricao_schema import InscricaoPublicaRequest, PresencaUpdate
from app.services import audit_service, inscricao_service
from app.services.presenca_consulente_service import (
    get_ranking_consulentes,
    get_score_consulente,
    get_scores_para_gira,
)
from app.utils.datetime_utils import utcnow
from app.utils.enuns import StatusInscricaoEnum

# Rate limiter por IP — evita abuso dos endpoints sem autenticação
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["inscricoes"])


# ── Busca de consulentes ───────────────────────────────────────────────────────

@router.get("/consulentes/search")
def search_consulentes(
    q: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Busca consulentes do terreiro por nome (mínimo 1 caractere)."""
    if not q or not user.terreiro_id:
        return []

    return (
        db.query(Consulente)
        .filter(
            Consulente.terreiro_id == user.terreiro_id,
            Consulente.nome.ilike(f"%{q}%")
        )
        .limit(10)
        .all()
    )


# ── Inscrições de uma gira ─────────────────────────────────────────────────────

@router.get("/giras/{gira_id}/inscricoes")
def list_inscricoes(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista inscrições de consulentes com score de presença histórico."""
    inscricoes = inscricao_service.list_inscricoes(db, gira_id, user.terreiro_id)
    scores = get_scores_para_gira(db, gira_id, user.terreiro_id)

    result = []
    for i in inscricoes:
        item = i.model_dump() if hasattr(i, "model_dump") else dict(i)
        insc = db.query(InscricaoConsulente).filter(InscricaoConsulente.id == i.id).first()
        item["score_presenca"] = scores.get(str(insc.consulente_id)) if insc and insc.consulente_id else None
        result.append(item)

    return result


# ── Inscrição pública (sem autenticação) ───────────────────────────────────────

@router.post("/gira/{slug}/inscrever/publico")
@limiter.limit("10/minute")
def inscrever_publico(
    slug: str,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Inscreve consulente em gira pública.
    Rate limit restritivo (10/min) — operação de escrita principal sem autenticação.
    """
    return inscricao_service.inscrever_publico(db, slug, data)


# ── Inscrição interna (autenticada) ───────────────────────────────────────────

@router.post("/gira/{gira_id}/inscrever/interno")
@limiter.limit("10/minute")
def inscrever_interno(
    gira_id: UUID,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Inscreve consulente em gira interna pelo painel administrativo."""
    return inscricao_service.inscrever_interno(db, gira_id, data, user.id)


# ── Presença e cancelamento ────────────────────────────────────────────────────

@router.patch("/inscricao/{inscricao_id}/presenca")
def update_presenca(
    inscricao_id: UUID,
    data: PresencaUpdate,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Marca presença ou falta de um consulente em uma gira."""
    result = inscricao_service.update_presenca(db, inscricao_id, data, user.terreiro_id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="PRESENCA_UPDATED",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Presença atualizada: inscricao={inscricao_id} status={data.status}",
    )
    return result


@router.delete("/inscricao/{inscricao_id}")
def cancelar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Cancela uma inscrição e registra no audit log."""
    result = inscricao_service.cancelar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="INSCRICAO_CANCELADA",
        level="WARNING",
        user_id=user.id,
        status=200,
        message=f"Inscrição cancelada: {inscricao_id}",
    )
    return result


@router.post("/inscricao/{inscricao_id}/reativar")
def reativar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Reativa uma inscrição cancelada e registra no audit log."""
    result = inscricao_service.reativar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="INSCRICAO_REATIVADA",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Inscrição reativada: {inscricao_id} → {result.get('status')}",
    )
    return result


# ── Listagem e ranking de consulentes ─────────────────────────────────────────

@router.get("/consulentes")
def lista_consulentes(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista consulentes do terreiro com contagem de inscrições e comparecimentos."""
    resultados = (
        db.query(
            Consulente.id,
            Consulente.nome,
            Consulente.telefone,
            func.count(InscricaoConsulente.id).label("total_inscricoes"),
            func.sum(
                case(
                    (InscricaoConsulente.status == StatusInscricaoEnum.compareceu, 1),
                    else_=0
                )
            ).label("total_giras"),
        )
        .outerjoin(InscricaoConsulente, InscricaoConsulente.consulente_id == Consulente.id)
        .filter(
            Consulente.terreiro_id == user.terreiro_id,
            Consulente.deleted_at.is_(None)
        )
        .group_by(Consulente.id, Consulente.nome, Consulente.telefone)
        .order_by(Consulente.nome.asc())
        .all()
    )

    return [
        {
            "id": r.id,
            "nome": r.nome,
            "telefone": r.telefone,
            "total_inscricoes": r.total_inscricoes,
            "total_giras": r.total_giras,
        }
        for r in resultados
    ]


@router.get("/consulentes/ranking")
def ranking_presenca(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ranking de confiabilidade de todos os consulentes do terreiro."""
    return get_ranking_consulentes(db, user.terreiro_id)


# ── CRUD de consulentes ────────────────────────────────────────────────────────

@router.put("/consulentes/{consulente_id}")
def atualizar_consulente(
    consulente_id: UUID,
    dados: ConsulentePutSchema,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Atualiza dados cadastrais de um consulente."""
    consulente = db.query(Consulente).filter(
        Consulente.id == consulente_id,
        Consulente.terreiro_id == user.terreiro_id,
    ).first()

    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(consulente, campo, valor)

    db.commit()
    db.refresh(consulente)
    return consulente


@router.delete("/consulentes/{consulente_id}", status_code=204)
def deletar_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Soft delete do consulente e cancelamento de todas as suas inscrições."""
    consulente = db.query(Consulente).filter(
        Consulente.id == consulente_id,
        Consulente.terreiro_id == user.terreiro_id,
        Consulente.deleted_at.is_(None)
    ).first()

    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    # Cancela todas as inscrições ativas
    db.query(InscricaoConsulente).filter(
        InscricaoConsulente.consulente_id == consulente_id
    ).update(
        {
            InscricaoConsulente.status: "cancelado",
            InscricaoConsulente.updated_at: utcnow(),
            InscricaoConsulente.deleted_at: utcnow(),
        },
        synchronize_session=False
    )

    consulente.deleted_at = utcnow()
    db.commit()


# ── Perfil individual de consulente ───────────────────────────────────────────

@router.get("/consulentes/{consulente_id}/perfil")
def perfil_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Perfil completo do consulente com histórico de giras e score de presença."""
    consulente = db.query(Consulente).filter(
        Consulente.id == consulente_id,
        Consulente.terreiro_id == user.terreiro_id,
    ).first()

    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    # Carrega giras ativas do terreiro para montar o histórico
    giras_map = {
        str(g.id): g
        for g in db.query(Gira).filter(
            Gira.terreiro_id == user.terreiro_id,
            Gira.deleted_at.is_(None),
        ).all()
    }

    # Histórico de inscrições do consulente, mais recente primeiro
    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id == consulente_id,
            InscricaoConsulente.gira_id.in_(giras_map.keys()),
        )
        .order_by(InscricaoConsulente.created_at.desc())
        .all()
    )

    # Agrega métricas e monta histórico em um único loop
    total = comparecimentos = faltas = cancelamentos = 0
    datas_presenca = []
    tipos: dict[str, int] = {}
    historico = []

    for i in inscricoes:
        gira = giras_map.get(str(i.gira_id))
        if not gira:
            continue

        historico.append({
            "inscricao_id": str(i.id),
            "gira_id":      str(gira.id),
            "gira_titulo":  gira.titulo,
            "gira_tipo":    gira.tipo,
            "gira_data":    gira.data.isoformat(),
            "posicao":      i.posicao,
            "status":       i.status,
            "inscrito_em":  i.created_at.isoformat(),
            "observacoes":  i.observacoes,
        })

        if i.status == StatusInscricaoEnum.cancelado:
            cancelamentos += 1
            continue

        total += 1
        if i.status == StatusInscricaoEnum.compareceu:
            comparecimentos += 1
            datas_presenca.append(gira.data)
            tipo = gira.tipo or "Sem tipo"
            tipos[tipo] = tipos.get(tipo, 0) + 1
        elif i.status == StatusInscricaoEnum.faltou:
            faltas += 1

    datas_presenca.sort()

    # Status de engajamento baseado na última visita
    if not datas_presenca:
        status_retorno = "nunca_compareceu"
        dias_ausente = None
        ultima_visita = None
        primeira_data = None
    else:
        dias_ausente = (date.today() - datas_presenca[-1]).days
        ultima_visita = datas_presenca[-1].isoformat()
        primeira_data = datas_presenca[0].isoformat()

        if dias_ausente <= 60:
            status_retorno = "ativo"
        elif dias_ausente <= 180:
            status_retorno = "morno"
        else:
            status_retorno = "inativo"

    score = get_score_consulente(db, consulente_id, user.terreiro_id)
    tipos_ordenados = sorted(tipos.items(), key=lambda x: x[1], reverse=True)

    return {
        "id":              str(consulente.id),
        "nome":            consulente.nome,
        "telefone":        consulente.telefone,
        "primeira_visita": consulente.primeira_visita,
        "cadastrado_em":   consulente.created_at.isoformat(),
        "notas":           consulente.notas,
        "score":           score,
        "status_retorno":  status_retorno,
        "ultima_visita":   ultima_visita,
        "primeira_data":   primeira_data,
        "dias_ausente":    dias_ausente,
        "tipos_favoritos": tipos_ordenados[:3],
        "stats": {
            "total_inscricoes": total,
            "comparecimentos":  comparecimentos,
            "faltas":           faltas,
            "cancelamentos":    cancelamentos,
        },
        "historico": historico,
    }