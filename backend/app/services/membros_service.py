"""
membros_service.py — AxeFlow

Regras de negócio relacionadas ao gerenciamento de membros:
- Listagem de membros
- Criação de membro
- Atualização de membro
- Consulta de dados do membro

A lógica de presença em giras permanece em:
    app.services.presenca_membro_service
"""

from datetime import date
import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.services.email_service import send_convite_membro
from app.models.gira import Gira
from app.models.inscricao_membro import InscricaoMembro
from app.services.presenca_membro_service import calcular_score_membro
from app.utils.enuns import StatusInscricaoEnum

logger = logging.getLogger(__name__)


def list_membros(db: Session, terreiro_id: UUID, ) -> list[dict]:
    """
    Lista os membros ativos de um terreiro.
    """

    membros = (db.query(Usuario).filter(Usuario.terreiro_id == terreiro_id, Usuario.ativo.is_(True),).all())

    return [
        {
            "id": str(membro.id),
            "nome": membro.nome,
            "email": membro.email,
            "telefone": membro.telefone,
            "role": membro.role,
            "ativo": membro.ativo,
        }
        for membro in membros
    ]


def create_membro(
    db: Session,
    *,
    terreiro_id: UUID,
    nome: str,
    email: str,
    senha: str,
    telefone: str | None = None,
    role: str = "membro",
    convidado_por: str | None = None,
) -> dict:
    """
    Cria um novo membro associado ao terreiro.

    Também tenta enviar o email de convite.
    A falha no envio do email não impede a criação do membro.
    """

    existing = (
        db.query(Usuario)
        .filter(Usuario.email == email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email já cadastrado",
        )

    if role not in ("admin", "operador", "membro"):
        raise HTTPException(
            status_code=400,
            detail="Role inválida",
        )

    novo = Usuario(
        terreiro_id=terreiro_id,
        nome=nome,
        email=email,
        telefone=telefone,
        senha_hash=hash_password(senha),
        role=role,
    )

    db.add(novo)
    db.commit()
    db.refresh(novo)

    terreiro = (
        db.query(Terreiro)
        .filter(Terreiro.id == terreiro_id)
        .first()
    )

    terreiro_nome = (
        terreiro.nome
        if terreiro
        else "seu terreiro"
    )

    email_enviado = False

    try:
        email_enviado = send_convite_membro(
            nome=nome,
            email=email,
            senha_provisoria=senha,
            terreiro_nome=terreiro_nome,
            convidado_por=convidado_por or "Administrador",
            app_url=settings.app_url_resolved,
        )

        if not email_enviado:
            logger.warning(
                "[Membros] Email de convite não enviado para %s "
                "(BREVO_API_KEY configurada?)",
                email,
            )

    except Exception:
        logger.exception(
            "[Membros] Erro ao enviar email de convite para %s",
            email,
        )

    return {
        "id": str(novo.id),
        "nome": novo.nome,
        "email": novo.email,
        "telefone": novo.telefone,
        "role": novo.role,
        "ativo": novo.ativo,
        "email_convite_enviado": email_enviado,
    }


def get_membro(
    db: Session,
    *,
    membro_id: UUID,
    terreiro_id: UUID,
) -> Usuario:
    """
    Obtém um membro garantindo que ele pertence ao terreiro informado.
    """

    membro = (
        db.query(Usuario)
        .filter(
            Usuario.id == membro_id,
            Usuario.terreiro_id == terreiro_id,
        )
        .first()
    )

    if not membro:
        raise HTTPException(
            status_code=404,
            detail="Membro não encontrado",
        )

    return membro


def update_membro(
    db: Session,
    *,
    membro_id: UUID,
    terreiro_id: UUID,
    nome: str | None = None,
    telefone: str | None = None,
    role: str | None = None,
    ativo: bool | None = None,
    senha: str | None = None,
    current_user_id: UUID | None = None,
) -> dict:
    """
    Atualiza os dados de um membro.

    Regras:
    - O membro precisa pertencer ao terreiro.
    - Um usuário não pode desativar a própria conta.
    - Role deve ser uma das roles válidas.
    """

    membro = get_membro(
        db,
        membro_id=membro_id,
        terreiro_id=terreiro_id,
    )

    if (
        current_user_id is not None
        and membro.id == current_user_id
        and ativo is False
    ):
        raise HTTPException(
            status_code=400,
            detail="Você não pode desativar sua própria conta",
        )

    if role is not None:
        if role not in ("admin", "operador", "membro"):
            raise HTTPException(
                status_code=400,
                detail="Role inválida",
            )

        membro.role = role

    if nome is not None:
        membro.nome = nome

    if telefone is not None:
        membro.telefone = telefone

    if ativo is not None:
        membro.ativo = ativo

    if senha:
        membro.senha_hash = hash_password(senha)

    db.commit()
    db.refresh(membro)

    return {
        "id": str(membro.id),
        "nome": membro.nome,
        "email": membro.email,
        "telefone": membro.telefone,
        "role": membro.role,
        "ativo": membro.ativo,
    }
   
    
def get_perfil_membro(db: Session, membro_id: UUID, terreiro_id: UUID) -> dict | None:
    """
    Perfil completo de um membro: score + histórico de giras.

    Valida que o membro pertence ao terreiro.
    Retorna None se não encontrado.
    """
    membro = db.query(Usuario).filter(
        Usuario.id == membro_id,
        Usuario.terreiro_id == terreiro_id,
        Usuario.ativo == True,
    ).first()

    if not membro:
        return None

    # Carrega giras ativas do terreiro para montar o histórico
    giras_map = {
        str(g.id): g
        for g in db.query(Gira).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        ).all()
    }

    # Histórico de inscrições do membro neste terreiro, mais recente primeiro
    inscricoes = (
        db.query(InscricaoMembro)
        .filter(
            InscricaoMembro.membro_id == membro_id,
            InscricaoMembro.gira_id.in_(list(giras_map.keys())),
        )
        .order_by(InscricaoMembro.created_at.desc())
        .all()
    )

    # Agrega métricas e monta histórico em um único loop
    total = comparecimentos = faltas = cancelamentos = 0
    datas_presenca = []
    historico = []

    for i in inscricoes:
        gira = giras_map.get(str(i.gira_id))
        if not gira:
            continue

        historico.append({
            "inscricao_id": str(i.id),
            "gira_id": str(gira.id),
            "gira_titulo": gira.titulo,
            "gira_tipo": gira.tipo,
            "gira_data": gira.data.isoformat(),
            "posicao": i.posicao,
            "status": i.status,
            "inscrito_em": i.created_at.isoformat(),
        })

        if i.status == StatusInscricaoEnum.cancelado:
            cancelamentos += 1
            continue

        total += 1
        if i.status == StatusInscricaoEnum.compareceu:
            comparecimentos += 1
            datas_presenca.append(gira.data)
        elif i.status == StatusInscricaoEnum.faltou:
            faltas += 1

    datas_presenca.sort()

    # Status de engajamento baseado na última visita
    if not datas_presenca:
        status_retorno = "nunca_compareceu"
        dias_ausente = None
        ultima_visita = None
        primeira_data = None
    else:
        dias_ausente = (date.today() - datas_presenca[-1]).days
        ultima_visita = datas_presenca[-1].isoformat()
        primeira_data = datas_presenca[0].isoformat()

        if dias_ausente <= 60:
            status_retorno = "ativo"
        elif dias_ausente <= 180:
            status_retorno = "morno"
        else:
            status_retorno = "inativo"

    score = calcular_score_membro(total, comparecimentos, faltas)

    return {
        "id": str(membro.id),
        "nome": membro.nome,
        "email": membro.email,
        "telefone": membro.telefone,
        "role": membro.role,
        "cadastrado_em": membro.created_at.isoformat(),
        "score": score,
        "status_retorno": status_retorno,
        "ultima_visita": ultima_visita,
        "primeira_data": primeira_data,
        "dias_ausente": dias_ausente,
        "stats": {
            "total_inscricoes": total,
            "comparecimentos": comparecimentos,
            "faltas": faltas,
            "cancelamentos": cancelamentos,
        },
        "historico": historico,
    }