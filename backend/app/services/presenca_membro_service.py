"""
presenca_membro_service.py — AxeFlow
Score de presença de MEMBROS do terreiro.

Lógica análoga ao presenca_service.py (consulentes), mas usando
InscricaoMembro como fonte de dados.

Membros não têm fila de espera nem score público — o cálculo é
para uso interno do terreiro (painel administrativo).

Diferença em relação a consulentes:
  - Não existe status 'lista_espera' para membros
  - Cancelamento conta diferente: membro que cancela estava confirmado
    mas avisou — consideramos igual ao consulente (não penaliza)
  - O campo `total_inscricoes` conta apenas confirmado/compareceu/faltou
    (excluindo cancelado)
"""
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.inscricao_membro import InscricaoMembro
from app.models.inscricao_status import StatusInscricaoEnum
from app.models.gira import Gira
from app.models.usuario import Usuario


def calcular_score_membro(total: int, comparecimentos: int, faltas: int) -> dict:
    """
    Calcula score de confiabilidade de um membro.

    Regras idênticas ao score de consulentes:
    - Mínimo 2 inscrições finalizadas para ter score numérico
    - Score = comparecimentos / (comparecimentos + faltas) * 100
    - Confiável  >= 80%
    - Regular    50-79%
    - Risco      20-49%
    - Problemático < 20% com 3+ faltas
    """
    # Apenas giras com resultado definitivo (compareceu ou faltou)
    finalizadas = comparecimentos + faltas

    if finalizadas < 2:
        return {
            "score":           None,
            "label":           "Novo",
            "cor":             "cinza",
            "emoji":           "🆕",
            "alerta":          False,
            "comparecimentos": comparecimentos,
            "faltas":          faltas,
            "finalizadas":     finalizadas,
            "total_inscricoes": total,
        }

    taxa = round((comparecimentos / finalizadas) * 100)

    if taxa >= 80:
        label, cor, emoji = "Confiável", "verde", "✅"
    elif taxa >= 50:
        label, cor, emoji = "Regular", "amarelo", "⚠️"
    elif taxa >= 20:
        label, cor, emoji = "Risco", "laranja", "🔶"
    else:
        label, cor, emoji = "Problemático", "vermelho", "🚫"

    # Alerta: 3+ faltas E taxa abaixo de 50% — ocupa vaga sem comparecer
    alerta = faltas >= 3 and taxa < 50

    return {
        "score":            taxa,
        "label":            label,
        "cor":              cor,
        "emoji":            emoji,
        "alerta":           alerta,
        "comparecimentos":  comparecimentos,
        "faltas":           faltas,
        "finalizadas":      finalizadas,
        "total_inscricoes": total,
    }


def get_ranking_membros(db: Session, terreiro_id: UUID) -> list:
    """
    Retorna ranking de presença de todos os membros ativos do terreiro.

    Inclui membros que nunca se inscreveram (score zerado) para
    que o admin veja todos os membros numa única tela.

    Ordena: alertas primeiro, depois por score asc (piores no topo).
    """
    # IDs de todas as giras não-deletadas do terreiro
    gira_ids = [
        g.id for g in db.query(Gira.id).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        ).all()
    ]

    # Busca todos os membros ativos do terreiro
    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == terreiro_id,
        Usuario.ativo == True,
    ).all()

    if not membros:
        return []

    # Inicializa dados para todos os membros (inclusive os sem inscrições)
    dados: dict[str, dict] = {}
    for m in membros:
        dados[str(m.id)] = {
            "id":             str(m.id),
            "nome":           m.nome,
            "email":          m.email,
            "telefone":       m.telefone,
            "role":           m.role,
            "total":          0,
            "comparecimentos": 0,
            "faltas":         0,
        }

    # Agrega inscrições de membros nas giras do terreiro
    if gira_ids:
        inscricoes = (
            db.query(InscricaoMembro)
            .filter(InscricaoMembro.gira_id.in_(gira_ids))
            .all()
        )

        for i in inscricoes:
            mid = str(i.membro_id)
            if mid not in dados:
                # Membro inativo ou removido — ignora
                continue

            # Cancelamentos não contam no total (avisou)
            if i.status != StatusInscricaoEnum.cancelado:
                dados[mid]["total"] += 1

            if i.status == StatusInscricaoEnum.compareceu:
                dados[mid]["comparecimentos"] += 1
            elif i.status == StatusInscricaoEnum.faltou:
                dados[mid]["faltas"] += 1

    result = []
    for d in dados.values():
        score = calcular_score_membro(d["total"], d["comparecimentos"], d["faltas"])
        result.append({**d, **score})

    # Ordena: alertas primeiro, depois por score asc
    result.sort(key=lambda x: (
        not x.get("alerta", False),
        x.get("score") if x.get("score") is not None else 999,
    ))

    return result


