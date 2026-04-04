"""
inventory_router.py — AxeFlow
Endpoints do sistema de inventário e consumo por gira.

RBAC aplicado:
  - Itens do terreiro: admin/operador criam, todos leem
  - Itens do médium: qualquer membro cria e gerencia os seus
  - Movimentações manuais: admin/operador
  - Consumo na gira: qualquer membro registra o seu
  - Finalização: admin/operador

Tabela de endpoints:
  POST   /inventory/items/terreiro           criar item do terreiro
  POST   /inventory/items/medium             criar item do médium
  GET    /inventory/items                    listar itens (filtrar por owner)
  GET    /inventory/items/{id}/stock         saldo atual
  GET    /inventory/items/{id}/history       histórico de movimentações
  POST   /inventory/items/{id}/movements     movimentação manual
  POST   /giras/{id}/consumption             registrar consumo
  GET    /giras/{id}/consumption             listar consumos da gira
  PATCH  /giras/{id}/consumption/{cid}       editar consumo
  POST   /giras/{id}/finalizar               finalizar gira e processar estoque
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.schemas.inventory_schema import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryMovementCreate,
    InventoryMovementResponse,
    GiraConsumptionCreate,
    GiraConsumptionUpdate,
    GiraConsumptionResponse,
    GiraFinalizarResponse,
    StockResponse,
)
from app.services import inventory_service, audit_service

router = APIRouter(tags=["inventory"])


# ══════════════════════════════════════════════════════════════════════════════
# ITENS DE ESTOQUE
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/inventory/items/terreiro",
    status_code=status.HTTP_201_CREATED,
)
def criar_item_terreiro(
    data: InventoryItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador")),
):
    """
    Cria item de estoque para o terreiro.
    Apenas admin e operador podem criar itens do terreiro.
    """
    item = inventory_service.criar_item_terreiro(db, data, user)

    audit_service.log(
        db, request,
        context = "inventory",
        action  = "ITEM_TERREIRO_CRIADO",
        level   = "INFO",
        user_id = user.id,
        status  = 201,
        message = f"Item criado: '{data.name}' categoria={data.category}",
    )

    return {
        "ok":   True,
        "id":   str(item.id),
        "name": item.name,
    }


@router.post(
    "/inventory/items/medium",
    status_code=status.HTTP_201_CREATED,
)
def criar_item_medium(
    data: InventoryItemCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Cria item de estoque para o próprio médium autenticado.
    Qualquer membro pode criar itens para si mesmo.
    """
    item = inventory_service.criar_item_medium(db, data, user)
    return {
        "ok":   True,
        "id":   str(item.id),
        "name": item.name,
    }


@router.get("/inventory/items")
def listar_itens(
    owner_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Lista itens de estoque do terreiro com saldo calculado.
    owner_id opcional: filtra por proprietário específico.
    """
    return inventory_service.listar_itens(
        db,
        terreiro_id = user.terreiro_id,
        owner_id    = owner_id,
    )


@router.get("/inventory/items/{item_id}/stock", response_model=StockResponse)
def get_saldo(
    item_id: UUID,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Retorna saldo atual calculado de um item com flag de alerta.
    O saldo é calculado em tempo real (ledger pattern).
    """
    return inventory_service.get_saldo_item(db, item_id, user.terreiro_id)


@router.get(
    "/inventory/items/{item_id}/history",
    response_model=list[InventoryMovementResponse],
)
def get_historico(
    item_id: UUID,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Retorna histórico de movimentações de um item (mais recente primeiro).
    limit padrão: 50 registros. Máximo recomendado: 200.
    """
    movs = inventory_service.get_historico_item(
        db, item_id, user.terreiro_id, limit=min(limit, 200)
    )
    return movs


@router.post(
    "/inventory/items/{item_id}/movements",
    status_code=status.HTTP_201_CREATED,
    response_model=InventoryMovementResponse,
)
def registrar_movimentacao(
    item_id: UUID,
    data: InventoryMovementCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador")),
):
    """
    Registra movimentação manual (compra, ajuste, descarte).
    Apenas admin/operador.

    Tipos:
      IN         → entrada (compra, doação)
      OUT        → saída manual (descarte, perda)
      ADJUSTMENT → correção de inventário (contagem física)
    """
    mov = inventory_service.registrar_movimentacao(db, item_id, data, user)

    audit_service.log(
        db, request,
        context = "inventory",
        action  = "MOVIMENTACAO_MANUAL",
        level   = "INFO",
        user_id = user.id,
        status  = 201,
        message = f"Movimentação: {data.type} qty={data.quantity} item={item_id}",
    )

    return mov


# ══════════════════════════════════════════════════════════════════════════════
# CONSUMO POR GIRA
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/giras/{gira_id}/consumption",
    status_code=status.HTTP_201_CREATED,
)
def registrar_consumo(
    gira_id: UUID,
    data: GiraConsumptionCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Registra consumo de item por médium em uma gira.

    NÃO afeta o estoque imediatamente.
    O estoque é debitado apenas ao finalizar a gira.

    source:
      MEDIUM   → débito do estoque do próprio médium
      TERREIRO → débito do estoque do terreiro

    Erros possíveis:
      404: gira ou item não encontrado
      400: gira já finalizada, source inconsistente com owner do item
      409: consumo duplicado (mesmo médium+item na mesma gira)
    """
    consumo = inventory_service.registrar_consumo(db, gira_id, data, user)

    return {
        "ok":       True,
        "id":       str(consumo.id),
        "status":   consumo.status,
        "quantity": consumo.quantity,
    }


@router.get("/giras/{gira_id}/consumption")
def listar_consumos(
    gira_id: UUID,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Lista todos os consumos registrados para a gira (não cancelados).
    Enriquecido com nome do item e do médium.
    """
    return inventory_service.listar_consumos_gira(db, gira_id, user.terreiro_id)


@router.patch("/giras/{gira_id}/consumption/{consumo_id}")
def editar_consumo(
    gira_id: UUID,
    consumo_id: UUID,
    data: GiraConsumptionUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """
    Edita quantidade de um consumo pendente.
    Apenas o próprio médium ou admin/operador podem editar.

    Erros possíveis:
      404: consumo não encontrado
      403: não é o médium dono do consumo
      400: consumo já processado ou cancelado
    """
    consumo = inventory_service.editar_consumo(db, consumo_id, data, user)
    return {
        "ok":       True,
        "id":       str(consumo.id),
        "quantity": consumo.quantity,
        "status":   consumo.status,
    }


# ══════════════════════════════════════════════════════════════════════════════
# FINALIZAÇÃO DA GIRA
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/giras/{gira_id}/finalizar",
    response_model=GiraFinalizarResponse,
)
def finalizar_gira(
    gira_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador")),
):
    """
    Finaliza a gira: converte consumos pendentes em movimentações de estoque.

    Processo atômico e idempotente:
      - Se já finalizada: retorna 409
      - Se bem-sucedido: estoque debitado, notificações criadas

    Erros possíveis:
      404: gira não encontrada
      409: gira já finalizada (estoque_processado = True)
    """
    resultado = inventory_service.finalizar_gira(db, gira_id, user)

    audit_service.log(
        db, request,
        context = "inventory",
        action  = "GIRA_FINALIZADA",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = (
            f"Gira finalizada: id={gira_id} "
            f"consumos={resultado.consumos_processados} "
            f"movs={resultado.movimentacoes_geradas}"
        ),
    )

    return resultado