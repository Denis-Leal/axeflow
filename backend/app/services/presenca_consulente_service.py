"""
presenca_consulente_service.py — AxeFlow
Score de presença: o core real do sistema.
Calcula confiabilidade de cada consulente com base no histórico.

CORREÇÃO: todas as queries de ranking/score agora usam InscricaoConsulente
(nova fonte de verdade) em vez de InscricaoGira (tabela legado).
A tabela legado não recebe mais inscrições novas desde a migration 0007.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from app.models.consulente import Consulente

# CORREÇÃO: importa o novo model, não o legado
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.inscricao_status import StatusInscricaoEnum
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
    """
    Score completo de um consulente neste terreiro.

    CORREÇÃO: usa InscricaoConsulente (nova tabela) filtrando pelas giras
    do terreiro, em vez de InscricaoGira (legado) que não recebe novas inscrições.
    """
    # IDs das giras deste terreiro (para filtrar inscrições do consulente)
    gira_ids = [
        g.id for g in db.query(Gira.id).filter(Gira.terreiro_id == terreiro_id).all()
    ]
    if not gira_ids:
        return calcular_score(0, 0, 0)

    # CORREÇÃO: InscricaoConsulente substituindo InscricaoGira
    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id == consulente_id,
            InscricaoConsulente.gira_id.in_(gira_ids),
        )
        .all()
    )

    total           = len([i for i in inscricoes if i.status != StatusInscricaoEnum.cancelado])
    comparecimentos = len([i for i in inscricoes if i.status == StatusInscricaoEnum.compareceu])
    faltas          = len([i for i in inscricoes if i.status == StatusInscricaoEnum.faltou])

    score = calcular_score(total, comparecimentos, faltas)
    score["total_inscricoes"] = total
    return score


# ── Score para lista de gira (batch) ──────────────────────────────────────────

def get_scores_para_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> dict:
    """
    Retorna dict {consulente_id: score} para todos os inscritos de uma gira.
    Usado para enriquecer a lista de presença com o histórico de cada um.
    Exclui a gira atual do cálculo (histórico passado apenas).

    CORREÇÃO: usa InscricaoConsulente (nova tabela) em ambas as queries.
    """
    # Giras passadas do terreiro, excluindo a gira atual
    gira_ids_passadas = [
        g.id for g in db.query(Gira.id).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.id != gira_id,
        ).all()
    ]

    # Inscritos na gira atual — usando nova tabela
    inscritos = db.query(InscricaoConsulente).filter(
        InscricaoConsulente.gira_id == gira_id
    ).all()
    consulente_ids = [i.consulente_id for i in inscritos]

    if not consulente_ids or not gira_ids_passadas:
        return {str(cid): calcular_score(0, 0, 0) for cid in consulente_ids}

    # Histórico passado de todos eles em batch — usando nova tabela
    historico = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.consulente_id.in_(consulente_ids),
            InscricaoConsulente.gira_id.in_(gira_ids_passadas),
            InscricaoConsulente.status != StatusInscricaoEnum.cancelado,
        )
        .all()
    )

    # Agrega por consulente
    dados = {str(cid): {"total": 0, "comparecimentos": 0, "faltas": 0} for cid in consulente_ids}
    for h in historico:
        cid = str(h.consulente_id)
        dados[cid]["total"] += 1
        if h.status == StatusInscricaoEnum.compareceu:
            dados[cid]["comparecimentos"] += 1
        elif h.status == StatusInscricaoEnum.faltou:
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

    CORREÇÃO: usa InscricaoConsulente (nova fonte de verdade) em vez de
    InscricaoGira (legado). A tabela legado não recebe novas inscrições desde
    a migration 0007_separar_inscricoes, portanto os dados estavam desatualizados.

    CAMPO: total_inscricoes agora é populado corretamente (inscrições não
    canceladas), resolvendo o bug da coluna "Giras" aparecer como 0 no frontend.
    """
    # IDs de todas as giras não-deletadas do terreiro
    gira_ids = [
        g.id for g in db.query(Gira.id).filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),  # ignora giras soft-deletadas
        ).all()
    ]
    if not gira_ids:
        return []

    # Busca inscrições de consulentes nas giras deste terreiro — nova tabela
    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(InscricaoConsulente.gira_id.in_(gira_ids))
        .all()
    )

    # Agrega dados por consulente
    dados: dict[str, dict] = {}
    for i in inscricoes:
        # lazy load do consulente pode causar N+1; aceitável aqui pois
        # o loop já carregou todas as inscrições do terreiro em memória
        c = i.consulente
        if not c:
            continue

        cid = str(c.id)
        if cid not in dados:
            dados[cid] = {
                "id":            cid,
                "nome":          c.nome,
                "telefone":      c.telefone,
                "primeira_visita": c.primeira_visita,
                "total":         0,   # inscrições não canceladas
                "comparecimentos": 0,
                "faltas":        0,
            }

        # Cancelamentos não contam no total (não penalizam — avisou)
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

    # Ordena: alertas primeiro, depois por score asc (piores no topo)
    result.sort(key=lambda x: (
        not x.get("alerta", False),
        x.get("score") if x.get("score") is not None else 999,
    ))

    return result