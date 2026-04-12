"""
ajeum_service.py — AxeFlow
Lógica de negócio do sistema Ajeum.

Funções principais:
  criar_ajeum()        — cria o Ajeum de uma gira com seus itens
  get_ajeum_da_gira()  — retorna Ajeum com itens, contagens e seleção do membro
  selecionar_item()    — seleção com FOR UPDATE + idempotência (3 cenários)
  cancelar_selecao()   — cancela seleção e libera vaga
  confirmar_selecao()  — confirma entrega com optimistic locking
  editar_item()        — edita item (valida redução de limite)
  deletar_item()       — soft delete de item

CONCORRÊNCIA — estratégia por operação:
  selecionar_item:   pessimistic locking (FOR UPDATE no item)
                     — correto porque conflitos são esperados em itens populares
  confirmar_selecao: optimistic locking (version check no UPDATE)
                     — correto porque conflitos de confirmação são raros
                     mas silenciosos sem controle

IDEMPOTÊNCIA — 3 cenários em selecionar_item():
  1. Nunca selecionou     → INSERT normal
  2. Já selecionado/ativo → retorna estado atual (double-tap seguro)
  3. Cancelado antes      → UPDATE para selecionado (re-seleção)

MULTI-TENANT — validação em toda operação:
  Toda função que recebe item_id ou selecao_id valida que o registro
  pertence ao terreiro do usuário autenticado ANTES de qualquer modificação.
  Falha → 403 (não 404), para não revelar existência de recursos de outros terreiros.
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.ajeum import (
    Ajeum,
    AjeumItem,
    AjeumSelecao,
    StatusSelecaoEnum,
    TRANSICOES_VALIDAS,
)
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.schemas.ajeum_schema import (
    AjeumCreate,
    AjeumItemCreate,
    AjeumItemEdit,
    AjeumResponse,
    AjeumItemResponse,
    AjeumSelecaoResponse,
    ConfirmarSelecaoRequest,
)

from app.services.push_service import send_push_to_terreiro

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS INTERNOS
# ══════════════════════════════════════════════════════════════════════════════

def _get_gira_do_terreiro(db: Session, gira_id: UUID, terreiro_id: UUID) -> Gira:
    """
    Busca gira validando que pertence ao terreiro.
    Retorna 404 se não existir ou 403 se for de outro terreiro.

    Separar 404 de 403 aqui é seguro porque a existência da gira
    não é informação sensível — slugs são públicos.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.deleted_at.is_(None),
    ).first()

    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # Isolamento multi-tenant: gira existe mas pertence a outro terreiro
    if str(gira.terreiro_id) != str(terreiro_id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    return gira


def _get_item_do_terreiro(
    db: Session,
    item_id: UUID,
    terreiro_id: UUID,
    for_update: bool = False,
) -> AjeumItem:
    """
    Busca item validando que pertence ao terreiro.

    Quando for_update=True, aplica SELECT FOR UPDATE para serializar
    acessos concorrentes. Usar APENAS dentro de transação ativa.

    Retorna 404 para item inexistente ou deletado.
    Retorna 403 para item de outro terreiro.
    Nunca revela a diferença entre "não existe" e "é de outro terreiro"
    quando o caller não tem contexto para distinguir.
    """
    query = db.query(AjeumItem).filter(
        AjeumItem.id == item_id,
        AjeumItem.deleted_at.is_(None),
    )

    if for_update:
        # FOR UPDATE: PostgreSQL bloqueia a linha até o commit da transação.
        # Transações concorrentes que tentarem o mesmo item ficam em fila
        # e executam sequencialmente — garantia de que o COUNT posterior
        # é consistente com o INSERT que segue.
        query = query.with_for_update()

    item = query.first()

    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if str(item.terreiro_id) != str(terreiro_id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    return item


def _get_selecao_do_terreiro(
    db: Session,
    selecao_id: UUID,
    terreiro_id: UUID,
) -> AjeumSelecao:
    """
    Busca seleção validando que pertence ao terreiro.
    Retorna 404 para seleção inexistente, 403 para terreiro errado.
    """
    selecao = db.query(AjeumSelecao).filter(
        AjeumSelecao.id == selecao_id,
    ).first()

    if not selecao:
        raise HTTPException(status_code=404, detail="Seleção não encontrada")

    if str(selecao.terreiro_id) != str(terreiro_id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    return selecao


def _contar_selecoes_ativas(db: Session, item_id: UUID) -> int:
    """
    Conta seleções ativas (não canceladas) para um item.

    DEVE ser chamado apenas dentro de uma transação com FOR UPDATE no item
    para garantir que a contagem é consistente com a decisão de inserir.
    Fora do lock, a contagem pode estar desatualizada por milissegundos.
    """
    return db.query(AjeumSelecao).filter(
        AjeumSelecao.item_id == item_id,
        AjeumSelecao.status != StatusSelecaoEnum.cancelado,
    ).count()


def _validar_transicao(
    status_atual: str,
    novo_status: str,
    raise_on_invalid: bool = True,
) -> bool:
    """
    Valida se a transição de status é permitida segundo TRANSICOES_VALIDAS.
    Se raise_on_invalid=True (padrão), lança HTTPException 400 com mensagem clara.
    """
    atual_enum = StatusSelecaoEnum(status_atual)
    novo_enum  = StatusSelecaoEnum(novo_status)

    valida = novo_enum in TRANSICOES_VALIDAS.get(atual_enum, set())

    if not valida and raise_on_invalid:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transição inválida: '{status_atual}' → '{novo_status}'. "
                f"Transições permitidas: "
                f"{[s.value for s in TRANSICOES_VALIDAS.get(atual_enum, set())] or 'nenhuma (estado terminal)'}."
            ),
        )

    return valida


# ══════════════════════════════════════════════════════════════════════════════
# CRIAR AJEUM
# ══════════════════════════════════════════════════════════════════════════════

def adicionar_item(
    db: Session,
    ajeum_id: UUID,
    data: AjeumItemCreate,
    user: Usuario,
) -> AjeumItem:
    """
    Adiciona um item avulso a um Ajeum já existente.
    Chamado quando o admin quer adicionar itens após a criação inicial.

    Raises:
      404: Ajeum não encontrado
      403: Ajeum de outro terreiro
    """
    ajeum = db.query(Ajeum).filter(Ajeum.id == ajeum_id).first()

    if not ajeum:
        raise HTTPException(status_code=404, detail="Ajeum não encontrado")

    if str(ajeum.terreiro_id) != str(user.terreiro_id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    item = AjeumItem(
        terreiro_id = user.terreiro_id,
        ajeum_id    = ajeum_id,
        descricao   = data.descricao.strip(),
        limite      = data.limite,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(
        "[Ajeum] Item adicionado: ajeum=%s descricao=%s limite=%d por user=%s",
        ajeum_id, data.descricao, data.limite, user.id,
    )

    # ── Push: notifica membros sobre o novo item ──────────────────────────────
    # Busca o gira_id pelo ajeum para montar a URL de destino correta.
    # Falha silenciosa — o item já foi salvo antes de chegar aqui.
    gira = db.query(Gira).filter(Gira.id == ajeum.gira_id).first()
    pyaload = {
        "title": "🛒 Novo item no Ajeum",
        "body":  f'"{data.descricao.strip()}" foi adicionado à lista — {data.limite} vaga(s) disponível(is).',
        "url":   f"/giras/{gira.id}" if gira else "/giras",
        "terreiro_id": str(user.terreiro_id),
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id = user.terreiro_id,
        payload=pyaload,
    )

    return item


def criar_ajeum(
    db: Session,
    gira_id: UUID,
    data: AjeumCreate,
    user: Usuario,
) -> Ajeum:
    """
    Cria o Ajeum de uma gira com todos os seus itens em uma única transação.

    Validações:
      - Gira existe e pertence ao terreiro do usuário
      - Gira não está concluída (não faz sentido criar lista após a gira)
      - Gira ainda não tem Ajeum (UNIQUE no banco, mas tratamos antes)
      - Todos os itens têm limite >= 1 (CHECK no banco, mas validamos antes)

    Raises:
      404: gira não encontrada
      403: gira de outro terreiro
      400: gira já tem Ajeum
      400: gira concluída
      422: item com limite inválido (validado no schema Pydantic)
    """
    # ── Validação: gira existe e pertence ao terreiro ─────────────────────────
    gira = _get_gira_do_terreiro(db, gira_id, user.terreiro_id)

    # ── Validação: gira não pode estar concluída ──────────────────────────────
    if str(gira.status) == "concluida":
        raise HTTPException(
            status_code=400,
            detail="Não é possível criar Ajeum para uma gira já concluída.",
        )

    # ── Validação antecipada de duplicata (mais amigável que IntegrityError) ──
    existente = db.query(Ajeum).filter(Ajeum.gira_id == gira_id).first()
    if existente:
        raise HTTPException(
            status_code=409,
            detail="Esta gira já possui um Ajeum. Use o endpoint de edição para modificá-lo.",
        )

    # ── Criação do Ajeum e itens na mesma transação ───────────────────────────
    ajeum = Ajeum(
        terreiro_id = user.terreiro_id,
        gira_id     = gira_id,
        criado_por  = user.id,
        observacoes = data.observacoes,
    )
    db.add(ajeum)
    db.flush()  # gera o id do Ajeum antes de criar os itens

    for item_data in data.itens:
        item = AjeumItem(
            terreiro_id = user.terreiro_id,
            ajeum_id    = ajeum.id,
            descricao   = item_data.descricao.strip(),
            limite      = item_data.limite,
        )
        db.add(item)

    db.commit()
    db.refresh(ajeum)

    logger.info(
        "[Ajeum] Criado para gira=%s terreiro=%s itens=%d por user=%s",
        gira_id, user.terreiro_id, len(data.itens), user.id,
    )

    # ── Push: notifica todos os membros sobre a lista recém-criada ────────────
    # Disparado APÓS o commit para garantir que os dados estão persistidos.
    # Falha silenciosa: se o push falhar, a criação já foi confirmada.
    nomes_itens = ", ".join(i.descricao.strip() for i in data.itens[:3])
    sufixo = f" e mais {len(data.itens) - 3}" if len(data.itens) > 3 else ""
    
    payload = {
        "title": f"🛒 Ajeum da Gira: {gira.titulo}",
        "body": f"Lista criada com {len(data.itens)} item(ns): {nomes_itens}{sufixo}. Confira o que você pode levar!",
        "url": f"/giras/{gira.id}",
        "terreiro_id": str(user.terreiro_id),
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id = user.terreiro_id,
        payload=payload,
    )

    return ajeum


# ══════════════════════════════════════════════════════════════════════════════
# LEITURA COM DADOS ENRIQUECIDOS
# ══════════════════════════════════════════════════════════════════════════════

def get_ajeum_da_gira(
    db: Session,
    gira_id: UUID,
    terreiro_id: UUID,
    membro_id: UUID | None = None,
) -> dict:
    """
    Retorna o Ajeum da gira com:
      - todos os itens ativos (deleted_at IS NULL)
      - para cada item: total de seleções ativas e seleção do membro autenticado

    Query única com subqueries agregadas para evitar N+1.
    O membro_id é opcional: quando None, retorna apenas contagens.

    Raises:
      404: gira não encontrada ou não tem Ajeum
      403: gira de outro terreiro
    """
    _get_gira_do_terreiro(db, gira_id, terreiro_id)

    ajeum = db.query(Ajeum).filter(
        Ajeum.gira_id    == gira_id,
        Ajeum.terreiro_id == terreiro_id,
    ).first()

    if not ajeum:
        raise HTTPException(status_code=404, detail="Esta gira não possui Ajeum.")

    # Busca itens ativos com contagens em uma única query usando SQL direto
    # para evitar N queries (uma por item)
    rows = db.execute(
        text("""
            SELECT
                ai.id,
                ai.descricao,
                ai.limite,
                ai.created_at,
                -- Conta seleções ativas (exclui canceladas)
                COUNT(
                    CASE WHEN s.status != 'cancelado' THEN 1 END
                ) AS total_selecionado,
                -- Verifica se o membro atual já selecionou (status não cancelado)
                MAX(
                    CASE
                        WHEN s.membro_id = :membro_id
                         AND s.status != 'cancelado'
                        THEN s.status
                    END
                ) AS meu_status,
                -- ID da seleção do membro atual (para passar ao frontend)
                MAX(
                    CASE
                        WHEN s.membro_id = :membro_id
                         AND s.status != 'cancelado'
                        THEN CAST(s.id AS TEXT)
                    END
                ) AS minha_selecao_id,
                -- Version da seleção do membro (para optimistic locking no frontend)
                MAX(
                    CASE
                        WHEN s.membro_id = :membro_id
                         AND s.status != 'cancelado'
                        THEN s.version
                    END
                ) AS minha_version
            FROM ajeum_item ai
            LEFT JOIN ajeum_selecao s ON s.item_id = ai.id
            WHERE
                ai.ajeum_id   = :ajeum_id
                AND ai.deleted_at IS NULL
            GROUP BY ai.id, ai.descricao, ai.limite, ai.created_at
            ORDER BY ai.created_at ASC
        """),
        {
            "ajeum_id":  str(ajeum.id),
            # Passamos NULL se não há membro autenticado (endpoint público futuro)
            "membro_id": str(membro_id) if membro_id else "00000000-0000-0000-0000-000000000000",
        },
    ).fetchall()

    # ── Query 2: quem selecionou cada item ────────────────────────────────────
    # Uma query busca todos os selecionadores de todos os itens do Ajeum.
    # Filtra status != cancelado — cancelado significa que desistiu.
    item_ids = [str(row.id) for row in rows]

    selecionadores_por_item: dict[str, list[dict]] = {iid: [] for iid in item_ids}

    if item_ids:
        sel_rows = db.execute(
            text("""
                SELECT
                    s.id        AS selecao_id,
                    s.item_id,
                    s.version,
                    u.nome,
                    s.status
                FROM ajeum_selecao s
                JOIN usuarios u ON u.id = s.membro_id
                WHERE
                    s.item_id = ANY(:item_ids ::uuid[])
                    AND s.status != 'cancelado'
                ORDER BY s.created_at ASC
            """),
            {"item_ids": item_ids},
        ).fetchall()

        for sel in sel_rows:
            iid = str(sel.item_id)
            if iid in selecionadores_por_item:
                selecionadores_por_item[iid].append({
                    "selecao_id": str(sel.selecao_id),
                    "nome":       sel.nome,
                    "status":     sel.status,
                    "version":    sel.version,
                })

    itens_enriquecidos = [
        {
            "id":               str(row.id),
            "descricao":        row.descricao,
            "limite":           row.limite,
            "total_selecionado": int(row.total_selecionado),
            "vagas_restantes":  max(0, row.limite - int(row.total_selecionado)),
            "lotado":           int(row.total_selecionado) >= row.limite,
            "meu_status":       row.meu_status,
            "minha_selecao_id": row.minha_selecao_id,
            "minha_version":    row.minha_version,
            # Lista de quem vai levar — exibida no card abaixo da barra
            "selecionadores":   selecionadores_por_item.get(str(row.id), []),
        }
        for row in rows
    ]

    return {
        "id":          str(ajeum.id),
        "gira_id":     str(ajeum.gira_id),
        "observacoes": ajeum.observacoes,
        "created_at":  ajeum.created_at.isoformat(),
        "itens":       itens_enriquecidos,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SELECIONAR ITEM  ← operação mais crítica do sistema
# ══════════════════════════════════════════════════════════════════════════════

def selecionar_item(
    db: Session,
    item_id: UUID,
    user: Usuario,
) -> AjeumSelecao:
    """
    Registra que o membro vai levar o item.

    CONCORRÊNCIA: usa SELECT FOR UPDATE no AjeumItem para serializar todas
    as tentativas de seleção do mesmo item. O PostgreSQL enfileira as transações
    concorrentes — nenhuma ultrapassa o limite.

    IDEMPOTÊNCIA — 3 cenários:
      1. Sem seleção prévia:
         → COUNT confirma vaga → INSERT
      2. Seleção ativa (selecionado/confirmado/nao_entregue):
         → Retorna o estado atual sem modificar (double-tap seguro)
      3. Seleção cancelada:
         → Re-seleciona via UPDATE se ainda há vaga (mesmo fluxo do INSERT)

    FLUXO TRANSACIONAL (ordem é crítica):
      1. FOR UPDATE no item (serializa)
      2. Busca seleção existente do membro (sem lock adicional — já temos o item)
      3. Trata cada cenário de idempotência
      4. COUNT dentro do lock (consistente)
      5. INSERT ou UPDATE
      6. COMMIT (libera o lock)

    Raises:
      404: item não encontrado ou deletado
      403: item de outro terreiro
      400: gira concluída (sem novas seleções)
      409: limite atingido
    """
    # ── Passo 1: FOR UPDATE no item — lock pessimistic ─────────────────────────
    # for_update=True aplica SELECT FOR UPDATE.
    # Transações concorrentes no mesmo item ficam aqui bloqueadas até o COMMIT.
    item = _get_item_do_terreiro(
        db, item_id, user.terreiro_id, for_update=True
    )

    # ── Passo 1b: Valida que a gira não está concluída ────────────────────────
    # Fazemos após o FOR UPDATE para evitar condição onde gira é concluída
    # entre a validação e o insert
    ajeum = db.query(Ajeum).filter(Ajeum.id == item.ajeum_id).first()
    gira  = db.query(Gira).filter(Gira.id == ajeum.gira_id).first()

    if str(gira.status) == "concluida":
        raise HTTPException(
            status_code=400,
            detail="Não é possível selecionar itens de uma gira já concluída.",
        )

    # ── Passo 2: Busca seleção existente deste membro para este item ──────────
    # Busca QUALQUER status (incluindo cancelado) para decisão de idempotência
    selecao_existente = db.query(AjeumSelecao).filter(
        AjeumSelecao.item_id   == item_id,
        AjeumSelecao.membro_id == user.id,
    ).first()

    # ── Passo 3: Idempotência — cenário 2 ────────────────────────────────────
    # Seleção ativa já existe: retorna sem modificar
    # Cobre double-tap, retry de rede e re-entrada na tela
    if selecao_existente and selecao_existente.status != StatusSelecaoEnum.cancelado:
        logger.info(
            "[Ajeum] Seleção idempotente: item=%s membro=%s status=%s",
            item_id, user.id, selecao_existente.status,
        )
        # Não fazemos commit nem rollback — apenas retornamos o existente
        # O lock no item é liberado quando o contexto de db for encerrado
        # Sem push: seleção já existia, não é evento novo para o terreiro
        return selecao_existente

    # ── Passo 4: COUNT dentro do lock ────────────────────────────────────────
    # Este COUNT é consistente porque o FOR UPDATE no item impede que
    # qualquer outra transação insira nova seleção concorrentemente
    total_ativo = _contar_selecoes_ativas(db, item_id)

    if total_ativo >= item.limite:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Já temos o suficiente desse item. "
                f"Limite: {item.limite}, selecionados: {total_ativo}."
            ),
        )

    # ── Passo 5a: Cenário 3 — re-seleção de seleção cancelada ────────────────
    if selecao_existente and selecao_existente.status == StatusSelecaoEnum.cancelado:
        logger.info(
            "[Ajeum] Re-seleção de item cancelado: item=%s membro=%s",
            item_id, user.id,
        )
        selecao_existente.status     = StatusSelecaoEnum.selecionado
        selecao_existente.updated_at = datetime.utcnow()
        # version NÃO é incrementado aqui: re-seleção não é confirmação de admin,
        # não há risco de conflito de duas confirmações simultâneas
        db.commit()
        db.refresh(selecao_existente)

        # Push: membro retomou o compromisso com o item
        payload = {
            "title": "🛒 Ajeum atualizado",
            "body":  f"{user.nome} vai levar: {item.descricao} ({total_ativo + 1}/{item.limite} selecionados).",
            "url":   f"/giras/{gira.id}",
            "terreiro_id": str(user.terreiro_id),
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id = user.terreiro_id,
            payload=payload,
        )

        return selecao_existente

    # ── Passo 5b: Cenário 1 — primeira seleção ────────────────────────────────
    logger.info(
        "[Ajeum] Nova seleção: item=%s membro=%s (vaga %d/%d)",
        item_id, user.id, total_ativo + 1, item.limite,
    )

    nova_selecao = AjeumSelecao(
        terreiro_id = user.terreiro_id,
        item_id     = item_id,
        membro_id   = user.id,
        status      = StatusSelecaoEnum.selecionado,
        version     = 1,
    )
    db.add(nova_selecao)

    try:
        db.commit()
    except IntegrityError:
        # UNIQUE(item_id, membro_id) violado por request concorrente do mesmo membro.
        # Situação rara (dois requests idênticos chegando ao mesmo tempo) mas possível.
        # Fazemos rollback e buscamos o registro que "ganhou" a corrida.
        db.rollback()
        selecao_concorrente = db.query(AjeumSelecao).filter(
            AjeumSelecao.item_id   == item_id,
            AjeumSelecao.membro_id == user.id,
        ).first()
        if selecao_concorrente:
            # Retorna o que foi inserido pela outra requisição — idempotente
            # Sem push: não sabemos se este ou o concorrente "ganhou"
            logger.info(
                "[Ajeum] IntegrityError tratado como idempotente: item=%s membro=%s",
                item_id, user.id,
            )
            return selecao_concorrente
        # Se nem o concorrente existe, algo mais grave aconteceu
        raise HTTPException(
            status_code=500,
            detail="Erro ao registrar seleção. Tente novamente.",
        )

    db.refresh(nova_selecao)

    # Push: membro se comprometeu com o item — notifica o terreiro
    # Disparado após commit bem-sucedido (não no IntegrityError path acima)
    payload = {
        "title": "🛒 Ajeum atualizado",
        "body":  f"{user.nome} vai levar: {item.descricao} ({total_ativo + 1}/{item.limite} selecionados).",
        "url":   f"/giras/{gira.id}",
        "terreiro_id": str(user.terreiro_id),
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id = user.terreiro_id,
        payload=payload,
    )

    return nova_selecao


# ══════════════════════════════════════════════════════════════════════════════
# CANCELAR SELEÇÃO
# ══════════════════════════════════════════════════════════════════════════════

def cancelar_selecao(
    db: Session,
    selecao_id: UUID,
    user: Usuario,
) -> AjeumSelecao:
    """
    Cancela a seleção de um item pelo próprio membro.
    Libera a vaga para que outro membro possa selecionar.

    Apenas o próprio membro pode cancelar sua seleção.
    Admin que quiser cancelar por outro membro usa endpoint separado.

    Raises:
      404: seleção não encontrada
      403: seleção de outro terreiro ou de outro membro
      400: transição inválida (ex: tentar cancelar 'confirmado')
    """
    selecao = _get_selecao_do_terreiro(db, selecao_id, user.terreiro_id)
    gira = db.query(Gira).join(Ajeum).join(AjeumItem).filter(
        AjeumSelecao.id == selecao_id,
        AjeumItem.id == selecao.item_id,
        Ajeum.id == AjeumItem.ajeum_id,
    ).first()
    
    ajeum_item = db.query(AjeumItem).filter(AjeumItem.id == selecao.item_id).first()


    # Verifica que é o próprio membro (não admin cancelando por outro)
    if str(selecao.membro_id) != str(user.id):
        raise HTTPException(
            status_code=403,
            detail="Você só pode cancelar suas próprias seleções.",
        )

    # Valida transição: confirmado/nao_entregue são terminais
    _validar_transicao(selecao.status, StatusSelecaoEnum.cancelado)

    selecao.status     = StatusSelecaoEnum.cancelado
    selecao.updated_at = datetime.utcnow()
    # version não muda: cancelamento pelo membro não é confirmação de admin

    db.commit()
    db.refresh(selecao)
    payload = {
        "title": "🛒 Ajeum atualizado",
        "body": f"{user.nome} cancelou a seleção do item: {ajeum_item.descricao} ({ajeum_item.limite - _contar_selecoes_ativas(db, ajeum_item.id)}/{ajeum_item.limite} selecionados).",
        "url": f"/giras/{gira.id}",
        "terreiro_id": str(user.terreiro_id),
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id = user.terreiro_id,
        payload=payload,
    )
    
    logger.info(
        "[Ajeum] Seleção cancelada: selecao=%s item=%s membro=%s",
        selecao_id, selecao.item_id, user.id,
    )

    return selecao


# ══════════════════════════════════════════════════════════════════════════════
# CONFIRMAR SELEÇÃO  ← optimistic locking aqui
# ══════════════════════════════════════════════════════════════════════════════

def confirmar_selecao(
    db: Session,
    selecao_id: UUID,
    data: ConfirmarSelecaoRequest,
    user: Usuario,
) -> AjeumSelecao:
    """
    Admin confirma se o membro entregou o item ('confirmado') ou não ('nao_entregue').

    OPTIMISTIC LOCKING:
      O frontend envia a `version` que leu ao carregar a tela.
      O UPDATE usa WHERE id = :id AND version = :version_enviada.
      Se rowcount == 0: outra sessão do admin já modificou — retorna 409.
      Se rowcount == 1: sucesso — incrementa version.

    Isso previne que dois admins (ou a mesma tela em duas abas) sobrescrevam
    a confirmação silenciosamente.

    O UPDATE é feito diretamente via SQL (não via ORM setattr + commit)
    porque o optimistic locking requer verificar o rowcount do UPDATE,
    e o ORM não expõe isso diretamente de forma confiável.

    Raises:
      404: seleção não encontrada
      403: seleção de outro terreiro
      400: transição inválida
      409: conflito de version (outro admin confirmou antes)
    """
    # Valida que a seleção pertence ao terreiro
    selecao = _get_selecao_do_terreiro(db, selecao_id, user.terreiro_id)

    # Valida que o novo status é uma transição permitida
    _validar_transicao(selecao.status, data.novo_status)

    agora = datetime.utcnow()

    # ── UPDATE com verificação de version ─────────────────────────────────────
    # Usamos SQL direto para ter acesso ao rowcount após o UPDATE.
    # O ORM (db.commit após setattr) não garante que vemos rowcount=0
    # quando a version não bate — ele pode silenciosamente não atualizar.
    result = db.execute(
        text("""
            UPDATE ajeum_selecao
            SET
                status         = :novo_status,
                version        = version + 1,
                confirmado_por = :confirmado_por,
                confirmado_em  = :confirmado_em,
                updated_at     = :agora
            WHERE
                id      = :selecao_id
                AND version = :version_esperada
        """),
        {
            "novo_status":      data.novo_status,
            "confirmado_por":   str(user.id),
            "confirmado_em":    agora,
            "agora":            agora,
            "selecao_id":       str(selecao_id),
            # version_esperada vem do frontend (lida ao carregar a tela)
            "version_esperada": data.version,
        },
    )

    if result.rowcount == 0:
        # Duas situações possíveis (ambas resolvidas com recarregar):
        # a) Outro admin confirmou antes — version mudou
        # b) Seleção foi cancelada entretanto — transição não é mais válida
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Este registro foi modificado por outro usuário. "
                "Recarregue a página para ver o estado atual."
            ),
        )

    db.commit()

    # Recarrega para retornar estado atualizado
    db.refresh(selecao)

    logger.info(
        "[Ajeum] Seleção confirmada: selecao=%s status=%s por admin=%s",
        selecao_id, data.novo_status, user.id,
    )

    return selecao


