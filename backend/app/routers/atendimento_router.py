from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.schemas.atendimento_schema import (
    AgendamentoCreate,
    AgendamentoResponse,
    AgendamentoStatusUpdate,
    AgendamentoUpdate,
    AtendimentoTipoCreate,
    AtendimentoTipoResponse,
    AtendimentoTipoUpdate,
)
from app.services import atendimento_service, audit_service

from fastapi import HTTPException
from app.core.security import get_current_user_with_api_key
from app.services.api_key_service import verificar_scope

router = APIRouter(tags=["atendimentos"])


@router.get("/atendimentos", response_model=list[AtendimentoTipoResponse])
def listar_tipos_atendimento(
    ativos: bool = Query(default=False),
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return atendimento_service.listar_tipos(
        db,
        terreiro_id=user.terreiro_id,
        somente_ativos=ativos,
    )


@router.post(
    "/atendimentos",
    response_model=AtendimentoTipoResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_tipo_atendimento(
    data: AtendimentoTipoCreate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:create"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:create",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    tipo = atendimento_service.criar_tipo(db, data, user)
    audit_service.log(
        db,
        request,
        context="atendimentos",
        action="ATENDIMENTO_TIPO_CRIADO",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Tipo de atendimento criado: {tipo.nome}",
    )
    return tipo


@router.patch("/atendimentos/{tipo_id}", response_model=AtendimentoTipoResponse)
def atualizar_tipo_atendimento(
    tipo_id: UUID,
    data: AtendimentoTipoUpdate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:update"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:update",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    tipo = atendimento_service.atualizar_tipo(db, tipo_id, data, user)
    audit_service.log(
        db,
        request,
        context="atendimentos",
        action="ATENDIMENTO_TIPO_ATUALIZADO",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Tipo de atendimento atualizado: {tipo.id}",
    )
    return tipo


@router.delete("/atendimentos/{tipo_id}")
def remover_tipo_atendimento(
    tipo_id: UUID,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:delete"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:delete",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    resultado = atendimento_service.remover_tipo(db, tipo_id, user)
    audit_service.log(
        db,
        request,
        context="atendimentos",
        action="ATENDIMENTO_TIPO_REMOVIDO",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Tipo de atendimento removido/desativado: {tipo_id}",
    )
    return resultado


@router.get("/agendamentos", response_model=list[AgendamentoResponse])
def listar_agendamentos(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return atendimento_service.listar_agendamentos(
        db,
        terreiro_id=user.terreiro_id,
        status_filter=status_filter,
    )


@router.post(
    "/agendamentos",
    response_model=AgendamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_agendamento(
    data: AgendamentoCreate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    agendamento = atendimento_service.criar_agendamento(db, data, user)
    audit_service.log(
        db,
        request,
        context="agendamentos",
        action="AGENDAMENTO_CRIADO",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Agendamento criado: {agendamento.id}",
    )
    return agendamento


@router.patch("/agendamentos/{agendamento_id}", response_model=AgendamentoResponse)
def atualizar_agendamento(
    agendamento_id: UUID,
    data: AgendamentoUpdate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    agendamento = atendimento_service.atualizar_agendamento(db, agendamento_id, data, user)
    audit_service.log(
        db,
        request,
        context="agendamentos",
        action="AGENDAMENTO_ATUALIZADO",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Agendamento atualizado: {agendamento.id}",
    )
    return agendamento


@router.patch("/agendamentos/{agendamento_id}/status", response_model=AgendamentoResponse)
def alterar_status_agendamento(
    agendamento_id: UUID,
    data: AgendamentoStatusUpdate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    agendamento = atendimento_service.alterar_status_agendamento(
        db,
        agendamento_id,
        data.status,
        user,
    )
    audit_service.log(
        db,
        request,
        context="agendamentos",
        action=f"AGENDAMENTO_{data.status.upper()}",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Status do agendamento alterado: {agendamento.id} -> {data.status}",
    )
    return agendamento


@router.post("/agendamentos/{agendamento_id}/cancelar", response_model=AgendamentoResponse)
def cancelar_agendamento(
    agendamento_id: UUID,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    agendamento = atendimento_service.alterar_status_agendamento(
        db,
        agendamento_id,
        "cancelado",
        user,
    )
    audit_service.log(
        db,
        request,
        context="agendamentos",
        action="AGENDAMENTO_CANCELADO",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Agendamento cancelado: {agendamento.id}",
    )
    return agendamento


@router.post("/agendamentos/{agendamento_id}/concluir", response_model=AgendamentoResponse)
def concluir_agendamento(
    agendamento_id: UUID,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "atendimentos:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para atendimentos:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    agendamento = atendimento_service.alterar_status_agendamento(
        db,
        agendamento_id,
        "concluido",
        user,
    )
    audit_service.log(
        db,
        request,
        context="agendamentos",
        action="AGENDAMENTO_CONCLUIDO",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Agendamento concluido: {agendamento.id}",
    )
    return agendamento
