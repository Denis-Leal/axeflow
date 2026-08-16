"""
presenca_membro_service.py — AxeFlow
Score de presença de MEMBROS do terreiro.

Lógica análoga ao presenca_consulente_service.py, mas usando
InscricaoMembro como fonte de dados.

Diferenças em relação a consulentes:
  - Não existe status 'lista_espera' para membros
  - Cancelamento não penaliza — membro avisou que não poderia ir
  - `total_inscricoes` conta apenas confirmado/compareceu/faltou
"""
from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.gira import Gira
from app.models.inscricao_membro import InscricaoMembro
from app.models.usuario import Usuario
from app.utils.enuns import StatusInscricaoEnum


# ── Classificação ──────────────────────────────────────────────────────────────

def calcular_score_membro(total: int, comparecimentos: int, faltas: int) -> dict:
    """
    Calcula score de confiabilidade de um membro.

    Regras idênticas ao score de consulentes:
    - Mínimo 2 inscrições finalizadas para ter score numérico
    - Score = comparecimentos / (comparecimentos + faltas) * 100
    - Confiável    >= 80%
    - Regular      50–79%
    - Risco        20–49%
    - Problemático < 20% com 3+ faltas

    Sempre retorna `total_inscricoes` para consistência entre os callers.
    """
    finalizadas = comparecimentos + faltas

    if finalizadas < 2:
        return {
            "score": None,
            "label": "Novo",
            "cor": "cinza",
            "emoji": "🆕",
            "alerta": False,
            "comparecimentos": comparecimentos,
            "faltas": faltas,
            "finalizadas": finalizadas,
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

    # Alerta: membro ocupa vaga sem comparecer consistentemente
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


# ── Ranking de membros do terreiro ────────────────────────────────────────────

def get_ranking_membros(db: Session, terreiro_id: UUID) -> list:
    """
    Retorna ranking de presença de todos os membros ativos do terreiro.

    Inclui membros sem inscrições (score zerado) para que o admin
    veja todos numa única tela.

    Ordena: alertas primeiro, depois por score ascendente (piores no topo).
    """
    # Subquery com giras ativas do terreiro — resolvida no banco
    giras_sq = db.query(Gira.id).filter(
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).scalar_subquery()

    # Todos os membros ativos — inicializados com score zerado
    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == terreiro_id,
        Usuario.ativo == True,
    ).all()

    if not membros:
        return []

    # Inicializa dados para todos os membros, inclusive os sem inscrições
    dados: dict[str, dict] = {
        str(m.id): {
            "id": str(m.id),
            "nome": m.nome,
            "email": m.email,
            "telefone": m.telefone,
            "role": m.role,
            "total": 0,
            "comparecimentos": 0,
            "faltas": 0,
        }
        for m in membros
    }

    # Inscrições nas giras do terreiro — subquery evita carregar IDs na memória
    inscricoes = (
        db.query(InscricaoMembro)
        .filter(InscricaoMembro.gira_id.in_(giras_sq))
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

    # Alertas no topo; dentro de cada grupo, os piores scores primeiro
    result.sort(key=lambda x: (
        not x.get("alerta", False),
        x.get("score") if x.get("score") is not None else 999,
    ))

    return result


# ── Perfil individual de membro ───────────────────────────────────────────────

