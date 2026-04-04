"""
inventory_service.py — AxeFlow
Lógica de negócio do sistema de inventário.

PRINCÍPIOS CRÍTICOS:
  1. Saldo nunca é armazenado — sempre calculado via SUM(movements)
  2. Movimentações são append-only (sem UPDATE/DELETE)
  3. Finalização da gira é transacional e idempotente
  4. RBAC validado aqui, não só no router

CONCORRÊNCIA:
  - Saldo calculado em tempo real (sem cache): consistente mas O(n) por item
  - Finalização usa SELECT FOR UPDATE na gira para prevenir dupla execução
  - Criação de consumo tem UNIQUE constraint no banco como última barreira
"""
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inventory_owner import InventoryOwner, OwnerTypeEnum
from app.models.inventory_item import InventoryItem, ItemCategoryEnum
from app.models.inventory_movement import InventoryMovement, MovementTypeEnum
from app.models.gira_item_consumption import (
    GiraItemConsumption,
    ConsumptionSourceEnum,
    ConsumptionStatusEnum,
)
from app.models.inventory_alert_notification import (
    InventoryAlert,
    GiraNotification,
    NotificationTypeEnum,
)
from app.schemas.inventory_schema import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryMovementCreate,
    GiraConsumptionCreate,
    GiraConsumptionUpdate,
    GiraFinalizarResponse,
    StockResponse,
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ══════════════════════════════════════════════════════════════════════════════

def _calcular_saldo(db: Session, item_id: UUID) -> int:
    """
    Calcula saldo atual de um item somando movimentações.

    Fórmula:
      saldo = SUM(IN) + SUM(ADJUSTMENT) - SUM(OUT)

    NOTA: ADJUSTMENT sem sinal segue convenção IN (positivo).
    Para ajuste de redução, o admin usa OUT com notes explicativo.

    Performance: O(n) sobre movimentações do item. Aceitável para escala
    atual (terreiros com dezenas de itens e centenas de movimentações).
    Para escala maior: adicionar snapshot mensal + somar incrementais.
    """
    result = db.execute(
        text("""
            SELECT
                COALESCE(SUM(CASE WHEN type IN ('IN', 'ADJUSTMENT') THEN quantity ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0)
                AS saldo
            FROM inventory_movements
            WHERE inventory_item_id = :item_id
        """),
        {"item_id": str(item_id)},
    ).scalar()

    return int(result or 0)


def _get_or_create_owner(
    db: Session,
    owner_type: OwnerTypeEnum,
    reference_id: Optional[UUID],
) -> InventoryOwner:
    """
    Busca ou cria um InventoryOwner.
    Idempotente: retorna o existente se já houver.
    """
    owner = db.query(InventoryOwner).filter(
        InventoryOwner.type == owner_type,
        InventoryOwner.reference_id == reference_id,
    ).first()

    if not owner:
        owner = InventoryOwner(type=owner_type, reference_id=reference_id)
        db.add(owner)
        db.flush()  # gera o ID antes de usar como FK

    return owner


def _verificar_owner_do_item(
    item: InventoryItem,
    user: Usuario,
    source: ConsumptionSourceEnum,
) -> None:
    """
    Valida que o source do consumo é consistente com o owner do item.

    MEDIUM  → item deve pertencer ao médium (owner.reference_id == user.id)
    TERREIRO → item deve pertencer ao terreiro (owner do tipo TERREIRO)

    Raises 400 se inconsistente.
    """
    if source == ConsumptionSourceEnum.MEDIUM:
        if (
            item.owner.type != OwnerTypeEnum.MEDIUM
            or str(item.owner.reference_id) != str(user.id)
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"O item '{item.name}' não pertence ao seu estoque. "
                    "Para consumo de MEDIUM, use um item do seu próprio inventário."
                ),
            )
    elif source == ConsumptionSourceEnum.TERREIRO:
        if item.owner.type != OwnerTypeEnum.TERREIRO:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"O item '{item.name}' não é do estoque do terreiro. "
                    "Para consumo de TERREIRO, use um item do inventário do terreiro."
                ),
            )


