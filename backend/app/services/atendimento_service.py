import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.atendimento import (
    Agendamento,
    AtendimentoTipo,
    StatusAgendamentoEnum,
    TipoCobrancaAtendimentoEnum,
)
from app.models.consulente import Consulente
from app.models.usuario import Usuario
from app.schemas.atendimento_schema import (
    AgendamentoCreate,
    AgendamentoUpdate,
    AtendimentoTipoCreate,
    AtendimentoTipoUpdate,
)

logger = logging.getLogger(__name__)

DINHEIRO = Decimal("0.01")
DURACAO_PADRAO_SERVICO = timedelta(hours=1)


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(DINHEIRO, rounding=ROUND_HALF_UP)


def _get_tipo(db: Session, tipo_id: UUID, terreiro_id: UUID) -> AtendimentoTipo:
    tipo = (
        db.query(AtendimentoTipo)
        .filter(
            AtendimentoTipo.id == tipo_id,
            AtendimentoTipo.terreiro_id == terreiro_id,
        )
        .first()
    )
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de atendimento nao encontrado")
    return tipo


def _get_consulente(db: Session, consulente_id: UUID, terreiro_id: UUID) -> Consulente:
    consulente = (
        db.query(Consulente)
        .filter(
            Consulente.id == consulente_id,
            Consulente.terreiro_id == terreiro_id,
            Consulente.deleted_at.is_(None),
        )
        .first()
    )
    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente nao encontrado")
    return consulente


def _montar_intervalo_e_valor(
    tipo: AtendimentoTipo,
    data,
    hora_inicio,
    hora_fim=None,
) -> tuple[datetime, datetime, Decimal]:
    inicio = datetime.combine(data, hora_inicio)

    if tipo.tipo_cobranca == TipoCobrancaAtendimentoEnum.servico:
        fim = inicio + DURACAO_PADRAO_SERVICO
        return inicio, fim, _money(tipo.valor)

    if hora_fim is None:
        raise HTTPException(
            status_code=400,
            detail="Hora final e obrigatoria para atendimento cobrado por hora",
        )

    fim = datetime.combine(data, hora_fim)
    if fim <= inicio:
        raise HTTPException(
            status_code=400,
            detail="Hora final deve ser maior que a hora inicial",
        )

    duracao_horas = Decimal((fim - inicio).total_seconds()) / Decimal("3600")
    return inicio, fim, _money(Decimal(tipo.valor) * duracao_horas)


def _validar_conflito(
    db: Session,
    terreiro_id: UUID,
    inicio: datetime,
    fim: datetime,
    agendamento_id: UUID | None = None,
) -> None:
    query = db.query(Agendamento).filter(
        Agendamento.terreiro_id == terreiro_id,
        Agendamento.status == StatusAgendamentoEnum.agendado,
        Agendamento.inicio < fim,
        Agendamento.fim > inicio,
    )

    if agendamento_id:
        query = query.filter(Agendamento.id != agendamento_id)

    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ja existe um agendamento ativo nesse horario",
        )


def _agendamento_to_dict(agendamento: Agendamento) -> dict:
    duracao = Decimal((agendamento.fim - agendamento.inicio).total_seconds()) / Decimal("3600")
    return {
        "id": agendamento.id,
        "terreiro_id": agendamento.terreiro_id,
        "consulente_id": agendamento.consulente_id,
        "atendimento_tipo_id": agendamento.atendimento_tipo_id,
        "inicio": agendamento.inicio,
        "fim": agendamento.fim,
        "valor": agendamento.valor,
        "status": agendamento.status,
        "observacoes": agendamento.observacoes,
        "created_at": agendamento.created_at,
        "updated_at": agendamento.updated_at,
        "created_by": agendamento.created_by,
        "duracao_horas": duracao.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "consulente": agendamento.consulente,
        "atendimento_tipo": agendamento.atendimento_tipo,
    }
    
