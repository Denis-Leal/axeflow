"""
inscricao_service.py — AxeFlow

CORREÇÕES:
  - inscrever_publico: distingue inscrição ATIVA de CANCELADA.
      Antes: query filtrava status != cancelado, então ao tentar reinserir
      o banco lançava IntegrityError (UniqueConstraint) → 500.
      Agora: busca qualquer inscrição existente e retorna 400 com mensagem
      específica quando está cancelada, orientando o consulente a contatar
      o terreiro.

  - reativar_inscricao: NOVA função pública.
      Admin reativa uma inscrição cancelada. O consulente volta para
      confirmado (se ainda há vaga) ou lista_espera (se lotada).
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException
from uuid import UUID
from datetime import datetime

from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from app.schemas.inscricao_schema import InscricaoPublicaRequest, InscricaoResponse, PresencaUpdate
from app.utils.validators import normalize_phone, validate_phone
from app.services.push_service import send_push_to_terreiro


def list_inscricoes(db: Session, gira_id: UUID, terreiro_id: UUID) -> list[InscricaoResponse]:
    """
    Lista inscrições de CONSULENTES de uma gira, ordenadas por posição.
    Filtra apenas consulente_id IS NOT NULL — membros têm lista própria.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    inscricoes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.gira_id == gira_id,
            InscricaoGira.consulente_id.isnot(None),
        )
        .order_by(InscricaoGira.posicao)
        .all()
    )

    return [
        InscricaoResponse(
            id=i.id,
            posicao=i.posicao,
            status=i.status,
            created_at=i.created_at,
            consulente_nome=i.consulente.nome if i.consulente else None,
            consulente_telefone=i.consulente.telefone if i.consulente else None,
            observacoes=i.observacoes,
        )
        for i in inscricoes
    ]


def _promover_lista_espera(db: Session, gira_id: UUID, terreiro_id: UUID) -> InscricaoGira | None:
    """
    Promove 1 consulente da lista de espera para confirmado.

    Uso interno: chamado por cancelar_inscricao.
    Para promoção em lote (aumento de vagas), use promover_fila_em_lote().
    SELECT FOR UPDATE evita race condition em cancelamentos simultâneos.
    """
    proximo = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.gira_id == gira_id,
            InscricaoGira.consulente_id.isnot(None),
            InscricaoGira.status == StatusInscricaoEnum.lista_espera,
        )
        .order_by(InscricaoGira.posicao)  # FIFO
        .with_for_update()
        .first()
    )

    if not proximo:
        return None

    proximo.status = StatusInscricaoEnum.confirmado
    db.flush()
    return proximo


def promover_fila_em_lote(
    db: Session,
    gira_id: UUID,
    vagas_abertas: int,
) -> list[dict]:
    """
    Promove até `vagas_abertas` pessoas da lista de espera para confirmado.

    Chamado pelo gira_service.update_gira() quando o limite de vagas aumenta.
    Retorna lista de { nome, telefone, posicao } para o frontend notificar via WA.
    """
    if vagas_abertas <= 0:
        return []

    proximos = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.gira_id == gira_id,
            InscricaoGira.consulente_id.isnot(None),
            InscricaoGira.status == StatusInscricaoEnum.lista_espera,
        )
        .order_by(InscricaoGira.posicao)
        .limit(vagas_abertas)
        .with_for_update()
        .all()
    )

    promovidos = []
    for inscricao in proximos:
        inscricao.status = StatusInscricaoEnum.confirmado
        db.flush()
        if inscricao.consulente:
            promovidos.append({
                "nome":     inscricao.consulente.nome,
                "telefone": inscricao.consulente.telefone,
                "posicao":  inscricao.posicao,
            })

    return promovidos


