from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.inscricao_schema import PresencaUpdate
from app.services import inscricao_service
from app.services.presenca_service import get_scores_para_gira, get_ranking_consulentes
from app.models.usuario import Usuario
from app.models.inscricao import InscricaoGira
from app.models.consulente import Consulente
from app.models.gira import Gira
from app.services.presenca_service import get_score_consulente
from fastapi import HTTPException

router = APIRouter(tags=["inscricoes"])


@router.get("/giras/{gira_id}/inscricoes")
def list_inscricoes(gira_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista inscrições enriquecidas com score de presença histórico de cada consulente."""
    inscricoes = inscricao_service.list_inscricoes(db, gira_id, user.terreiro_id)
    scores = get_scores_para_gira(db, gira_id, user.terreiro_id)

    result = []
    for i in inscricoes:
        item = i.model_dump() if hasattr(i, "model_dump") else dict(i)
        # Buscar score pelo consulente_id — precisamos do id, não só do telefone
        # O score está keyed por consulente_id (str UUID)
        score = None
        # Localizar o consulente_id via inscricao
        insc = db.query(InscricaoGira).filter(InscricaoGira.id == i.id).first()
        if insc:
            score = scores.get(str(insc.consulente_id))
        item["score_presenca"] = score
        result.append(item)

    return result


@router.patch("/inscricao/{inscricao_id}/presenca")
def update_presenca(inscricao_id: UUID, data: PresencaUpdate, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return inscricao_service.update_presenca(db, inscricao_id, data, user.terreiro_id)


@router.delete("/inscricao/{inscricao_id}")
def cancelar_inscricao(inscricao_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return inscricao_service.cancelar_inscricao(db, inscricao_id, user.terreiro_id)


@router.get("/consulentes/ranking")
def ranking_presenca(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ranking de confiabilidade de todos os consulentes do terreiro."""
    return get_ranking_consulentes(db, user.terreiro_id)


@router.get("/consulentes/{consulente_id}/perfil")
def perfil_consulente(consulente_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Perfil completo do consulente — CRM espiritual.
    Retorna histórico completo de visitas, frequência, padrões e score.
    """

    c = db.query(Consulente).filter(Consulente.id == consulente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    # Apenas giras deste terreiro
    gira_ids = {
        str(g.id): g
        for g in db.query(Gira).filter(Gira.terreiro_id == user.terreiro_id).all()
    }

    inscricoes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.consulente_id == consulente_id,
            InscricaoGira.gira_id.in_(gira_ids.keys()),
        )
        .order_by(InscricaoGira.created_at.desc())
        .all()
    )

    # Histórico detalhado de cada visita
    historico = []
    ultima_presenca = None
    for i in inscricoes:
        gira = gira_ids.get(str(i.gira_id))
        if not gira:
            continue
        entrada = {
            "inscricao_id": str(i.id),
            "gira_id":      str(gira.id),
            "gira_titulo":  gira.titulo,
            "gira_tipo":    gira.tipo,
            "gira_data":    gira.data.isoformat(),
            "posicao":      i.posicao,
            "status":       i.status,
            "inscrito_em":  i.created_at.isoformat(),
        }
        historico.append(entrada)
        if i.status == "compareceu" and ultima_presenca is None:
            ultima_presenca = gira.data.isoformat()

    # Estatísticas gerais
    nao_cancelados = [i for i in inscricoes if i.status != "cancelado"]
    comparecimentos = [i for i in inscricoes if i.status == "compareceu"]
    faltas          = [i for i in inscricoes if i.status == "faltou"]
    cancelamentos   = [i for i in inscricoes if i.status == "cancelado"]

    # Tipos de gira que mais frequentou
    tipos = {}
    for i in comparecimentos:
        g = gira_ids.get(str(i.gira_id))
        tipo = (g.tipo or "Sem tipo") if g else "Sem tipo"
        tipos[tipo] = tipos.get(tipo, 0) + 1
    tipos_ordenados = sorted(tipos.items(), key=lambda x: x[1], reverse=True)

    # Primeira e última visita
    datas_presenca = sorted([
        gira_ids[str(i.gira_id)].data
        for i in comparecimentos
        if str(i.gira_id) in gira_ids
    ])

    score = get_score_consulente(db, consulente_id, user.terreiro_id)

    return {
        "id":             str(c.id),
        "nome":           c.nome,
        "telefone":       c.telefone,
        "primeira_visita": c.primeira_visita,
        "cadastrado_em":  c.created_at.isoformat() if c.created_at else None,

        # Score de confiabilidade
        "score": score,

        # Estatísticas
        "stats": {
            "total_inscricoes":  len(nao_cancelados),
            "comparecimentos":   len(comparecimentos),
            "faltas":            len(faltas),
            "cancelamentos":     len(cancelamentos),
            "primeira_presenca": datas_presenca[0].isoformat() if datas_presenca else None,
            "ultima_presenca":   datas_presenca[-1].isoformat() if datas_presenca else None,
            "tipos_favoritos":   tipos_ordenados[:3],
        },

        # Histórico completo
        "historico": historico,
    }
