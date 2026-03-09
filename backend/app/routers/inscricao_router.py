from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.inscricao_schema import PresencaUpdate
from app.services import inscricao_service
from app.services.presenca_service import get_scores_para_gira, get_ranking_consulentes
from app.models.usuario import Usuario

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
        from app.models.inscricao import InscricaoGira
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
