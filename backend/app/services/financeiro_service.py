from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.atendimento import Agendamento
from app.models.financeiro import (
    ContaReceber,
    FormaPagamento,
    Pagamento,
    Recibo,
    StatusContaReceberEnum,
)
from app.models.usuario import Usuario
from app.schemas.financeiro_schema import (
    ContaReceberCreate,
    FormaPagamentoCreate,
    FormaPagamentoUpdate,
    PagamentoCreate,
)


DINHEIRO = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(
        DINHEIRO,
        rounding=ROUND_HALF_UP,
    )


# ============================================================
# FORMAS DE PAGAMENTO
# ============================================================


def _get_forma_pagamento(
    db: Session,
    forma_id: UUID,
    terreiro_id: UUID,
) -> FormaPagamento:

    forma = (
        db.query(FormaPagamento)
        .filter(
            FormaPagamento.id == forma_id,
            FormaPagamento.terreiro_id == terreiro_id,
        )
        .first()
    )

    if not forma:
        raise HTTPException(
            status_code=404,
            detail="Forma de pagamento nao encontrada",
        )

    return forma


def listar_formas_pagamento(
    db: Session,
    terreiro_id: UUID,
    somente_ativas: bool = False,
) -> list[FormaPagamento]:

    query = (
        db.query(FormaPagamento)
        .filter(
            FormaPagamento.terreiro_id == terreiro_id,
        )
        .order_by(FormaPagamento.nome.asc())
    )

    if somente_ativas:
        query = query.filter(
            FormaPagamento.ativo.is_(True),
        )

    return query.all()


def criar_forma_pagamento(
    db: Session,
    data: FormaPagamentoCreate,
    user: Usuario,
) -> FormaPagamento:

    nome = data.nome.strip()

    if not nome:
        raise HTTPException(
            status_code=400,
            detail="Nome da forma de pagamento e obrigatorio",
        )

    existente = (
        db.query(FormaPagamento)
        .filter(
            FormaPagamento.terreiro_id == user.terreiro_id,
            func.lower(FormaPagamento.nome) == nome.lower(),
        )
        .first()
    )

    if existente:
        raise HTTPException(
            status_code=409,
            detail="Ja existe uma forma de pagamento com esse nome",
        )

    forma = FormaPagamento(
        terreiro_id=user.terreiro_id,
        nome=nome,
        ativo=data.ativo,
        created_by=user.id,
    )

    db.add(forma)
    db.commit()
    db.refresh(forma)

    return forma


def atualizar_forma_pagamento(
    db: Session,
    forma_id: UUID,
    data: FormaPagamentoUpdate,
    user: Usuario,
) -> FormaPagamento:

    forma = _get_forma_pagamento(
        db,
        forma_id,
        user.terreiro_id,
    )

    dados = data.model_dump(exclude_unset=True)

    if "nome" in dados and dados["nome"] is not None:
        nome = dados["nome"].strip()

        if not nome:
            raise HTTPException(
                status_code=400,
                detail="Nome da forma de pagamento e obrigatorio",
            )

        existente = (
            db.query(FormaPagamento)
            .filter(
                FormaPagamento.terreiro_id == user.terreiro_id,
                FormaPagamento.id != forma.id,
                func.lower(FormaPagamento.nome) == nome.lower(),
            )
            .first()
        )

        if existente:
            raise HTTPException(
                status_code=409,
                detail="Ja existe uma forma de pagamento com esse nome",
            )

        forma.nome = nome

    if "ativo" in dados and dados["ativo"] is not None:
        forma.ativo = dados["ativo"]

    db.commit()
    db.refresh(forma)

    return forma


def remover_forma_pagamento(
    db: Session,
    forma_id: UUID,
    user: Usuario,
) -> dict:

    forma = _get_forma_pagamento(
        db,
        forma_id,
        user.terreiro_id,
    )

    tem_historico = (
        db.query(Pagamento.id)
        .filter(
            Pagamento.forma_pagamento_id == forma.id,
        )
        .first()
        is not None
    )

    if tem_historico:
        forma.ativo = False
        db.commit()

        return {
            "ok": True,
            "desativado": True,
        }

    db.delete(forma)
    db.commit()

    return {
        "ok": True,
        "desativado": False,
    }


# ============================================================
# CONTA A RECEBER
# ============================================================


def _get_agendamento(
    db: Session,
    agendamento_id: UUID,
    terreiro_id: UUID,
) -> Agendamento:

    agendamento = (
        db.query(Agendamento)
        .filter(
            Agendamento.id == agendamento_id,
            Agendamento.terreiro_id == terreiro_id,
        )
        .first()
    )

    if not agendamento:
        raise HTTPException(
            status_code=404,
            detail="Agendamento nao encontrado",
        )

    return agendamento