def _get_agendamento(db: Session, agendamento_id: UUID, user: Usuario,) -> Agendamento:
    query = db.query(Agendamento).filter(
        Agendamento.id == agendamento_id,
        Agendamento.terreiro_id == user.terreiro_id,
    )

    if user.role == "operador":
        query = query.filter(
            Agendamento.created_by == user.id
        )

    agendamento = query.first()

    if not agendamento:
        raise HTTPException(
            status_code=404,
            detail="Agendamento nao encontrado",
        )

    return agendamento


def listar_tipos(db: Session, terreiro_id: UUID, somente_ativos: bool = False) -> list[dict]:
    total_agendamentos = func.count(Agendamento.id).label("total_agendamentos")
    query = (
        db.query(AtendimentoTipo, total_agendamentos)
        .outerjoin(Agendamento, Agendamento.atendimento_tipo_id == AtendimentoTipo.id)
        .filter(AtendimentoTipo.terreiro_id == terreiro_id)
        .group_by(AtendimentoTipo.id)
        .order_by(AtendimentoTipo.nome.asc())
    )

    if somente_ativos:
        query = query.filter(AtendimentoTipo.ativo.is_(True))

    return [
        {
            "id": tipo.id,
            "terreiro_id": tipo.terreiro_id,
            "nome": tipo.nome,
            "descricao": tipo.descricao,
            "valor": tipo.valor,
            "tipo_cobranca": tipo.tipo_cobranca,
            "ativo": tipo.ativo,
            "created_at": tipo.created_at,
            "updated_at": tipo.updated_at,
            "created_by": tipo.created_by,
            "total_agendamentos": total or 0,
        }
        for tipo, total in query.all()
    ]


def criar_tipo(db: Session, data: AtendimentoTipoCreate, user: Usuario) -> AtendimentoTipo:
    tipo = AtendimentoTipo(
        terreiro_id=user.terreiro_id,
        nome=data.nome.strip(),
        descricao=data.descricao.strip() if data.descricao else None,
        valor=_money(data.valor),
        tipo_cobranca=data.tipo_cobranca,
        ativo=data.ativo,
        created_by=user.id,
    )
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    logger.info("[Atendimentos] Tipo criado: %s por %s", tipo.id, user.id)
    return tipo


def atualizar_tipo(
    db: Session,
    tipo_id: UUID,
    data: AtendimentoTipoUpdate,
    user: Usuario,
) -> AtendimentoTipo:
    tipo = _get_tipo(db, tipo_id, user.terreiro_id)

    dados = data.model_dump(exclude_unset=True)
    if "nome" in dados and dados["nome"] is not None:
        tipo.nome = dados["nome"].strip()
    if "descricao" in dados:
        tipo.descricao = dados["descricao"].strip() if dados["descricao"] else None
    if "valor" in dados and dados["valor"] is not None:
        tipo.valor = _money(dados["valor"])
    if "tipo_cobranca" in dados and dados["tipo_cobranca"] is not None:
        tipo.tipo_cobranca = dados["tipo_cobranca"]
    if "ativo" in dados and dados["ativo"] is not None:
        tipo.ativo = dados["ativo"]

    db.commit()
    db.refresh(tipo)
    return tipo


def remover_tipo(db: Session, tipo_id: UUID, user: Usuario) -> dict:
    tipo = _get_tipo(db, tipo_id, user.terreiro_id)
    tem_historico = (
        db.query(Agendamento.id)
        .filter(Agendamento.atendimento_tipo_id == tipo_id)
        .first()
        is not None
    )

    if tem_historico:
        tipo.ativo = False
        db.commit()
        return {"ok": True, "desativado": True}

    db.delete(tipo)
    db.commit()
    return {"ok": True, "desativado": False}