def _verificar_alerta_estoque(db: Session, item_id: UUID) -> None:
    """
    Verifica se o saldo ficou abaixo do threshold após uma movimentação.
    Cria ou resolve alertas conforme necessário.

    Chamado após qualquer OUT ou ADJUSTMENT que reduza o saldo.
    """
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item or item.minimum_threshold == 0:
        return  # sem threshold configurado = sem alerta

    saldo = _calcular_saldo(db, item_id)
    alerta_aberto = db.query(InventoryAlert).filter(
        InventoryAlert.inventory_item_id == item_id,
        InventoryAlert.resolved_at.is_(None),
    ).first()

    if saldo <= item.minimum_threshold:
        # Cria alerta se não existir um aberto
        if not alerta_aberto:
            alerta = InventoryAlert(inventory_item_id=item_id)
            db.add(alerta)
            logger.info(
                "[Inventory] Alerta de estoque baixo criado: item=%s saldo=%d threshold=%d",
                item_id, saldo, item.minimum_threshold,
            )
    else:
        # Resolve alerta aberto se estoque voltou acima do threshold
        if alerta_aberto:
            alerta_aberto.resolved_at = datetime.utcnow()
            logger.info(
                "[Inventory] Alerta de estoque resolvido: item=%s saldo=%d",
                item_id, saldo,
            )


# ══════════════════════════════════════════════════════════════════════════════
# INVENTORY OWNER
# ══════════════════════════════════════════════════════════════════════════════

def get_or_create_terreiro_owner(db: Session, terreiro_id: UUID) -> InventoryOwner:
    """Retorna (ou cria) o owner do terreiro."""
    return _get_or_create_owner(db, OwnerTypeEnum.TERREIRO, terreiro_id)


def get_or_create_medium_owner(db: Session, user_id: UUID) -> InventoryOwner:
    """Retorna (ou cria) o owner de um médium específico."""
    return _get_or_create_owner(db, OwnerTypeEnum.MEDIUM, user_id)


# ══════════════════════════════════════════════════════════════════════════════
# INVENTORY ITEM
# ══════════════════════════════════════════════════════════════════════════════