def inscrever_publico(db: Session, slug: str, data: InscricaoPublicaRequest):
    """
    Inscreve consulente em gira pública via link público.

    CORREÇÃO: distingue inscrição ativa de cancelada.

    Fluxo de validação de duplicatas:
      1. Busca qualquer inscrição existente (inclusive cancelada) pelo consulente + gira
      2. Se status == cancelado → 400 com mensagem orientando a contatar o terreiro
         (antes: filtrava != cancelado e o banco lançava IntegrityError → 500)
      3. Se status ativo (confirmado, lista_espera, etc.) → 400 "já inscrito"
    """
    gira = db.query(Gira).filter(
        Gira.slug_publico == slug,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    if agora < gira.abertura_lista:
        raise HTTPException(status_code=400, detail="Lista ainda não foi aberta")
    if agora > gira.fechamento_lista:
        raise HTTPException(status_code=400, detail="Lista encerrada")

    if not validate_phone(data.telefone):
        raise HTTPException(status_code=400, detail="Telefone inválido")
    telefone = normalize_phone(data.telefone)

    # ── Dupla validação de primeira_visita ────────────────────────────────────
    consulente = db.query(Consulente).filter(Consulente.telefone == telefone).first()
    if not consulente:
        primeira_visita = data.primeira_visita if data.primeira_visita is not None else True
        consulente = Consulente(
            nome=data.nome,
            telefone=telefone,
            primeira_visita=primeira_visita,
        )
        db.add(consulente)
        db.flush()
    else:
        consulente.primeira_visita = False
    # ── Fim da dupla validação ────────────────────────────────────────────────

    # Verifica inscrição existente — qualquer status, inclusive cancelado
    inscricao_existente = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.consulente_id == consulente.id,
    ).first()

    if inscricao_existente:
        if inscricao_existente.status == StatusInscricaoEnum.cancelado:
            # Mensagem clara orientando o consulente a contatar o terreiro
            raise HTTPException(
                status_code=400,
                detail=(
                    "Sua inscrição nesta gira foi cancelada. "
                    "Para retornar à lista, entre em contato com a administração do terreiro."
                ),
            )
        # Inscrição ativa (confirmado, lista_espera, compareceu, faltou)
        raise HTTPException(status_code=400, detail="Telefone já inscrito nesta gira")

    # SELECT FOR UPDATE — apenas consulentes (membro_id não interfere)
    inscricoes_consulentes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.gira_id == gira.id,
            InscricaoGira.consulente_id.isnot(None),
            InscricaoGira.status.in_([
                StatusInscricaoEnum.confirmado,
                StatusInscricaoEnum.lista_espera,
            ]),
        )
        .with_for_update()
        .all()
    )

    confirmados_consulentes = sum(
        1 for i in inscricoes_consulentes
        if i.status == StatusInscricaoEnum.confirmado
    )
    proxima_posicao = len(inscricoes_consulentes) + 1

    status_inicial = (
        StatusInscricaoEnum.lista_espera
        if confirmados_consulentes >= gira.limite_consulentes
        else StatusInscricaoEnum.confirmado
    )

    observacoes_sanitizadas = None
    if data.observacoes:
        observacoes_sanitizadas = data.observacoes.strip()[:500] or None

    inscricao = InscricaoGira(
        gira_id=gira.id,
        consulente_id=consulente.id,
        posicao=proxima_posicao,
        status=status_inicial,
        observacoes=observacoes_sanitizadas,
    )
    db.add(inscricao)
    db.commit()
    db.refresh(inscricao)

    send_push_to_terreiro(
        terreiro_id=gira.terreiro_id,
        title="👤 Nova Inscrição",
        body=(
            f"{data.nome} se inscreveu na {gira.titulo} "
            f"(vaga {confirmados_consulentes + 1}/{gira.limite_consulentes})"
        ),
        url=f"/giras/{gira.id}",
    )

    return InscricaoResponse(
        id=inscricao.id,
        posicao=inscricao.posicao,
        status=inscricao.status,
        created_at=inscricao.created_at,
        consulente_nome=consulente.nome,
        consulente_telefone=consulente.telefone,
        observacoes=inscricao.observacoes,
    )