def _get_conta(
    db: Session,
    conta_id: UUID,
    terreiro_id: UUID,
    for_update: bool = False,
) -> ContaReceber:

    query = (
        db.query(ContaReceber)
        .filter(
            ContaReceber.id == conta_id,
            ContaReceber.terreiro_id == terreiro_id,
        )
    )

    if for_update:
        query = query.with_for_update()

    conta = query.first()

    if not conta:
        raise HTTPException(
            status_code=404,
            detail="Conta a receber nao encontrada",
        )

    return conta


def criar_conta_receber(
    db: Session,
    data: ContaReceberCreate,
    user: Usuario,
) -> ContaReceber:

    agendamento = _get_agendamento(
        db,
        data.agendamento_id,
        user.terreiro_id,
    )

    if agendamento.status == "cancelado":
        raise HTTPException(
            status_code=400,
            detail="Nao e possivel criar conta para agendamento cancelado",
        )

    existente = (
        db.query(ContaReceber)
        .filter(
            ContaReceber.agendamento_id == agendamento.id,
            ContaReceber.terreiro_id == user.terreiro_id,
        )
        .first()
    )

    if existente:
        raise HTTPException(
            status_code=409,
            detail="Ja existe uma conta a receber para este agendamento",
        )

    conta = ContaReceber(
        terreiro_id=user.terreiro_id,
        agendamento_id=agendamento.id,
        consulente_id=agendamento.consulente_id,
        descricao=agendamento.atendimento_tipo.nome,
        valor=_money(agendamento.valor),
        status=StatusContaReceberEnum.pendente,
        data_vencimento=data.data_vencimento,
        created_by=user.id,
    )

    db.add(conta)
    db.commit()
    db.refresh(conta)

    return conta


def listar_contas_receber(
    db: Session,
    terreiro_id: UUID,
    status_filter: str | None = None,
) -> list[ContaReceber]:

    query = (
        db.query(ContaReceber)
        .filter(
            ContaReceber.terreiro_id == terreiro_id,
        )
        .order_by(
            ContaReceber.created_at.desc(),
        )
    )

    if status_filter:
        query = query.filter(
            ContaReceber.status == status_filter,
        )

    return query.all()


def obter_conta_receber(
    db: Session,
    conta_id: UUID,
    user: Usuario,
) -> ContaReceber:

    return _get_conta(
        db,
        conta_id,
        user.terreiro_id,
    )


# ============================================================
# PAGAMENTOS
# ============================================================


def _recalcular_status_conta(
    db: Session,
    conta: ContaReceber,
) -> None:

    total_pago = (
        db.query(
            func.coalesce(
                func.sum(Pagamento.valor),
                0,
            )
        )
        .filter(
            Pagamento.conta_receber_id == conta.id,
            Pagamento.terreiro_id == conta.terreiro_id,
        )
        .scalar()
    )

    total_pago = _money(Decimal(total_pago))

    valor_conta = _money(Decimal(conta.valor))

    if total_pago <= Decimal("0"):
        conta.status = StatusContaReceberEnum.pendente
        conta.data_pagamento = None

    elif total_pago < valor_conta:
        conta.status = StatusContaReceberEnum.parcial
        conta.data_pagamento = None

    else:
        conta.status = StatusContaReceberEnum.pago

        ultimo_pagamento = (
            db.query(Pagamento)
            .filter(
                Pagamento.conta_receber_id == conta.id,
                Pagamento.terreiro_id == conta.terreiro_id,
            )
            .order_by(
                Pagamento.data_pagamento.desc(),
            )
            .first()
        )

        conta.data_pagamento = (
            ultimo_pagamento.data_pagamento
            if ultimo_pagamento
            else datetime.now().astimezone()
        )

