import logging
from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao_consulente import InscricaoConsulente
from app.schemas import consulente_schema
from app.services.presenca_consulente_service import (
    get_ranking_consulentes,
    get_score_consulente,
)
from app.utils.datetime_utils import utcnow
from app.utils.enuns import StatusInscricaoEnum


logger = logging.getLogger(__name__)

def listar_consulentes(db: Session, terreiro_id: UUID) -> list[dict]:
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
                Consulente.terreiro_id == terreiro_id,
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

def buscar_consulentes(
    db: Session,
    terreiro_id: UUID,
    query: str,
) -> list[Consulente]:
    """Busca consulentes ativos do terreiro por nome."""

    if not query:
        return []

    return (
        db.query(Consulente)
        .filter(
            Consulente.terreiro_id == terreiro_id,
            Consulente.deleted_at.is_(None),
            Consulente.nome.ilike(f"%{query}%"),
        )
        .limit(10)
        .all()
    )

def ranking_consulentes(
    db: Session,
    terreiro_id: UUID,
):
    """Retorna o ranking de confiabilidade dos consulentes do terreiro."""

    return get_ranking_consulentes(
        db,
        terreiro_id,
    )
    
def atualizar_consulente(
    db: Session,
    consulente_id: UUID,
    terreiro_id: UUID,
    dados: consulente_schema.ConsulentePutSchema,
):
    """Atualiza dados cadastrais de um consulente."""

    consulente = (
        db.query(Consulente)
        .filter(
            Consulente.id == consulente_id,
            Consulente.terreiro_id == terreiro_id,
            Consulente.deleted_at.is_(None),
        )
        .first()
    )

    if not consulente:
        raise HTTPException(
            status_code=404,
            detail="Consulente não encontrado",
        )

    for campo, valor in dados.model_dump(
        exclude_unset=True
    ).items():
        setattr(consulente, campo, valor)

    db.commit()
    db.refresh(consulente)

    return consulente

def atualizar_notas_consulentes(db: Session, consulente_id: UUID, terreiro_id: UUID, user_id: UUID, data: consulente_schema.NotasConsulenteUpdate) -> dict:
    consulente = (db.query(Consulente).filter(
                Consulente.id == consulente_id,
                Consulente.terreiro_id == terreiro_id,
            ).first())
    if not consulente:
            raise HTTPException(status_code=404, detail="Consulente não encontrado")
    
    notas_sanitizadas = None
    if data.notas:
        notas_sanitizadas = data.notas.strip()[:1000] or None

    consulente.notas = notas_sanitizadas
    db.commit()

    logger.info("[Consulentes] Notas atualizadas para %s por %s", consulente_id, user_id)
    
    return {"ok": True, "id": str(consulente.id), "notas": consulente.notas}

def deletar_consulente(
    db: Session,
    consulente_id: UUID,
    terreiro_id: UUID,
) -> None:
    """Realiza soft delete do consulente e cancela suas inscrições."""

    consulente = (
        db.query(Consulente)
        .filter(
            Consulente.id == consulente_id,
            Consulente.terreiro_id == terreiro_id,
            Consulente.deleted_at.is_(None),
        )
        .first()
    )

    if not consulente:
        raise HTTPException(
            status_code=404,
            detail="Consulente não encontrado",
        )

    agora = utcnow()

    db.query(InscricaoConsulente).filter(
        InscricaoConsulente.consulente_id == consulente_id,
        InscricaoConsulente.deleted_at.is_(None),
    ).update(
        {
            InscricaoConsulente.status: StatusInscricaoEnum.cancelado,
            InscricaoConsulente.updated_at: agora,
            InscricaoConsulente.deleted_at: agora,
        },
        synchronize_session=False,
    )

    consulente.deleted_at = agora

    db.commit()
    
def obter_perfil_consulente(
    db: Session,
    consulente_id: UUID,
    terreiro_id: UUID,
) -> dict:
    """Retorna o perfil completo do consulente e seu histórico."""

    consulente = (
        db.query(Consulente)
        .filter(
            Consulente.id == consulente_id,
            Consulente.terreiro_id == terreiro_id,
            Consulente.deleted_at.is_(None),
        )
        .first()
    )

    if not consulente:
        raise HTTPException(
            status_code=404,
            detail="Consulente não encontrado",
        )

    giras = (
        db.query(Gira)
        .filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        )
        .all()
    )

    giras_map = {
        str(gira.id): gira
        for gira in giras
    }

    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id == consulente_id,
            InscricaoConsulente.gira_id.in_(giras_map.keys()),
        )
        .order_by(
            InscricaoConsulente.created_at.desc()
        )
        .all()
    )

    total = 0
    comparecimentos = 0
    faltas = 0
    cancelamentos = 0

    datas_presenca = []
    tipos: dict[str, int] = {}
    historico = []

    for inscricao in inscricoes:
        gira = giras_map.get(str(inscricao.gira_id))

        if not gira:
            continue

        historico.append(
            {
                "inscricao_id": str(inscricao.id),
                "gira_id": str(gira.id),
                "gira_titulo": gira.titulo,
                "gira_tipo": gira.tipo,
                "gira_data": gira.data.isoformat(),
                "posicao": inscricao.posicao,
                "status": inscricao.status,
                "inscrito_em": inscricao.created_at.isoformat(),
                "observacoes": inscricao.observacoes,
            }
        )

        if inscricao.status == StatusInscricaoEnum.cancelado:
            cancelamentos += 1
            continue

        total += 1

        if inscricao.status == StatusInscricaoEnum.compareceu:
            comparecimentos += 1
            datas_presenca.append(gira.data)

            tipo = gira.tipo or "Sem tipo"
            tipos[tipo] = tipos.get(tipo, 0) + 1

        elif inscricao.status == StatusInscricaoEnum.faltou:
            faltas += 1

    datas_presenca.sort()

    if not datas_presenca:
        status_retorno = "nunca_compareceu"
        dias_ausente = None
        ultima_visita = None
        primeira_data = None

    else:
        dias_ausente = (
            date.today() - datas_presenca[-1]
        ).days

        ultima_visita = datas_presenca[-1].isoformat()
        primeira_data = datas_presenca[0].isoformat()

        if dias_ausente <= 60:
            status_retorno = "ativo"
        elif dias_ausente <= 180:
            status_retorno = "morno"
        else:
            status_retorno = "inativo"

    score = get_score_consulente(
        db,
        consulente_id,
        terreiro_id,
    )

    tipos_ordenados = sorted(
        tipos.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    return {
        "id": str(consulente.id),
        "nome": consulente.nome,
        "telefone": consulente.telefone,
        "primeira_visita": consulente.primeira_visita,
        "cadastrado_em": consulente.created_at.isoformat(),
        "notas": consulente.notas,
        "score": score,
        "status_retorno": status_retorno,
        "ultima_visita": ultima_visita,
        "primeira_data": primeira_data,
        "dias_ausente": dias_ausente,
        "tipos_favoritos": tipos_ordenados[:3],
        "stats": {
            "total_inscricoes": total,
            "comparecimentos": comparecimentos,
            "faltas": faltas,
            "cancelamentos": cancelamentos,
        },
        "historico": historico,
    }