"""
public_router.py — AxeFlow
Endpoints públicos (sem autenticação): inscrição de consulentes via link compartilhável.

Rate limiting aplicado por IP para prevenir spam.
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.models.gira import Gira, StatusGiraEnum
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from app.schemas.inscricao_schema import InscricaoPublicaRequest
from app.services import inscricao_service
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/public", tags=["public"])

# Rate limiter por IP — evita abuso dos endpoints sem autenticação
limiter = Limiter(key_func=get_remote_address)


@router.get("/gira/{slug}")
@limiter.limit("60/minute")  # 60 leituras/min por IP — suficiente para uso normal
def get_gira_publica(slug: str, request: Request, db: Session = Depends(get_db)):
    """
    Retorna dados públicos de uma gira para exibição na página de inscrição.
    Giras fechadas ou com soft delete retornam 404.
    """
    gira = db.query(Gira).filter(
        Gira.slug_publico == slug,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Giras fechadas não têm página pública
    if getattr(gira, 'acesso', 'publica') == 'fechada':
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    total_inscritos = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status == StatusInscricaoEnum.confirmado,
    ).count()

    lista_espera = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status == StatusInscricaoEnum.lista_espera,
    ).count()

    vagas_disponiveis = max(0, gira.limite_consulentes - total_inscritos)
    lista_aberta = (
        gira.abertura_lista is not None
        and gira.fechamento_lista is not None
        and gira.abertura_lista <= agora <= gira.fechamento_lista
        and gira.status == StatusGiraEnum.aberta
    )

    return {
        "id":                 str(gira.id),
        "titulo":             gira.titulo,
        "tipo":               gira.tipo,
        "data":               gira.data.isoformat(),
        "horario":            gira.horario.strftime("%H:%M"),
        "limite_consulentes": gira.limite_consulentes,
        "vagas_disponiveis":  vagas_disponiveis,
        "lista_espera":       lista_espera,         # quantos estão na fila de espera
        "lista_aberta":       lista_aberta,
        "status":             gira.status,
        "abertura_lista":     gira.abertura_lista.isoformat() if gira.abertura_lista else None,
        "fechamento_lista":   gira.fechamento_lista.isoformat() if gira.fechamento_lista else None,
    }


@router.post("/gira/{slug}/inscrever")
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