def registrar_pagamento(
    db: Session,
    conta_id: UUID,
    data: PagamentoCreate,
    user: Usuario,
) -> Pagamento:

    # ========================================================
    # BLOQUEIA A CONTA DURANTE O REGISTRO DO PAGAMENTO
    # ========================================================

    conta = _get_conta(
        db,
        conta_id,
        user.terreiro_id,
        for_update=True,
    )

    if conta.status == StatusContaReceberEnum.cancelado:
        raise HTTPException(
            status_code=400,
            detail="Nao e possivel registrar pagamento em conta cancelada",
        )

    forma = _get_forma_pagamento(
        db,
        data.forma_pagamento_id,
        user.terreiro_id,
    )

    if not forma.ativo:
        raise HTTPException(
            status_code=400,
            detail="Forma de pagamento inativa",
        )

    valor = _money(data.valor)

    if valor <= Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="O valor do pagamento deve ser maior que zero",
        )

    # ========================================================
    # CALCULA O TOTAL PAGO JÁ EXISTENTE
    # ========================================================

    total_pago = (
        db.query(
            func.coalesce(
                func.sum(Pagamento.valor),
                0,
            )
        )
        .filter(
            Pagamento.conta_receber_id == conta.id,
            Pagamento.terreiro_id == user.terreiro_id,
        )
        .scalar()
    )

    total_pago = _money(
        Decimal(total_pago)
    )

    valor_conta = _money(
        Decimal(conta.valor)
    )

    saldo = _money(
        valor_conta - total_pago
    )

    # ========================================================
    # CONTA JÁ QUITADA
    # ========================================================

    if saldo <= Decimal("0"):
        _recalcular_status_conta(
            db,
            conta,
        )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A conta a receber ja esta totalmente paga",
        )

    # ========================================================
    # IMPEDE PAGAMENTO ACIMA DO SALDO
    # ========================================================

    if valor > saldo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Valor do pagamento excede o saldo da conta. "
                f"Saldo disponivel: {saldo}"
            ),
        )

    # ========================================================
    # CRIA PAGAMENTO
    # ========================================================

    pagamento = Pagamento(
        terreiro_id=user.terreiro_id,
        conta_receber_id=conta.id,
        forma_pagamento_id=forma.id,
        valor=valor,
        data_pagamento=(
            data.data_pagamento
            or datetime.now().astimezone()
        ),
        observacoes=(
            data.observacoes.strip()
            if data.observacoes
            else None
        ),
        created_by=user.id,
    )

    db.add(pagamento)

    # Garante que o pagamento esteja visível
    # para o recálculo dentro da mesma transação.
    db.flush()

    # ========================================================
    # RECALCULA STATUS
    # ========================================================

    _recalcular_status_conta(
        db,
        conta,
    )

    db.commit()
    db.refresh(pagamento)

    return pagamento

def listar_pagamentos(db, conta_id, user):
    pagamentos = (
        db.query(Pagamento)
        .filter(
            Pagamento.conta_receber_id == conta_id,
            Pagamento.terreiro_id == user.terreiro_id,
        )
        .order_by(Pagamento.data_pagamento.desc())
        .all()
    )

    resultado = []

    for pagamento in pagamentos:
        recibo = (
            db.query(Recibo)
            .filter(
                Recibo.pagamento_id == pagamento.id,
                Recibo.terreiro_id == user.terreiro_id,
            )
            .first()
        )

        pagamento.recibo_id = recibo.id if recibo else None
        pagamento.recibo_numero = recibo.numero if recibo else None

        resultado.append(pagamento)

    return resultado


# ============================================================
# RECIBOS
# ============================================================


def _proximo_numero_recibo(
    db: Session,
    terreiro_id: UUID,
) -> str:

    ultimo = (
        db.query(Recibo)
        .filter(
            Recibo.terreiro_id == terreiro_id,
        )
        .order_by(
            Recibo.created_at.desc(),
        )
        .first()
    )

    if not ultimo:
        numero = 1
    else:
        try:
            numero = int(ultimo.numero) + 1
        except ValueError:
            numero = (
                db.query(func.count(Recibo.id))
                .filter(
                    Recibo.terreiro_id == terreiro_id,
                )
                .scalar()
                or 0
            ) + 1

    return str(numero).zfill(6)


def gerar_recibo(
    db: Session,
    pagamento_id: UUID,
    user: Usuario,
) -> Recibo:

    pagamento = (
        db.query(Pagamento)
        .filter(
            Pagamento.id == pagamento_id,
            Pagamento.terreiro_id == user.terreiro_id,
        )
        .first()
    )

    if not pagamento:
        raise HTTPException(
            status_code=404,
            detail="Pagamento nao encontrado",
        )

    existente = (
        db.query(Recibo)
        .filter(
            Recibo.pagamento_id == pagamento.id,
            Recibo.terreiro_id == user.terreiro_id,
        )
        .first()
    )

    if existente:
        return existente

    recibo = Recibo(
        terreiro_id=user.terreiro_id,
        pagamento_id=pagamento.id,
        numero=_proximo_numero_recibo(
            db,
            user.terreiro_id,
        ),
        emitido_em=datetime.now().astimezone(),
        created_by=user.id,
    )

    db.add(recibo)
    db.commit()
    db.refresh(recibo)

    return recibo


def obter_recibo(
    db: Session,
    recibo_id: UUID,
    user: Usuario,
) -> Recibo:

    recibo = (
        db.query(Recibo)
        .filter(
            Recibo.id == recibo_id,
            Recibo.terreiro_id == user.terreiro_id,
        )
        .first()
    )

    if not recibo:
        raise HTTPException(
            status_code=404,
            detail="Recibo nao encontrado",
        )

    return recibo