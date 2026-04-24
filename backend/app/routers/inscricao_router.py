"""
inscricao_router.py — AxeFlow
Endpoints de inscrição com auditoria completa.

Eventos registrados:
  PRESENCA_UPDATED    — presença marcada (INFO)
  INSCRICAO_CANCELADA — inscrição cancelada (WARNING)
  INSCRICAO_REATIVADA — inscrição reativada (INFO)
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.inscricao_schema import InscricaoPublicaRequest, PresencaUpdate
from app.services import inscricao_service
from app.services import audit_service
from app.services.presenca_consulente_service import get_scores_para_gira, get_ranking_consulentes
from app.models.usuario import Usuario
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.consulente import Consulente
from app.models.gira import Gira
from app.services.presenca_consulente_service import get_score_consulente
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, case

from app.schemas.consulente_schema import ConsulentePutSchema

# Rate limiter por IP — evita abuso dos endpoints sem autenticação
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["inscricoes"])

# GET /consulentes/search?q=denis
@router.get("/consulentes/search")
def search_consulentes(
    q: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    print("USER:", user)
    print("TERREIRO:", getattr(user, "terreiro_id", None))
    if not q:
        return []

    if not user or not user.terreiro_id:
        raise HTTPException(status_code=400, detail="Usuário inválido")

    return db.query(Consulente)\
        .filter(
            Consulente.terreiro_id == user.terreiro_id,
            Consulente.nome.ilike(f"%{q}%")
        )\
        .limit(10)\
        .all()
        
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
        score = None
        if insc and insc.consulente_id:
            score = scores.get(str(insc.consulente_id))
        item["score_presenca"] = score
        result.append(item)

    return result

@router.post("/gira/{slug}/inscrever/publico")
@limiter.limit("10/minute")  # 10 inscrições/min por IP — previne automação de spam
def inscrever_publico(
    slug: str,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Inscreve consulente em gira pública.
    Rate limit mais restritivo (10/min) pois é a operação de escrita principal.
    """
    return inscricao_service.inscrever_publico(db, slug, data)

@router.post("/gira/{gira_id}/inscrever/interno")
@limiter.limit("10/minute")  # 10 inscrições/min por IP — previne automação de spam
def inscrever_interno(
    gira_id: UUID,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Inscreve consulente em gira interna.
    Rate limit mais restritivo (10/min) pois é a operação de escrita principal.
    """
    return inscricao_service.inscrever_interno(db, gira_id, data, user.id)

@router.patch("/inscricao/{inscricao_id}/presenca")
def update_presenca(
    inscricao_id: UUID,
    data: PresencaUpdate,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    result = inscricao_service.update_presenca(db, inscricao_id, data, user.terreiro_id)

    audit_service.log(
        db, request,
        context = "inscricao",
        action  = "PRESENCA_UPDATED",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Presença atualizada: inscricao={inscricao_id} status={data.status}",
    )
    return result


@router.delete("/inscricao/{inscricao_id}")
def cancelar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    result = inscricao_service.cancelar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context = "inscricao",
        action  = "INSCRICAO_CANCELADA",
        level   = "WARNING",
        user_id = user.id,
        status  = 200,
        message = f"Inscrição cancelada: {inscricao_id}",
    )
    return result


@router.post("/inscricao/{inscricao_id}/reativar")
def reativar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    result = inscricao_service.reativar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context = "inscricao",
        action  = "INSCRICAO_REATIVADA",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Inscrição reativada: {inscricao_id} → {result.get('status')}",
    )
    return result

@router.get("/consulentes")
def lista_consulentes(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resultados = (
        db.query(
            Consulente.id,
            Consulente.nome,
            Consulente.telefone,

            func.count(InscricaoConsulente.id).label("total_inscricoes"),

            func.sum(
                case(
                    (InscricaoConsulente.status == "compareceu", 1),
                    else_=0
                )
            ).label("total_giras"),
        )
        .outerjoin(
            InscricaoConsulente,
            InscricaoConsulente.consulente_id == Consulente.id
        )
        .filter(Consulente.terreiro_id == user.terreiro_id)
        .group_by(
            Consulente.id,
            Consulente.nome,
            Consulente.telefone,
        )
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
    return get_ranking_consulentes(db, user.terreiro_id)

@router.put("/consulentes/{consulente_id}")
def atualizar_consulente(
    consulente_id: UUID,
    dados: ConsulentePutSchema,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    if user.role not in ["admin", "operador"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
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
    if user.role not in ["admin", "operador"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    consulente = db.query(Consulente).filter(
        Consulente.id == consulente_id,
        Consulente.terreiro_id == user.terreiro_id,
    ).first()
    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")
    
    db.delete(consulente)
    db.commit()

@router.get("/consulentes/{consulente_id}/perfil")
def perfil_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Perfil completo do consulente com histórico e score."""
    from datetime import date
    from app.models.inscricao_consulente import InscricaoConsulente

    c = db.query(Consulente).filter(Consulente.id == consulente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    gira_ids = {
        str(g.id): g
        for g in db.query(Gira).filter(
            Gira.terreiro_id == user.terreiro_id,
            Gira.deleted_at.is_(None),
        ).all()
    }

    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id == consulente_id,
            InscricaoConsulente.gira_id.in_(gira_ids.keys()),
        )
        .order_by(InscricaoConsulente.created_at.desc())
        .all()
    )

    historico = []
    for i in inscricoes:
        gira = gira_ids.get(str(i.gira_id))
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

    nao_cancelados  = [i for i in inscricoes if i.status != "cancelado"]
    comparecimentos = [i for i in inscricoes if i.status == "compareceu"]
    faltas          = [i for i in inscricoes if i.status == "faltou"]
    cancelamentos   = [i for i in inscricoes if i.status == "cancelado"]

    tipos: dict[str, int] = {}
    for i in comparecimentos:
        g = gira_ids.get(str(i.gira_id))
        tipo = (g.tipo or "Sem tipo") if g else "Sem tipo"
        tipos[tipo] = tipos.get(tipo, 0) + 1
    tipos_ordenados = sorted(tipos.items(), key=lambda x: x[1], reverse=True)

    datas_presenca = sorted([
        gira_ids[str(i.gira_id)].data
        for i in comparecimentos
        if str(i.gira_id) in gira_ids
    ])

    score = get_score_consulente(db, consulente_id, user.terreiro_id)

    return {
        "id":              str(c.id),
        "nome":            c.nome,
        "telefone":        c.telefone,
        "primeira_visita": c.primeira_visita,
        "cadastrado_em":   c.created_at.isoformat(),
        "notas":           c.notas,
        "score":           score,
        "comparecimentos": len(comparecimentos),
        "faltas":          len(faltas),
        "status_retorno": (
            "nunca_compareceu" if not datas_presenca
            else "ativo"       if (date.today() - datas_presenca[-1]).days <= 60
            else "morno"       if (date.today() - datas_presenca[-1]).days <= 180
            else "inativo"
        ),
        "ultima_visita":  datas_presenca[-1].isoformat() if datas_presenca else None,
        "primeira_data":  datas_presenca[0].isoformat()  if datas_presenca else None,
        "dias_ausente": (
            (date.today() - datas_presenca[-1]).days if datas_presenca else None
        ),
        "tipos_favoritos": tipos_ordenados[:3],
        "stats": {
            "total_inscricoes": len(nao_cancelados),
            "comparecimentos":  len(comparecimentos),
            "faltas":           len(faltas),
            "cancelamentos":    len(cancelamentos),
        },
        "historico": historico,
    }