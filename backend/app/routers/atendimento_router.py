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

router = APIRouter(tags=["atendimentos"])


@router.get("/atendimentos", response_model=list[AtendimentoTipoResponse])
def listar_tipos_atendimento(
    ativos: bool = Query(default=False),
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
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
