from fastapi import APIRouter, Depends, Request
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.models.gira import Gira
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from app.schemas.inscricao_schema import InscricaoPublicaRequest
from app.services import inscricao_service
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/public", tags=["public"])
limiter = Limiter(key_func=get_remote_address)

@router.get("/gira/{slug}")
def get_gira_publica(slug: str, db: Session = Depends(get_db)):
    gira = db.query(Gira).filter(Gira.slug_publico == slug).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Gira fechada não tem página pública
    if getattr(gira, 'acesso', 'publica') == 'fechada':
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    total_inscritos = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status != StatusInscricaoEnum.cancelado
    ).count()

    vagas_disponiveis = max(0, gira.limite_consulentes - total_inscritos)
    lista_aberta = gira.abertura_lista <= agora <= gira.fechamento_lista

    return {
        "id": str(gira.id),
        "titulo": gira.titulo,
        "tipo": gira.tipo,
        "data": gira.data.isoformat(),
        "horario": gira.horario.strftime("%H:%M"),
        "limite_consulentes": gira.limite_consulentes,
        "vagas_disponiveis": vagas_disponiveis,
        "lista_aberta": lista_aberta,
        "status": gira.status,
        "abertura_lista": gira.abertura_lista.isoformat(),
        "fechamento_lista": gira.fechamento_lista.isoformat(),
    }

@router.post("/gira/{slug}/inscrever")
def inscrever_publico(slug: str, data: InscricaoPublicaRequest, db: Session = Depends(get_db)):
    return inscricao_service.inscrever_publico(db, slug, data)