def reativar_inscricao(db: Session, inscricao_id: UUID, terreiro_id: UUID) -> dict:
    """
    Reativa uma inscrição cancelada.

    O admin pode reativar um consulente cancelado. O sistema verifica
    se ainda há vaga confirmada disponível:
      - Há vaga  → status volta para confirmado
      - Lotada   → status vai para lista_espera (entra no fim da fila)

    A posição original é mantida para preservar a ordem histórica.
    """
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    gira = db.query(Gira).filter(
        Gira.id == inscricao.gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if inscricao.status != StatusInscricaoEnum.cancelado:
        raise HTTPException(status_code=400, detail="Inscrição não está cancelada")

    # Conta vagas confirmadas atuais para decidir o novo status
    confirmados = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.consulente_id.isnot(None),
        InscricaoGira.status == StatusInscricaoEnum.confirmado,
    ).count()

    novo_status = (
        StatusInscricaoEnum.confirmado
        if confirmados < (gira.limite_consulentes or 0)
        else StatusInscricaoEnum.lista_espera
    )

    inscricao.status = novo_status
    db.commit()
    db.refresh(inscricao)

    nome = inscricao.consulente.nome if inscricao.consulente else "Consulente"
    return {
        "ok":     True,
        "status": novo_status,
        "nome":   nome,
        # Informa se voltou confirmado ou entrou na fila
        "mensagem": (
            f"{nome} reativado(a) como confirmado(a)."
            if novo_status == StatusInscricaoEnum.confirmado
            else f"{nome} reativado(a) na lista de espera (gira lotada)."
        ),
    }


def update_presenca(
    db: Session,
    inscricao_id: UUID,
    data: PresencaUpdate,
    terreiro_id: UUID,
) -> dict:
    """Atualiza status de presença (compareceu / faltou)."""
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    gira = db.query(Gira).filter(
        Gira.id == inscricao.gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if data.status not in ("compareceu", "faltou"):
        raise HTTPException(status_code=400, detail="Status inválido")

    inscricao.status = data.status
    db.commit()
    db.refresh(inscricao)
    return {"ok": True, "status": inscricao.status}


def cancelar_inscricao(db: Session, inscricao_id: UUID, terreiro_id: UUID) -> dict:
    """
    Cancela inscrição e promove automaticamente 1 pessoa da fila de espera
    (apenas quando a inscrição cancelada era confirmada).

    Não penaliza o score — cancelamento significa aviso prévio.
    Retorna { ok, promovido: { nome, telefone, posicao } | None }.
    """
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    gira = db.query(Gira).filter(
        Gira.id == inscricao.gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    nome = inscricao.consulente.nome if inscricao.consulente else "Consulente"
    era_confirmado = inscricao.status == StatusInscricaoEnum.confirmado

    inscricao.status = StatusInscricaoEnum.cancelado

    # Promove 1 pessoa somente se a vaga que saiu era confirmada
    promovido_inscricao = None
    if era_confirmado:
        promovido_inscricao = _promover_lista_espera(db, gira.id, terreiro_id)

    db.commit()

    resultado: dict = {"ok": True, "promovido": None}

    if promovido_inscricao and promovido_inscricao.consulente:
        resultado["promovido"] = {
            "nome":     promovido_inscricao.consulente.nome,
            "telefone": promovido_inscricao.consulente.telefone,
            "posicao":  promovido_inscricao.posicao,
        }

    corpo_push = f"{nome} cancelou a inscrição na {gira.titulo}"
    if resultado["promovido"]:
        corpo_push += f" → {resultado['promovido']['nome']} promovido(a) da fila!"

    send_push_to_terreiro(
        terreiro_id=gira.terreiro_id,
        title="❌ Inscrição Cancelada",
        body=corpo_push,
        url=f"/giras/{gira.id}",
    )

    return resultado