def criar_item_terreiro(
    db: Session,
    data: InventoryItemCreate,
    user: Usuario,
) -> InventoryItem:
    """
    Cria item de estoque para o terreiro.
    Apenas admin/operador (validado no router).
    """
    owner = get_or_create_terreiro_owner(db, user.terreiro_id)

    item = InventoryItem(
        terreiro_id       = user.terreiro_id,
        owner_id          = owner.id,
        name              = data.name.strip(),
        category          = data.category,
        minimum_threshold = data.minimum_threshold,
        unit_cost         = data.unit_cost,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(
        "[Inventory] Item do terreiro criado: %s (%s) por %s",
        item.name, item.id, user.id,
    )
    return item


def criar_item_medium(
    db: Session,
    data: InventoryItemCreate,
    user: Usuario,
) -> InventoryItem:
    """
    Cria item de estoque para o médium autenticado.
    Qualquer membro autenticado pode criar itens para si mesmo.
    """
    owner = get_or_create_medium_owner(db, user.id)

    item = InventoryItem(
        terreiro_id       = user.terreiro_id,
        owner_id          = owner.id,
        name              = data.name.strip(),
        category          = data.category,
        minimum_threshold = data.minimum_threshold,
        unit_cost         = data.unit_cost,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return item


def listar_itens(
    db: Session,
    terreiro_id: UUID,
    owner_id: Optional[UUID] = None,
    incluir_saldo: bool = True,
) -> list[dict]:
    """
    Lista itens de estoque com saldo calculado.

    owner_id: filtrar por owner específico (None = todos do terreiro).
    incluir_saldo: se False, retorna sem calcular saldo (mais rápido para listas grandes).
    """
    query = db.query(InventoryItem).filter(
        InventoryItem.terreiro_id == terreiro_id,
        InventoryItem.deleted_at.is_(None),
    )
    if owner_id:
        query = query.filter(InventoryItem.owner_id == owner_id)

    itens = query.all()
    result = []

    for item in itens:
        saldo = _calcular_saldo(db, item.id) if incluir_saldo else None

        # Verifica se há alerta aberto para este item
        tem_alerta = db.query(InventoryAlert).filter(
            InventoryAlert.inventory_item_id == item.id,
            InventoryAlert.resolved_at.is_(None),
        ).first() is not None

        result.append({
            "id":                str(item.id),
            "terreiro_id":       str(item.terreiro_id),
            "owner_id":          str(item.owner_id),
            "name":              item.name,
            "category":          item.category,
            "minimum_threshold": item.minimum_threshold,
            "unit_cost":         item.unit_cost,
            "created_at":        item.created_at,
            "current_stock":     saldo,
            "low_stock":         tem_alerta,
        })

    return result


def get_saldo_item(db: Session, item_id: UUID, terreiro_id: UUID) -> StockResponse:
    """
    Retorna saldo atual de um item com flag de alerta.
    Valida que o item pertence ao terreiro.
    """
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.terreiro_id == terreiro_id,
        InventoryItem.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    saldo = _calcular_saldo(db, item_id)
    tem_alerta = saldo <= item.minimum_threshold and item.minimum_threshold > 0

    stock_value = None
    if item.unit_cost and saldo > 0:
        stock_value = item.unit_cost * saldo

    return StockResponse(
        inventory_item_id = item.id,
        item_name         = item.name,
        current_stock     = saldo,
        minimum_threshold = item.minimum_threshold,
        low_stock         = tem_alerta,
        unit_cost         = item.unit_cost,
        stock_value       = stock_value,
    )


def get_historico_item(
    db: Session,
    item_id: UUID,
    terreiro_id: UUID,
    limit: int = 50,
) -> list[InventoryMovement]:
    """
    Retorna histórico de movimentações de um item, do mais recente para o mais antigo.
    Validação de pertencimento ao terreiro incluída.
    """
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.terreiro_id == terreiro_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    return (
        db.query(InventoryMovement)
        .filter(InventoryMovement.inventory_item_id == item_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(limit)
        .all()
    )


def registrar_movimentacao(
    db: Session,
    item_id: UUID,
    data: InventoryMovementCreate,
    user: Usuario,
) -> InventoryMovement:
    """
    Registra movimentação manual (não gerada por finalização de gira).
    Valida que o item pertence ao terreiro do usuário.
    """
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.terreiro_id == user.terreiro_id,
        InventoryItem.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    mov = InventoryMovement(
        inventory_item_id = item_id,
        type              = data.type,
        quantity          = data.quantity,
        gira_id           = None,  # movimentação manual, sem gira
        created_by        = user.id,
        notes             = data.notes,
    )
    db.add(mov)
    db.flush()

    # Verifica alerta após movimentação de saída ou ajuste
    if data.type in (MovementTypeEnum.OUT, MovementTypeEnum.ADJUSTMENT):
        _verificar_alerta_estoque(db, item_id)

    db.commit()
    db.refresh(mov)

    return mov


# ══════════════════════════════════════════════════════════════════════════════
# CONSUMO POR GIRA
# ══════════════════════════════════════════════════════════════════════════════

def registrar_consumo(
    db: Session,
    gira_id: UUID,
    data: GiraConsumptionCreate,
    user: Usuario,
) -> GiraItemConsumption:
    """
    Registra consumo de um item por um médium em uma gira.

    NÃO afeta o estoque — apenas registra a intenção.
    O estoque é debitado no fechamento da gira.

    Validações:
    - Gira existe e pertence ao terreiro
    - Gira não está finalizada
    - Item existe e pertence ao terreiro
    - Source é consistente com o owner do item
    """
    # Valida gira
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == user.terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Impede registro após finalização
    if getattr(gira, "estoque_processado", False):
        raise HTTPException(
            status_code=400,
            detail="Esta gira já foi finalizada. Não é possível registrar mais consumos.",
        )

    # Valida item
    item = db.query(InventoryItem).filter(
        InventoryItem.id == data.inventory_item_id,
        InventoryItem.terreiro_id == user.terreiro_id,
        InventoryItem.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de inventário não encontrado")

    # Garante que o item pertence ao owner correto para o source informado
    _verificar_owner_do_item(item, user, ConsumptionSourceEnum(data.source))

    consumo = GiraItemConsumption(
        terreiro_id       = user.terreiro_id,
        gira_id           = gira_id,
        medium_id         = user.id,
        inventory_item_id = data.inventory_item_id,
        source            = data.source,
        quantity          = data.quantity,
        status            = ConsumptionStatusEnum.PENDENTE,
    )
    db.add(consumo)

    try:
        db.commit()
    except Exception:
        db.rollback()
        # UNIQUE constraint violada: já existe consumo deste médium+item na gira
        raise HTTPException(
            status_code=409,
            detail=(
                f"Você já registrou consumo do item '{item.name}' nesta gira. "
                "Para alterar, edite o consumo existente."
            ),
        )

    db.refresh(consumo)
    return consumo


def listar_consumos_gira(
    db: Session,
    gira_id: UUID,
    terreiro_id: UUID,
) -> list[dict]:
    """Lista todos os consumos registrados para uma gira, enriquecidos."""
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    consumos = db.query(GiraItemConsumption).filter(
        GiraItemConsumption.gira_id == gira_id,
        GiraItemConsumption.status != ConsumptionStatusEnum.CANCELADO,
    ).all()

    result = []
    for c in consumos:
        result.append({
            "id":                 str(c.id),
            "gira_id":            str(c.gira_id),
            "medium_id":          str(c.medium_id),
            "medium_nome":        c.medium.nome if c.medium else None,
            "inventory_item_id":  str(c.inventory_item_id),
            "item_name":          c.item.name if c.item else None,
            "source":             c.source,
            "quantity":           c.quantity,
            "status":             c.status,
            "created_at":         c.created_at,
        })

    return result


def editar_consumo(
    db: Session,
    consumo_id: UUID,
    data: GiraConsumptionUpdate,
    user: Usuario,
) -> GiraItemConsumption:
    """
    Edita quantidade de um consumo pendente.
    Apenas o próprio médium pode editar seu consumo.
    """
    consumo = db.query(GiraItemConsumption).filter(
        GiraItemConsumption.id == consumo_id,
        GiraItemConsumption.terreiro_id == user.terreiro_id,
    ).first()
    if not consumo:
        raise HTTPException(status_code=404, detail="Consumo não encontrado")

    # Apenas o próprio médium pode editar (admin pode via endpoint separado)
    if str(consumo.medium_id) != str(user.id) and user.role not in ("admin", "operador"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    if consumo.status != ConsumptionStatusEnum.PENDENTE:
        raise HTTPException(
            status_code=400,
            detail=f"Consumo com status '{consumo.status}' não pode ser editado.",
        )

    consumo.quantity = data.quantity
    db.commit()
    db.refresh(consumo)
    return consumo


# ══════════════════════════════════════════════════════════════════════════════
# FINALIZAÇÃO DA GIRA
# ══════════════════════════════════════════════════════════════════════════════

def finalizar_gira(
    db: Session,
    gira_id: UUID,
    user: Usuario,
) -> GiraFinalizarResponse:
    """
    Finaliza a gira: converte consumos em movimentações de estoque.

    IDEMPOTÊNCIA:
      Verifica estoque_processado antes de processar.
      SELECT FOR UPDATE na gira previne execução concorrente.

    TRANSAÇÃO:
      Todo o processo é atômico. Se qualquer parte falhar, nada é persistido.

    PROCESSO:
      1. Lock na gira (FOR UPDATE)
      2. Valida que não foi processada antes
      3. Para cada consumo PENDENTE:
         a. Cria InventoryMovement (OUT) no item correto
         b. Atualiza consumo → PROCESSADO com referência à movimentação
         c. Verifica alerta de estoque baixo
      4. Identifica médiuns sem consumo → cria GiraNotification
      5. Marca gira como estoque_processado = True
    """
    # SELECT FOR UPDATE: previne dupla finalização concorrente
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == user.terreiro_id,
        Gira.deleted_at.is_(None),
    ).with_for_update().first()

    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Idempotência: já foi processada
    if getattr(gira, "estoque_processado", False):
        raise HTTPException(
            status_code=409,
            detail="Esta gira já foi finalizada e o estoque foi processado.",
        )

    # Busca consumos pendentes desta gira
    consumos = db.query(GiraItemConsumption).filter(
        GiraItemConsumption.gira_id == gira_id,
        GiraItemConsumption.status == ConsumptionStatusEnum.PENDENTE,
    ).all()

    movimentacoes_criadas = 0
    itens_com_saida = set()  # para verificar alertas no final

    # Processa cada consumo → gera movimentação OUT
    for consumo in consumos:
        mov = InventoryMovement(
            inventory_item_id = consumo.inventory_item_id,
            type              = MovementTypeEnum.OUT,
            quantity          = consumo.quantity,
            gira_id           = gira_id,
            created_by        = user.id,
            notes             = f"Consumo na gira ID:{gira_id}",
        )
        db.add(mov)
        db.flush()  # gera o ID da movimentação

        # Liga consumo à movimentação gerada e marca como processado
        consumo.movement_id = mov.id
        consumo.status = ConsumptionStatusEnum.PROCESSADO

        movimentacoes_criadas += 1
        itens_com_saida.add(consumo.inventory_item_id)

    # Verifica alertas de estoque após todas as saídas
    for item_id in itens_com_saida:
        _verificar_alerta_estoque(db, item_id)

    # ── Notificações: médiuns sem consumo ────────────────────────────────────
    # Identifica todos os médiuns que participaram da gira (via InscricaoMembro)
    # e não registraram nenhum consumo
    from app.models.inscricao_membro import InscricaoMembro
    from app.models.inscricao_status import StatusInscricaoEnum

    mediums_participantes = {
        str(i.membro_id)
        for i in db.query(InscricaoMembro).filter(
            InscricaoMembro.gira_id == gira_id,
            InscricaoMembro.status.in_([
                StatusInscricaoEnum.confirmado,
                StatusInscricaoEnum.compareceu,
            ]),
        ).all()
    }

    # IDs dos médiuns que registraram ao menos 1 consumo
    mediums_com_consumo = {
        str(c.medium_id)
        for c in consumos
    }

    mediums_sem_consumo_ids = mediums_participantes - mediums_com_consumo
    notificacoes_criadas = 0
    nomes_sem_consumo = []

    for medium_id in mediums_sem_consumo_ids:
        # Verifica se já existe notificação (idempotência via UNIQUE constraint)
        existente = db.query(GiraNotification).filter(
            GiraNotification.gira_id == gira_id,
            GiraNotification.user_id == medium_id,
            GiraNotification.type == NotificationTypeEnum.MISSING_CONSUMPTION,
        ).first()

        if not existente:
            notif = GiraNotification(
                gira_id = gira_id,
                user_id = medium_id,
                type    = NotificationTypeEnum.MISSING_CONSUMPTION,
            )
            db.add(notif)
            notificacoes_criadas += 1

        # Busca nome para o response (informativo)
        from app.models.usuario import Usuario as UsuarioModel
        m = db.query(UsuarioModel).filter(UsuarioModel.id == medium_id).first()
        if m:
            nomes_sem_consumo.append(m.nome)

    # Marca gira como processada
    gira.estoque_processado = True

    db.commit()

    logger.info(
        "[Inventory] Gira finalizada: id=%s consumos=%d movimentações=%d notif=%d",
        gira_id, len(consumos), movimentacoes_criadas, notificacoes_criadas,
    )

    return GiraFinalizarResponse(
        ok                      = True,
        gira_id                 = gira_id,
        consumos_processados    = len(consumos),
        movimentacoes_geradas   = movimentacoes_criadas,
        mediums_sem_consumo     = nomes_sem_consumo,
        notificacoes_criadas    = notificacoes_criadas,
    )