def listar_agendamentos(db: Session, user: Usuario, status_filter: str | None = None,) -> list[dict]:
    query = (
        db.query(Agendamento)
        .options(
            joinedload(Agendamento.consulente),
            joinedload(Agendamento.atendimento_tipo),
        )
        .filter(
            Agendamento.terreiro_id == user.terreiro_id
        )
        .order_by(Agendamento.inicio.desc())
    )

    if user.role == "operador":
        query = query.filter(
            Agendamento.created_by == user.id
        )

    if status_filter:
        query = query.filter(
            Agendamento.status == status_filter
        )

    return [
        _agendamento_to_dict(agendamento)
        for agendamento in query.all()
    ]


def criar_agendamento(db: Session, data: AgendamentoCreate, user: Usuario) -> Agendamento:
    _get_consulente(db, data.consulente_id, user.terreiro_id)
    tipo = _get_tipo(db, data.atendimento_tipo_id, user.terreiro_id)

    if not tipo.ativo:
        raise HTTPException(
            status_code=400,
            detail="Tipo de atendimento inativo nao pode ser usado em novos agendamentos",
        )

    inicio, fim, valor = _montar_intervalo_e_valor(
        tipo,
        data.data,
        data.hora_inicio,
        data.hora_fim,
    )
    _validar_conflito(db, user.terreiro_id, inicio, fim)

    agendamento = Agendamento(
        terreiro_id=user.terreiro_id,
        consulente_id=data.consulente_id,
        atendimento_tipo_id=data.atendimento_tipo_id,
        inicio=inicio,
        fim=fim,
        valor=valor,
        status=StatusAgendamentoEnum.agendado,
        observacoes=data.observacoes.strip() if data.observacoes else None,
        created_by=user.id,
    )
    db.add(agendamento)
    db.commit()
    db.refresh(agendamento)
    return agendamento


def atualizar_agendamento(db: Session, agendamento_id: UUID, data: AgendamentoUpdate, user: Usuario,) -> Agendamento:
    agendamento = _get_agendamento(db, agendamento_id, user,)
    
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    dados = data.model_dump(exclude_unset=True)

    consulente_id = dados.get("consulente_id", agendamento.consulente_id)
    tipo_id = dados.get("atendimento_tipo_id", agendamento.atendimento_tipo_id)

    _get_consulente(db, consulente_id, user.terreiro_id)
    tipo = _get_tipo(db, tipo_id, user.terreiro_id)

    if "atendimento_tipo_id" in dados and not tipo.ativo:
        raise HTTPException(
            status_code=400,
            detail="Tipo de atendimento inativo nao pode ser selecionado",
        )

    data_base = dados.get("data", agendamento.inicio.date())
    hora_inicio = dados.get("hora_inicio", agendamento.inicio.time())
    hora_fim = dados.get("hora_fim", agendamento.fim.time())
    inicio, fim, valor = _montar_intervalo_e_valor(tipo, data_base, hora_inicio, hora_fim)

    if agendamento.status == StatusAgendamentoEnum.agendado:
        _validar_conflito(db, user.terreiro_id, inicio, fim, agendamento.id)

    agendamento.consulente_id = consulente_id
    agendamento.atendimento_tipo_id = tipo_id
    agendamento.inicio = inicio
    agendamento.fim = fim
    agendamento.valor = valor
    if "observacoes" in dados:
        agendamento.observacoes = dados["observacoes"].strip() if dados["observacoes"] else None

    db.commit()
    db.refresh(agendamento)
    return agendamento


def alterar_status_agendamento(
    db: Session,
    agendamento_id: UUID,
    novo_status: str,
    user: Usuario,
) -> Agendamento:
    agendamento = _get_agendamento(db, agendamento_id, user,)
    
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    if agendamento.status != StatusAgendamentoEnum.agendado:
        if agendamento.status == novo_status:
            return agendamento
        raise HTTPException(
            status_code=400,
            detail="Somente agendamentos com status agendado podem mudar de status",
        )

    agendamento.status = novo_status
    db.commit()
    db.refresh(agendamento)
    return agendamento