def get_perfil_membro(db: Session, membro_id: UUID, terreiro_id: UUID) -> dict:
    """
    Perfil completo de um membro: score + histórico de giras.

    Valida que o membro pertence ao terreiro antes de retornar.
    Raises 404 implícito (retorna None) se não encontrar.
    """
    membro = db.query(Usuario).filter(
        Usuario.id == membro_id,
        Usuario.terreiro_id == terreiro_id,
        Usuario.ativo == True,
    ).first()

    if not membro:
        return None

    # Giras do terreiro para filtrar inscrições
    giras_map = {
        str(g.id): g
        for g in db.query(Gira).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        ).all()
    }

    # Histórico de inscrições do membro neste terreiro
    inscricoes = (
        db.query(InscricaoMembro)
        .filter(
            InscricaoMembro.membro_id == membro_id,
            InscricaoMembro.gira_id.in_(list(giras_map.keys())),
        )
        .order_by(InscricaoMembro.created_at.desc())
        .all()
    )

    # Monta histórico para exibição na tela de perfil
    historico = []
    for i in inscricoes:
        gira = giras_map.get(str(i.gira_id))
        if not gira:
            continue
        historico.append({
            "inscricao_id": str(i.id),
            "gira_id":      str(gira.id),
            "gira_titulo":  gira.titulo,
            "gira_tipo":    gira.tipo,
            "gira_data":    gira.data.isoformat(),
            "posicao":      i.posicao,
            "status":       i.status,
            "inscrito_em":  i.created_at.isoformat(),
        })

    # Agrega métricas
    nao_cancelados  = [i for i in inscricoes if i.status != StatusInscricaoEnum.cancelado]
    comparecimentos = [i for i in inscricoes if i.status == StatusInscricaoEnum.compareceu]
    faltas          = [i for i in inscricoes if i.status == StatusInscricaoEnum.faltou]
    cancelamentos   = [i for i in inscricoes if i.status == StatusInscricaoEnum.cancelado]

    # Datas de comparecimento para calcular status de retorno
    datas_presenca = sorted([
        giras_map[str(i.gira_id)].data
        for i in comparecimentos
        if str(i.gira_id) in giras_map
    ])

    from datetime import date
    score = calcular_score_membro(
        len(nao_cancelados),
        len(comparecimentos),
        len(faltas),
    )

    return {
        "id":             str(membro.id),
        "nome":           membro.nome,
        "email":          membro.email,
        "telefone":       membro.telefone,
        "role":           membro.role,
        "cadastrado_em":  membro.created_at.isoformat(),
        "score":          score,
        "comparecimentos": len(comparecimentos),
        "faltas":          len(faltas),
        # Status de engajamento baseado na última visita
        "status_retorno": (
            "nunca_compareceu" if not datas_presenca
            else "ativo"       if (date.today() - datas_presenca[-1]).days <= 60
            else "morno"       if (date.today() - datas_presenca[-1]).days <= 180
            else "inativo"
        ),
        "ultima_visita":  datas_presenca[-1].isoformat() if datas_presenca else None,
        "primeira_data":  datas_presenca[0].isoformat()  if datas_presenca else None,
        "dias_ausente": (
            (date.today() - datas_presenca[-1]).days if datas_presenca else None
        ),
        "stats": {
            "total_inscricoes": len(nao_cancelados),
            "comparecimentos":  len(comparecimentos),
            "faltas":           len(faltas),
            "cancelamentos":    len(cancelamentos),
        },
        "historico": historico,
    }