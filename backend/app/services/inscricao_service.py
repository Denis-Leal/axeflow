from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException
from uuid import UUID
from datetime import datetime
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from app.schemas.inscricao_schema import InscricaoPublicaRequest, InscricaoResponse, PresencaUpdate
from app.utils.validators import normalize_phone, validate_phone
from app.services.push_service import broadcast_push_notification


def list_inscricoes(db: Session, gira_id: UUID, terreiro_id: UUID):
    gira = db.query(Gira).filter(Gira.id == gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    inscricoes = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira_id
    ).order_by(InscricaoGira.posicao).all()
    result = []
    for i in inscricoes:
        r = InscricaoResponse(
            id=i.id,
            posicao=i.posicao,
            status=i.status,
            created_at=i.created_at,
            consulente_nome=i.consulente.nome if i.consulente else None,
            consulente_telefone=i.consulente.telefone if i.consulente else None,
            observacoes=i.observacoes,
        )
        result.append(r)
    return result


def inscrever_publico(db: Session, slug: str, data: InscricaoPublicaRequest):
    gira = db.query(Gira).filter(Gira.slug_publico == slug).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    if gira.abertura_lista and agora < gira.abertura_lista:
        raise HTTPException(status_code=400, detail="Lista ainda não foi aberta")
    if gira.fechamento_lista and agora > gira.fechamento_lista:
        raise HTTPException(status_code=400, detail="Lista encerrada")

    if not validate_phone(data.telefone):
        raise HTTPException(status_code=400, detail="Telefone inválido")

    telefone = normalize_phone(data.telefone)

    # ── Busca ou cria consulente ───────────────────────────────────────────────
    consulente = db.query(Consulente).filter(Consulente.telefone == telefone).first()
    if not consulente:
        consulente = Consulente(nome=data.nome, telefone=telefone, primeira_visita=True)
        db.add(consulente)
        db.flush()
    else:
        consulente.primeira_visita = False

    # ── Verifica duplicata ────────────────────────────────────────────────────
    ja_inscrito = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.consulente_id == consulente.id,
        InscricaoGira.status != StatusInscricaoEnum.cancelado
    ).first()
    if ja_inscrito:
        raise HTTPException(status_code=400, detail="Telefone já inscrito nesta gira")

    # ── Controle de concorrência: lock na linha da gira ───────────────────────
    # SELECT FOR UPDATE garante que duas inscrições simultâneas não ultrapassem o limite
    db.execute(
        text("SELECT id FROM giras WHERE id = :id FOR UPDATE"),
        {"id": str(gira.id)}
    )

    # Recontagem após o lock (valor mais recente)
    total_confirmados = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status.in_([
            StatusInscricaoEnum.confirmado,
            StatusInscricaoEnum.lista_espera,
        ])
    ).count()

    # Determina status: confirmado se tem vaga, lista_espera se lotou
    vagas_ocupadas = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status == StatusInscricaoEnum.confirmado
    ).count()

    if vagas_ocupadas < gira.limite_consulentes:
        status_inscricao = StatusInscricaoEnum.confirmado
    else:
        status_inscricao = StatusInscricaoEnum.lista_espera

    inscricao = InscricaoGira(
        gira_id=gira.id,
        consulente_id=consulente.id,
        posicao=total_confirmados + 1,
        status=status_inscricao,
    )
    db.add(inscricao)
    db.commit()
    db.refresh(inscricao)

    # Push notification
    broadcast_push_notification(
        title="👤 Nova Inscrição",
        body=f"{data.nome} se inscreveu na {gira.titulo} (vaga {vagas_ocupadas + 1}/{gira.limite_consulentes})",
        url=f"/giras/{gira.id}",
    )

    return InscricaoResponse(
        id=inscricao.id,
        posicao=inscricao.posicao,
        status=inscricao.status,
        created_at=inscricao.created_at,
        consulente_nome=consulente.nome,
        consulente_telefone=consulente.telefone,
    )


def update_presenca(db: Session, inscricao_id: UUID, data: PresencaUpdate, terreiro_id: UUID):
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    gira = db.query(Gira).filter(Gira.id == inscricao.gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if data.status not in ["compareceu", "faltou"]:
        raise HTTPException(status_code=400, detail="Status inválido")
    inscricao.status = data.status
    db.commit()
    db.refresh(inscricao)
    return {"ok": True, "status": inscricao.status}


def cancelar_inscricao(db: Session, inscricao_id: UUID, terreiro_id: UUID):
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    gira = db.query(Gira).filter(Gira.id == inscricao.gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    nome = inscricao.consulente.nome if inscricao.consulente else "Consulente"
    inscricao.status = StatusInscricaoEnum.cancelado
    db.commit()

    # Se alguém estava em lista_espera, promove o primeiro
    _promover_lista_espera(db, gira.id)

    broadcast_push_notification(
        title="❌ Inscrição Cancelada",
        body=f"{nome} cancelou a inscrição na {gira.titulo}",
        url=f"/giras/{gira.id}",
    )

    return {"ok": True}


def _promover_lista_espera(db: Session, gira_id: UUID):
    """Quando alguém cancela, promove o primeiro da lista de espera para confirmado."""
    proximo = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira_id,
        InscricaoGira.status == StatusInscricaoEnum.lista_espera,
    ).order_by(InscricaoGira.posicao).first()

    if proximo:
        proximo.status = StatusInscricaoEnum.confirmado
        db.commit()
        broadcast_push_notification(
            title="🎉 Vaga Disponível!",
            body=f"Uma vaga abriu e você foi promovido para a lista confirmada!",
            url=f"/giras/{gira_id}",
        )
