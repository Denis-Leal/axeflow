from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.schemas.financeiro_schema import (
    ContaReceberCreate,
    ContaReceberResponse,
    FormaPagamentoCreate,
    FormaPagamentoResponse,
    FormaPagamentoUpdate,
    PagamentoCreate,
    PagamentoResponse,
    ReciboResponse,
)
from app.services import audit_service, financeiro_service
from fastapi import HTTPException
from app.core.security import get_current_user_with_api_key
from app.services.api_key_service import verificar_scope
from fastapi.responses import StreamingResponse
from app.services import export_service

router = APIRouter(
    tags=["financeiro"],
)


# ============================================================
# FORMAS DE PAGAMENTO
# ============================================================


@router.get(
    "/formas-pagamento",
    response_model=list[FormaPagamentoResponse],
)
def listar_formas_pagamento(
    ativas: bool = Query(default=False),
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return financeiro_service.listar_formas_pagamento(
        db,
        terreiro_id=user.terreiro_id,
        somente_ativas=ativas,
    )


@router.post(
    "/formas-pagamento",
    response_model=FormaPagamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_forma_pagamento(
    data: FormaPagamentoCreate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    forma = financeiro_service.criar_forma_pagamento(
        db,
        data,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="FORMA_PAGAMENTO_CRIADA",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Forma de pagamento criada: {forma.nome}",
    )

    return forma


@router.patch(
    "/formas-pagamento/{forma_id}",
    response_model=FormaPagamentoResponse,
)
def atualizar_forma_pagamento(
    forma_id: UUID,
    data: FormaPagamentoUpdate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    forma = financeiro_service.atualizar_forma_pagamento(
        db,
        forma_id,
        data,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="FORMA_PAGAMENTO_ATUALIZADA",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Forma de pagamento atualizada: {forma.id}",
    )

    return forma


@router.delete(
    "/formas-pagamento/{forma_id}",
)
def remover_forma_pagamento(
    forma_id: UUID,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    resultado = financeiro_service.remover_forma_pagamento(
        db,
        forma_id,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="FORMA_PAGAMENTO_REMOVIDA",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Forma de pagamento removida/desativada: {forma_id}",
    )

    return resultado


# ============================================================
# CONTAS A RECEBER
# ============================================================


@router.get(
    "/contas-receber",
    response_model=list[ContaReceberResponse],
)
def listar_contas_receber(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):

    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return financeiro_service.listar_contas_receber(
        db,
        terreiro_id=user.terreiro_id,
        status_filter=status_filter,
    )


@router.get(
    "/contas-receber/{conta_id}",
    response_model=ContaReceberResponse,
)
def obter_conta_receber(
    conta_id: UUID,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):

    user, api_key = auth
    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )
    return financeiro_service.obter_conta_receber(
        db,
        conta_id,
        user,
    )


@router.post(
    "/contas-receber",
    response_model=ContaReceberResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_conta_receber(
    data: ContaReceberCreate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):

    user, api_key = auth
    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )
    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )
    conta = financeiro_service.criar_conta_receber(
        db,
        data,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="CONTA_RECEBER_CRIADA",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Conta a receber criada: {conta.id}",
    )

    return conta


# ============================================================
# PAGAMENTOS
# ============================================================


@router.get(
    "/pagamentos",
    response_model=list[PagamentoResponse],
)
def listar_pagamentos(
    conta_id: Optional[UUID] = Query(default=None),
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):

    user, api_key = auth
    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return financeiro_service.listar_pagamentos(
        db,
        user=user,
        conta_id=conta_id,
    )


@router.post(
    "/contas-receber/{conta_id}/pagamentos",
    response_model=PagamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_pagamento(
    conta_id: UUID,
    data: PagamentoCreate,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth
    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )
    pagamento = financeiro_service.registrar_pagamento(
        db,
        conta_id,
        data,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="PAGAMENTO_REGISTRADO",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Pagamento registrado: {pagamento.id}",
    )

    return pagamento


# ============================================================
# RECIBOS
# ============================================================


@router.post(
    "/pagamentos/{pagamento_id}/recibo",
    response_model=ReciboResponse,
    status_code=status.HTTP_201_CREATED,
)
def gerar_recibo(
    pagamento_id: UUID,
    request: Request,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:write"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:write",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    recibo = financeiro_service.gerar_recibo(
        db,
        pagamento_id,
        user,
    )

    audit_service.log(
        db,
        request,
        context="financeiro",
        action="RECIBO_GERADO",
        level="INFO",
        user_id=user.id,
        status=201,
        message=f"Recibo gerado: {recibo.numero}",
    )

    return recibo


@router.get(
    "/recibos/{recibo_id}",
    response_model=ReciboResponse,
)
def obter_recibo(
    recibo_id: UUID,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(api_key, "financeiro:read"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key sem permissão para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Acesso negado. Necessário: admin, operador. "
                f"Seu perfil: {user.role}"
            ),
        )

    return financeiro_service.obter_recibo(
        db,
        recibo_id,
        user,
    )
    
@router.get("/recibos/{recibo_id}/pdf")
def obter_recibo_pdf(
    recibo_id: UUID,
    auth=Depends(get_current_user_with_api_key),
    db: Session = Depends(get_db),
):
    user, api_key = auth

    if api_key is not None:
        if not verificar_scope(
            api_key,
            "financeiro:read",
        ):
            raise HTTPException(
                status_code=403,
                detail="API key sem permissao para financeiro:read",
            )

    elif user.role not in ("admin", "operador"):
        raise HTTPException(
            status_code=403,
            detail="Sem permissao para acessar o financeiro",
        )

    arquivo = export_service.export_recibo_pdf(
        db,
        recibo_id,
        user.terreiro_id,
    )

    return StreamingResponse(
        arquivo.stream,
        media_type=arquivo.media_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{arquivo.filename}"'
            )
        },
    )