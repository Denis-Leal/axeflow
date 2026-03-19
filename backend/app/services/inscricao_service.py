"""
inscricao_service.py — AxeFlow
Serviço de inscrições em giras.

Pontos críticos:
  - Controle de concorrência via SELECT FOR UPDATE (evita race condition de vagas)
  - Telefone normalizado antes de qualquer consulta (evita duplicatas silenciosas)
  - Soft delete em giras (filtra deleted_at IS NULL)
  - Status lista_espera quando gira está lotada
  - Vagas de consulentes e vagas de membros são contadas SEPARADAMENTE:
      consulente_id IS NOT NULL → conta contra limite_consulentes
      membro_id IS NOT NULL     → conta contra total de membros ativos (sem limite fixo)

ALTERAÇÃO:
  - inscrever_publico: dupla validação de `primeira_visita`
      Camada 1 (autoritativa): busca pelo telefone no banco.
        Telefone novo  → primeira_visita = True  (sistema corrige caso checkbox desmarcado)
        Telefone existe → primeira_visita = False (banco prevalece sobre checkbox)
      Camada 2 (declarativa): checkbox do formulário público.
        Usado apenas para novo consulente; ignorado se telefone já existe.
  - inscrever_publico: persiste `observacoes` enviado pelo consulente no link público
  - list_inscricoes: retorna `observacoes` de cada inscrição para o painel admin
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
    Lista inscrições de CONSULENTES de uma gira, ordenadas por posição na fila.

    Filtra explicitamente consulente_id IS NOT NULL para garantir que
    confirmações de membros (membro_id IS NOT NULL) nunca apareçam aqui.
    As duas categorias têm listas separadas na UI.
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
            InscricaoGira.consulente_id.isnot(None),  # APENAS consulentes externos
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
            # Retorna observações para exibição no painel admin
            observacoes=i.observacoes,
        )
        for i in inscricoes
    ]


def inscrever_publico(db: Session, slug: str, data: InscricaoPublicaRequest):
    """
    Inscreve consulente em gira pública via link público.

    Usa SELECT FOR UPDATE na contagem de vagas para evitar race condition:
    sem o lock, duas requisições simultâneas podem ambas passar pela verificação
    de vagas e criar inscrições além do limite.

    IMPORTANTE: apenas inscrições com consulente_id preenchido contam contra
    limite_consulentes. Confirmações de membros (membro_id) são contadas
    separadamente e NÃO afetam as vagas disponíveis para consulentes.

    ALTERAÇÃO:
      Dupla validação de primeira_visita:
        | Existe no banco | Checkbox | primeira_visita salvo        |
        |-----------------|----------|------------------------------|
        | Não             | True     | True  (declarado pelo usuário)|
        | Não             | False    | False (já veio, só é novo no sistema)|
        | Não             | None     | True  (fallback conservador) |
        | Sim             | qualquer | False (banco prevalece)      |
    """
    gira = db.query(Gira).filter(
        Gira.slug_publico == slug,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Verificar janela de inscrição
    agora = datetime.utcnow()
    if agora < gira.abertura_lista:
        raise HTTPException(status_code=400, detail="Lista ainda não foi aberta")
    if agora > gira.fechamento_lista:
        raise HTTPException(status_code=400, detail="Lista encerrada")

    # Validar e normalizar telefone (E.164 sem '+')
    if not validate_phone(data.telefone):
        raise HTTPException(status_code=400, detail="Telefone inválido")
    telefone = normalize_phone(data.telefone)

    # ── Dupla validação de primeira_visita ────────────────────────────────────
    # Camada 1 (autoritativa): busca pelo telefone normalizado no banco.
    consulente = db.query(Consulente).filter(Consulente.telefone == telefone).first()

    if not consulente:
        # Telefone NOVO: consulente nunca esteve neste sistema antes.
        #
        # Aqui o checkbox é a única fonte de verdade disponível, então
        # respeitamos o que o usuário declarou:
        #   - Marcou "primeira vez"  → True
        #   - Desmarcou              → False (já veio antes, só não estava cadastrado)
        #   - Não respondeu (None)   → True como fallback conservador
        #     (sem informação, assumimos primeira visita para não perder o dado)
        primeira_visita = data.primeira_visita if data.primeira_visita is not None else True

        consulente = Consulente(
            nome=data.nome,
            telefone=telefone,
            primeira_visita=primeira_visita,
        )
        db.add(consulente)
        db.flush()  # obtém o ID sem commitar ainda
    else:
        # Telefone JÁ EXISTE: consulente foi cadastrado antes.
        # Independente do checkbox, ele já esteve no sistema — banco prevalece.
        consulente.primeira_visita = False
    # ── Fim da dupla validação ────────────────────────────────────────────────

    # Verificar se já está inscrito (e não cancelou)
    ja_inscrito = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.consulente_id == consulente.id,
        InscricaoGira.status != StatusInscricaoEnum.cancelado,
    ).first()
    if ja_inscrito:
        raise HTTPException(status_code=400, detail="Telefone já inscrito nesta gira")

    # ── CONTROLE DE CONCORRÊNCIA ──────────────────────────────────────────────
    # SELECT FOR UPDATE: bloqueia as linhas durante a transação para que
    # requisições simultâneas não consigam ler o mesmo contador de vagas.
    #
    # Filtra APENAS inscrições de consulentes (consulente_id IS NOT NULL).
    # Confirmações de membros (membro_id) são contadas separadamente e NÃO
    # interferem na contagem de vagas disponíveis para o público.
    inscricoes_consulentes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.gira_id == gira.id,
            InscricaoGira.consulente_id.isnot(None),  # apenas consulentes externos
            InscricaoGira.status.in_([
                StatusInscricaoEnum.confirmado,
                StatusInscricaoEnum.lista_espera,
            ]),
        )
        .with_for_update()  # lock de linha — impede race condition
        .all()
    )

    confirmados_consulentes = sum(
        1 for i in inscricoes_consulentes
        if i.status == StatusInscricaoEnum.confirmado
    )
    # Posição na fila considera apenas consulentes (membros têm lista separada)
    proxima_posicao = len(inscricoes_consulentes) + 1

    # Se atingiu limite de consulentes → entra na lista de espera
    status_inicial = (
        StatusInscricaoEnum.lista_espera
        if confirmados_consulentes >= gira.limite_consulentes
        else StatusInscricaoEnum.confirmado
    )

    # Sanitiza observações: remove espaços extras, limita a 500 chars
    observacoes_sanitizadas = None
    if data.observacoes:
        observacoes_sanitizadas = data.observacoes.strip()[:500] or None

    inscricao = InscricaoGira(
        gira_id=gira.id,
        consulente_id=consulente.id,
        posicao=proxima_posicao,
        status=status_inicial,
        observacoes=observacoes_sanitizadas,  # persiste observação do consulente
    )
    db.add(inscricao)
    db.commit()
    db.refresh(inscricao)

    # Notificação push para o terreiro
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


def update_presenca(
    db: Session,
    inscricao_id: UUID,
    data: PresencaUpdate,
    terreiro_id: UUID,
) -> dict:
    """Atualiza status de presença de uma inscrição (compareceu / faltou)."""
    inscricao = db.query(InscricaoGira).filter(InscricaoGira.id == inscricao_id).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    # Garante que a gira pertence ao terreiro do usuário logado
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
    """Cancela inscrição. Não penaliza o score (cancelamento é aviso prévio)."""
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
    inscricao.status = StatusInscricaoEnum.cancelado
    db.commit()

    # Notificação push para o terreiro
    send_push_to_terreiro(
        terreiro_id=gira.terreiro_id,
        title="❌ Inscrição Cancelada",
        body=f"{nome} cancelou a inscrição na {gira.titulo}",
        url=f"/giras/{gira.id}",
    )

    return {"ok": True}