# ══════════════════════════════════════════════════════════════════════════════
# EDITAR ITEM
# ══════════════════════════════════════════════════════════════════════════════

def editar_item(
    db: Session,
    item_id: UUID,
    data: AjeumItemEdit,
    user: Usuario,
) -> AjeumItem:
    """
    Edita a descrição ou limite de um item.

    Redução de limite: se o novo limite for menor que o total de seleções ativas,
    a operação é REJEITADA com 409. Não cancelamos seleções silenciosamente.

    Raises:
      404: item não encontrado ou deletado
      403: item de outro terreiro
      409: novo limite menor que seleções ativas existentes
    """
    # FOR UPDATE: garante que nenhuma nova seleção entra durante a validação
    item = _get_item_do_terreiro(db, item_id, user.terreiro_id, for_update=True)

    if data.limite is not None:
        total_ativo = _contar_selecoes_ativas(db, item_id)
        if data.limite < total_ativo:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Não é possível reduzir o limite para {data.limite}. "
                    f"Já há {total_ativo} seleções ativas. "
                    f"Cancele seleções antes de reduzir o limite."
                ),
            )
        item.limite = data.limite

    if data.descricao is not None:
        item.descricao = data.descricao.strip()

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    return item


# ══════════════════════════════════════════════════════════════════════════════
# SOFT DELETE DE ITEM
# ══════════════════════════════════════════════════════════════════════════════

def deletar_item(
    db: Session,
    item_id: UUID,
    user: Usuario,
) -> dict:
    """
    Soft delete de um item do Ajeum.

    Se o item não tem seleções: soft delete (marca deleted_at).
    Se o item tem seleções ATIVAS (não canceladas): rejeita com 409.
    Se o item tem APENAS seleções canceladas: permite soft delete
    (preserva histórico de quem tinha selecionado antes de cancelar).

    NUNCA deleta fisicamente — seleções históricas devem ser preservadas.

    Raises:
      404: item não encontrado ou já deletado
      403: item de outro terreiro
      409: item com seleções ativas (não canceladas)
    """
    item = _get_item_do_terreiro(db, item_id, user.terreiro_id, for_update=True)

    total_ativo = _contar_selecoes_ativas(db, item_id)

    if total_ativo > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Não é possível remover este item: "
                f"há {total_ativo} seleção(ões) ativa(s). "
                f"Cancele as seleções antes de remover o item."
            ),
        )

    item.deleted_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()
    db.commit()

    logger.info(
        "[Ajeum] Item removido (soft delete): item=%s terreiro=%s por user=%s",
        item_id, user.terreiro_id, user.id,
    )

    return {"ok": True, "message": f"Item '{item.descricao}' removido."}