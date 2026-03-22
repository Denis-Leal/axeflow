"""
ajeum_router.py — AxeFlow
Endpoints do sistema Ajeum.

Tabela de endpoints:
  POST   /giras/{gira_id}/ajeum                         criar_ajeum
  GET    /giras/{gira_id}/ajeum                         get_ajeum
  POST   /ajeum/itens/{item_id}/selecionar              selecionar_item
  DELETE /ajeum/selecoes/{selecao_id}                   cancelar_selecao
  PATCH  /ajeum/selecoes/{selecao_id}/confirmar         confirmar_selecao
  PATCH  /ajeum/itens/{item_id}                         editar_item
  DELETE /ajeum/itens/{item_id}                         deletar_item

Autorização:
  criar/editar/deletar item:  require_role("admin", "operador")
  selecionar/cancelar:        get_current_user (qualquer membro)
  confirmar:                  require_role("admin", "operador")

Códigos HTTP usados e seus significados neste router:
  200 — operação bem-sucedida (GET, PATCH, DELETE)
  201 — recurso criado (POST)
  400 — dados inválidos, transição de estado inválida, gira concluída
  403 — recurso existe mas pertence a outro terreiro, ou ação não permitida
  404 — recurso não encontrado ou soft-deleted
  409 — conflito de negócio: duplicata, limite atingido, version mismatch,
        reduzir limite abaixo de seleções ativas, deletar item com seleções
  422 — validação Pydantic (formato de campos)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.schemas.ajeum_schema import (
    AjeumCreate,
    AjeumItemCreate,
    AjeumItemEdit,
    ConfirmarSelecaoRequest,
)
from app.services import ajeum_service, audit_service

router = APIRouter(tags=["ajeum"])


# ══════════════════════════════════════════════════════════════════════════════
# CRIAR AJEUM
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/giras/{gira_id}/ajeum",
    status_code=status.HTTP_201_CREATED,
)
def criar_ajeum(
    gira_id: UUID,
    data:    AjeumCreate,
    request: Request,
    db:      Session  = Depends(get_db),
    user:    Usuario  = Depends(require_role("admin", "operador")),
):
    """
    Cria o Ajeum de uma gira com todos os itens.
    Apenas admin e operador podem criar.

    Erros possíveis:
      404: gira não encontrada
      403: gira de outro terreiro
      400: gira concluída
      409: gira já tem Ajeum
      422: itens inválidos (limite < 1, descrição vazia)
    """
    ajeum = ajeum_service.criar_ajeum(db, gira_id, data, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "AJEUM_CRIADO",
        level   = "INFO",
        user_id = user.id,
        status  = 201,
        message = f"Ajeum criado para gira={gira_id} com {len(data.itens)} itens",
    )

    return {"ok": True, "id": str(ajeum.id)}


# ══════════════════════════════════════════════════════════════════════════════
# BUSCAR AJEUM DA GIRA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/giras/{gira_id}/ajeum")
def get_ajeum(
    gira_id: UUID,
    db:      Session = Depends(get_db),
    user:    Usuario = Depends(get_current_user),
):
    """
    Retorna o Ajeum da gira com itens, contagens e seleção do membro autenticado.

    A resposta inclui para cada item:
      - total_selecionado: quantos membros selecionaram
      - vagas_restantes: quantas vagas ainda há
      - lotado: boolean
      - meu_status: status da seleção do usuário atual (null se não selecionou)
      - minha_selecao_id: id da seleção (para cancelar ou confirmar)
      - minha_version: version atual (para enviar no confirmar_selecao)

    Erros possíveis:
      404: gira não encontrada ou sem Ajeum
      403: gira de outro terreiro
    """
    return ajeum_service.get_ajeum_da_gira(
        db,
        gira_id     = gira_id,
        terreiro_id = user.terreiro_id,
        membro_id   = user.id,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SELECIONAR ITEM
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/ajeum/itens/{item_id}/selecionar",
    status_code=status.HTTP_200_OK,
    # 200 e não 201 porque a operação pode ser idempotente
    # (retorna existente sem criar novo)
)
def selecionar_item(
    item_id: UUID,
    request: Request,
    db:      Session = Depends(get_db),
    user:    Usuario = Depends(get_current_user),
):
    """
    Registra que o membro vai levar o item.

    Idempotente: clicar duas vezes retorna o mesmo resultado.
    Re-seleção após cancelamento é tratada automaticamente.

    Erros possíveis:
      404: item não encontrado
      403: item de outro terreiro
      400: gira concluída
      409: limite atingido ("Já temos o suficiente desse item")
    """
    selecao = ajeum_service.selecionar_item(db, item_id, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "ITEM_SELECIONADO",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Item selecionado: item={item_id} membro={user.id}",
    )

    return {
        "ok":       True,
        "id":       str(selecao.id),
        "status":   selecao.status,
        "version":  selecao.version,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CANCELAR SELEÇÃO
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/ajeum/selecoes/{selecao_id}")
def cancelar_selecao(
    selecao_id: UUID,
    request:    Request,
    db:         Session = Depends(get_db),
    user:       Usuario = Depends(get_current_user),
):
    """
    Cancela a seleção do próprio membro. Libera a vaga.

    Apenas o próprio membro pode cancelar.
    Status terminais (confirmado, nao_entregue) não podem ser cancelados.

    Erros possíveis:
      404: seleção não encontrada
      403: seleção de outro terreiro ou de outro membro
      400: transição inválida (ex: cancelar 'confirmado')
    """
    selecao = ajeum_service.cancelar_selecao(db, selecao_id, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "SELECAO_CANCELADA",
        level   = "WARNING",
        user_id = user.id,
        status  = 200,
        message = f"Seleção cancelada: selecao={selecao_id}",
    )

    return {"ok": True, "status": selecao.status}


# ══════════════════════════════════════════════════════════════════════════════
# CONFIRMAR SELEÇÃO (ADMIN)
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/ajeum/selecoes/{selecao_id}/confirmar")
def confirmar_selecao(
    selecao_id: UUID,
    data:       ConfirmarSelecaoRequest,
    request:    Request,
    db:         Session = Depends(get_db),
    user:       Usuario = Depends(require_role("admin", "operador")),
):
    """
    Admin confirma se o membro entregou (confirmado) ou não (nao_entregue).

    Usa optimistic locking: o frontend deve enviar a `version` lida.
    Se outro admin já modificou a seleção, retorna 409.

    Body obrigatório:
      { "novo_status": "confirmado" | "nao_entregue", "version": <int> }

    Erros possíveis:
      404: seleção não encontrada
      403: seleção de outro terreiro
      400: transição inválida
      409: conflito de version (outro admin confirmou primeiro)
    """
    selecao = ajeum_service.confirmar_selecao(db, selecao_id, data, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "SELECAO_CONFIRMADA",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = (
            f"Seleção confirmada: selecao={selecao_id} "
            f"status={data.novo_status} version={data.version}"
        ),
    )

    return {
        "ok":      True,
        "status":  selecao.status,
        "version": selecao.version,
    }


# ══════════════════════════════════════════════════════════════════════════════
# EDITAR ITEM
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ajeum/{ajeum_id}/itens", status_code=status.HTTP_201_CREATED)
def adicionar_item(
    ajeum_id: UUID,
    data:     AjeumItemCreate,
    request:  Request,
    db:       Session = Depends(get_db),
    user:     Usuario = Depends(require_role("admin", "operador")),
):
    """
    Adiciona um item avulso a um Ajeum já existente.
    Usado pelo FormAdicionarItem no frontend quando o Ajeum já foi criado.

    Erros possíveis:
      404: Ajeum não encontrado
      403: Ajeum de outro terreiro
      422: campos inválidos (limite < 1, descrição vazia)
    """
    item = ajeum_service.adicionar_item(db, ajeum_id, data, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "ITEM_ADICIONADO",
        level   = "INFO",
        user_id = user.id,
        status  = 201,
        message = f"Item adicionado: ajeum={ajeum_id} descricao={data.descricao}",
    )

    return {
        "ok":       True,
        "id":       str(item.id),
        "descricao": item.descricao,
        "limite":   item.limite,
    }


@router.patch("/ajeum/itens/{item_id}")
def editar_item(
    item_id: UUID,
    data:    AjeumItemEdit,
    request: Request,
    db:      Session = Depends(get_db),
    user:    Usuario = Depends(require_role("admin", "operador")),
):
    """
    Edita descrição ou limite de um item.

    Reduzir limite abaixo de seleções ativas é rejeitado com 409.

    Erros possíveis:
      404: item não encontrado ou deletado
      403: item de outro terreiro
      409: novo limite menor que seleções ativas
      422: campos inválidos
    """
    item = ajeum_service.editar_item(db, item_id, data, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "ITEM_EDITADO",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Item editado: item={item_id}",
    )

    return {
        "ok":       True,
        "id":       str(item.id),
        "descricao": item.descricao,
        "limite":   item.limite,
    }


# ══════════════════════════════════════════════════════════════════════════════
# DELETAR ITEM (SOFT DELETE)
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/ajeum/itens/{item_id}")
def deletar_item(
    item_id: UUID,
    request: Request,
    db:      Session = Depends(get_db),
    user:    Usuario = Depends(require_role("admin", "operador")),
):
    """
    Soft delete de um item.
    Item com seleções ativas não pode ser removido (retorna 409).

    Erros possíveis:
      404: item não encontrado ou já deletado
      403: item de outro terreiro
      409: item com seleções ativas (não canceladas)
    """
    resultado = ajeum_service.deletar_item(db, item_id, user)

    audit_service.log(
        db, request,
        context = "ajeum",
        action  = "ITEM_DELETADO",
        level   = "WARNING",
        user_id = user.id,
        status  = 200,
        message = f"Item soft-deleted: item={item_id}",
    )

    return resultado