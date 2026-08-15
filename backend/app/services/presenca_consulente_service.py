"""
presenca_consulente_service.py — AxeFlow
Score de presença: o core real do sistema.
Calcula confiabilidade de cada consulente com base no histórico.
"""
from collections import defaultdict
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.consulente import Consulente
from app.models.gira import Gira
from app.models.inscricao_consulente import InscricaoConsulente
from app.utils.enuns import StatusInscricaoEnum


# ── Classificação ──────────────────────────────────────────────────────────────

def calcular_score(total: int, comparecimentos: int, faltas: int) -> dict:
    """
    Retorna score e classificação de confiabilidade.

    Regras:
    - Mínimo 2 inscrições finalizadas para ter score (abaixo disso é "Novo")
    - Score = comparecimentos / (comparecimentos + faltas) * 100
      (cancelamentos não contam — a pessoa pelo menos avisou)
    - Confiável    ≥ 80%
    - Regular      50–79%
    - Risco        20–49%
    - Problemático < 20% com 3+ faltas (está ocupando vaga de quem quer ir)

    Sempre retorna `total_inscricoes` para consistência entre os callers.
    """
    finalizadas = comparecimentos + faltas  # cancelamentos excluídos

    if finalizadas < 2:
        return {
            "score": None,
            "label": "Novo",
            "cor": "cinza",
            "emoji": "🆕",
            "alerta": False,
            "total_inscricoes": total,  # presente em todos os casos para consistência
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

    alerta = faltas >= 3 and taxa < 50

    return {
        "score": taxa,
        "label": label,
        "cor": cor,
        "emoji": emoji,
        "alerta": alerta,
        "comparecimentos": comparecimentos,
        "faltas": faltas,
        "finalizadas": finalizadas,
        "total_inscricoes": total,
    }


# ── Consulta por consulente ────────────────────────────────────────────────────

def get_score_consulente(db: Session, consulente_id: UUID, terreiro_id: UUID) -> dict:
    """
    Score completo de um consulente neste terreiro.
    """
    # Subquery com IDs das giras do terreiro — resolvida no banco, sem carregar em memória
    giras_sq = db.query(Gira.id).filter(
        Gira.terreiro_id == terreiro_id
    ).scalar_subquery()

    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id == consulente_id,
            InscricaoConsulente.gira_id.in_(giras_sq),
            InscricaoConsulente.deleted_at.is_(None)
        )
        .all()
    )

    # Agrega em um único loop — cancelamentos não penalizam
    total = comparecimentos = faltas = 0
    for i in inscricoes:
        if i.status == StatusInscricaoEnum.cancelado:
            continue
        total += 1
        if i.status == StatusInscricaoEnum.compareceu:
            comparecimentos += 1
        elif i.status == StatusInscricaoEnum.faltou:
            faltas += 1

    return calcular_score(total, comparecimentos, faltas)


# ── Score para lista de gira (batch) ──────────────────────────────────────────

def get_scores_para_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> dict:
    """
    Retorna dict {consulente_id: score} para todos os inscritos de uma gira.
    Usado para enriquecer a lista de presença com o histórico de cada consulente.
    Exclui a gira atual do cálculo — considera apenas histórico passado.
    """
    # Subquery com giras passadas do terreiro, excluindo a atual
    giras_passadas_sq = db.query(Gira.id).filter(
        Gira.terreiro_id == terreiro_id,
        Gira.id != gira_id,
    ).scalar_subquery()

    # IDs dos consulentes inscritos na gira atual
    consulente_ids = [
        row.consulente_id
        for row in db.query(InscricaoConsulente.consulente_id).filter(
            InscricaoConsulente.gira_id == gira_id,
            InscricaoConsulente.deleted_at.is_(None)
        ).all()
    ]

    if not consulente_ids:
        return {}

    # Busca o histórico passado de todos os inscritos em batch
    historico = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id.in_(consulente_ids),
            InscricaoConsulente.gira_id.in_(giras_passadas_sq),
            InscricaoConsulente.status != StatusInscricaoEnum.cancelado,
            InscricaoConsulente.deleted_at.is_(None)
        )
        .all()
    )

    # Agrega por consulente — defaultdict evita inicialização manual
    dados = defaultdict(lambda: {"total": 0, "comparecimentos": 0, "faltas": 0})
    for h in historico:
        cid = str(h.consulente_id)
        dados[cid]["total"] += 1
        if h.status == StatusInscricaoEnum.compareceu:
            dados[cid]["comparecimentos"] += 1
        elif h.status == StatusInscricaoEnum.faltou:
            dados[cid]["faltas"] += 1

    # Consulentes sem histórico passado recebem score zerado ("Novo")
    return {
        str(cid): calcular_score(
            dados[str(cid)]["total"],
            dados[str(cid)]["comparecimentos"],
            dados[str(cid)]["faltas"]
        )
        for cid in consulente_ids
    }


# ── Ranking de consulentes do terreiro ────────────────────────────────────────

def get_ranking_consulentes(db: Session, terreiro_id: UUID) -> list:
    """
    Lista todos os consulentes do terreiro com score calculado.
    Ordena: alertas primeiro, depois por score ascendente (piores no topo).
    """
    # Subquery com giras ativas (não deletadas) do terreiro
    giras_sq = db.query(Gira.id).filter(
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).scalar_subquery()

    # joinedload evita N+1 — carrega consulente junto com cada inscrição
    inscricoes = (
        db.query(InscricaoConsulente)
        .options(joinedload(InscricaoConsulente.consulente))
        .filter(
            InscricaoConsulente.gira_id.in_(giras_sq),
            InscricaoConsulente.deleted_at.is_(None)
        )
        .all()
    )

    if not inscricoes:
        return []

    # Agrega dados por consulente
    dados: dict[str, dict] = {}
    for i in inscricoes:
        c = i.consulente
        if not c:
            continue

        cid = str(c.id)
        if cid not in dados:
            dados[cid] = {
                "id": cid,
                "nome": c.nome,
                "telefone": c.telefone,
                "primeira_visita": c.primeira_visita,
                "total": 0,
                "comparecimentos": 0,
                "faltas": 0,
            }

        # Cancelamentos não penalizam — não contam no total
        if i.status != StatusInscricaoEnum.cancelado:
            dados[cid]["total"] += 1

        if i.status == StatusInscricaoEnum.compareceu:
            dados[cid]["comparecimentos"] += 1
        elif i.status == StatusInscricaoEnum.faltou:
            dados[cid]["faltas"] += 1

    result = []
    for d in dados.values():
        score = calcular_score(d["total"], d["comparecimentos"], d["faltas"])
        result.append({**d, **score})

    # Alertas no topo; dentro de cada grupo, os piores scores primeiro
    result.sort(key=lambda x: (
        not x.get("alerta", False),
        x.get("score") if x.get("score") is not None else 999,
    ))

    return result