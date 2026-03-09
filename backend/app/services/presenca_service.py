"""
presenca_service.py — AxeFlow
Score de presença: o core real do sistema.
Calcula confiabilidade de cada consulente com base no histórico.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira, StatusInscricaoEnum
from app.models.gira import Gira


# ── Classificação ──────────────────────────────────────────────────────────────

def calcular_score(total: int, comparecimentos: int, faltas: int) -> dict:
    """
    Retorna score e classificação de confiabilidade.

    Regras:
    - Mínimo 2 inscrições para ter score (abaixo disso é "Novo")
    - Score = comparecimentos / (comparecimentos + faltas) * 100
      (cancelamentos não contam — a pessoa pelo menos avisou)
    - Confiável  ≥ 80%
    - Regular    50–79%
    - Risco      20–49%
    - Problemático < 20% com 3+ faltas (está ocupando vaga de quem quer ir)
    """
    finalizadas = comparecimentos + faltas  # só giras que já aconteceram

    if finalizadas < 2:
        return {
            "score": None,
            "label": "Novo",
            "cor": "cinza",
            "emoji": "🆕",
            "alerta": False,
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
    """Score completo de um consulente neste terreiro."""

    gira_ids = [
        g.id for g in db.query(Gira.id).filter(Gira.terreiro_id == terreiro_id).all()
    ]
    if not gira_ids:
        return calcular_score(0, 0, 0)

    inscricoes = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.consulente_id == consulente_id,
            InscricaoGira.gira_id.in_(gira_ids),
        )
        .all()
    )

    total         = len([i for i in inscricoes if i.status != StatusInscricaoEnum.cancelado])
    comparecimentos = len([i for i in inscricoes if i.status == "compareceu"])
    faltas        = len([i for i in inscricoes if i.status == "faltou"])

    score = calcular_score(total, comparecimentos, faltas)
    score["total_inscricoes"] = total
    return score


# ── Score para lista de gira (batch) ──────────────────────────────────────────

def get_scores_para_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> dict:
    """
    Retorna dict {consulente_id: score} para todos os inscritos de uma gira.
    Usado para enriquecer a lista de presença com o histórico de cada um.
    Exclui a gira atual do cálculo (histórico passado apenas).
    """
    gira_ids_passadas = [
        g.id for g in db.query(Gira.id).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.id != gira_id,
        ).all()
    ]

    # Inscritos na gira atual
    inscritos = db.query(InscricaoGira).filter(InscricaoGira.gira_id == gira_id).all()
    consulente_ids = [i.consulente_id for i in inscritos]

    if not consulente_ids or not gira_ids_passadas:
        return {str(cid): calcular_score(0, 0, 0) for cid in consulente_ids}

    # Histórico passado de todos eles em batch
    historico = (
        db.query(InscricaoGira)
        .filter(
            InscricaoGira.consulente_id.in_(consulente_ids),
            InscricaoGira.gira_id.in_(gira_ids_passadas),
            InscricaoGira.status != StatusInscricaoEnum.cancelado,
        )
        .all()
    )

    # Agregar por consulente
    dados = {str(cid): {"total": 0, "comparecimentos": 0, "faltas": 0} for cid in consulente_ids}
    for h in historico:
        cid = str(h.consulente_id)
        dados[cid]["total"] += 1
        if h.status == "compareceu":
            dados[cid]["comparecimentos"] += 1
        elif h.status == "faltou":
            dados[cid]["faltas"] += 1

    return {
        cid: calcular_score(d["total"], d["comparecimentos"], d["faltas"])
        for cid, d in dados.items()
    }


# ── Ranking de consulentes do terreiro ────────────────────────────────────────

def get_ranking_consulentes(db: Session, terreiro_id: UUID) -> list:
    """
    Lista todos os consulentes do terreiro com score calculado.
    Ordena: problemáticos primeiro (precisam de atenção), depois por taxa asc.
    """
    gira_ids = [
        g.id for g in db.query(Gira.id).filter(Gira.terreiro_id == terreiro_id).all()
    ]
    if not gira_ids:
        return []

    inscricoes = (
        db.query(InscricaoGira)
        .filter(InscricaoGira.gira_id.in_(gira_ids))
        .all()
    )

    dados = {}
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
        if i.status != StatusInscricaoEnum.cancelado:
            dados[cid]["total"] += 1
        if i.status == "compareceu":
            dados[cid]["comparecimentos"] += 1
        elif i.status == "faltou":
            dados[cid]["faltas"] += 1

    result = []
    for d in dados.values():
        score = calcular_score(d["total"], d["comparecimentos"], d["faltas"])
        result.append({**d, **score})

    # Ordenar: alertas primeiro, depois por score asc (piores no topo)
    result.sort(key=lambda x: (
        not x.get("alerta", False),
        x.get("score") if x.get("score") is not None else 999,
    ))

    return result
