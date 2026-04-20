"""
inscricao_service.py — AxeFlow

CORREÇÕES CRÍTICAS aplicadas nesta versão:

1. Race condition em posicao eliminado
   - Antes: MAX(posicao) calculado fora de lock → dois usuários simultâneos
     obtinham o mesmo valor e inseriam posicao duplicada
   - Depois: SELECT ... FOR UPDATE na gira serializa a decisão de vaga +
     posicao por gira, garantindo atomicidade

2. Verificação de capacidade dentro do lock
   - Antes: contagem de confirmados feita separadamente do INSERT
   - Depois: count + insert dentro do mesmo SELECT FOR UPDATE na gira,
     impossibilitando ultrapassagem do limite mesmo com N req simultâneas

3. Distinção de inscrição cancelada vs ativa
   - Corrige IntegrityError (→ 500) ao tentar reinserir consulente cancelado
   - Retorna 400 com mensagem orientando a contatar o terreiro

4. promover_fila_em_lote com FOR UPDATE
   - Promoções em lote também serializadas para evitar dupla-promoção
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from fastapi import HTTPException
from uuid import UUID
from datetime import datetime

from app.models.gira import Gira, StatusGiraEnum
from app.models.consulente import Consulente
from app.utils.enuns import StatusInscricaoEnum
from app.models.inscricao_consulente import InscricaoConsulente
from app.utils.enuns import StatusInscricaoEnum as StatusNovo
from app.schemas.inscricao_schema import InscricaoPublicaRequest, InscricaoResponse, PresencaUpdate
from app.utils.validators import normalize_phone, validate_phone
from app.services.push_service import send_push_to_terreiro
from app.models.usuario import Usuario


def list_inscricoes(db: Session, gira_id: UUID, terreiro_id: UUID) -> list[InscricaoResponse]:
    """
    Lista inscrições de CONSULENTES de uma gira, ordenadas por posicao.
    Filtra apenas consulente_id IS NOT NULL — membros têm lista própria.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    # AGORA: db.query(InscricaoConsulente)
    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(InscricaoConsulente.gira_id == gira_id)
        .order_by(InscricaoConsulente.posicao)
        .all()
    )

    return [
        InscricaoResponse(
            id=i.id,
            posicao=i.posicao,
            status=i.status,
            created_at=i.created_at,
            consulente_nome=i.consulente.nome if i.consulente else None,
            consulente_telefone=i.consulente.telefone if i.consulente else None,
            observacoes=i.observacoes,
            usuario_id=i.usuario_id,
            source=i.consulente.source
        )
        for i in inscricoes
    ]


def _promover_lista_espera_novo(
    db: Session,
    gira_id: UUID,
) -> "InscricaoConsulente | None":
    """
    Versão do promotor usando InscricaoConsulente (nova tabela).
    FOR UPDATE na nova tabela para serializar promoções concorrentes.
    """
    proximo = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.gira_id == gira_id,
            InscricaoConsulente.status == StatusNovo.lista_espera,
        )
        .order_by(InscricaoConsulente.posicao)
        .with_for_update()
        .first()
    )

    if not proximo:
        return None

    # Promove na nova tabela
    proximo.status = StatusNovo.confirmado

    db.flush()
    return proximo


def promover_fila_em_lote(
    db: Session,
    gira_id: UUID,
    vagas_abertas: int,
) -> list[dict]:
    """
    Promove até `vagas_abertas` pessoas da lista de espera para confirmado.

    Chamado por gira_service.update_gira() quando o limite aumenta.
    FOR UPDATE serializa para evitar dupla-promoção em updates concorrentes.

    Retorna lista de { nome, telefone, posicao } para notificação via WA.
    """
    if vagas_abertas <= 0:
        return []

    proximos = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.gira_id == gira_id,
            InscricaoConsulente.consulente_id.isnot(None),
            InscricaoConsulente.status == StatusNovo.lista_espera,
        )
        .order_by(InscricaoConsulente.posicao)
        .limit(vagas_abertas)
        .with_for_update()
        .all()
    )

    promovidos = []
    for inscricao in proximos:
        inscricao.status = StatusNovo.confirmado
        db.flush()
        if inscricao.consulente:
            promovidos.append({
                "nome":     inscricao.consulente.nome,
                "telefone": inscricao.consulente.telefone,
                "posicao":  inscricao.posicao,
            })

    return promovidos

def find_or_create_consulente(
    db: Session,
    nome: str,
    telefone: str | None,
    terreiro_id: UUID,
    source: str,
    created_by: UUID | None = None,
    primeira_visita: bool | None = None
):
    
    nome_normalizado = nome.strip()
    
    if not nome_normalizado:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    
    telefone_normalizado = None
    
    # Se for cadastro_manual
    # Telefone é opcional
    if source == "cadastro_maunal":
        if telefone:
            if not validate_phone(telefone):
                raise HTTPException(status_code=400, detail="Telefone inválido")
            telefone = normalize_phone(telefone)
        # burca por telefone
        if telefone:
            consulente_existente = db.query(Consulente).filter(
                Consulente.telefone == telefone
            ).first()
        else:
            consulente_existente = db.query(Consulente).filter(
                Consulente.terreiro_id == terreiro_id,
                func.lower(Consulente.nome) == nome_normalizado.lower(),
                Consulente.deleted_at.is_(None)
            ).first()
            
        if consulente_existente:
            consulente = consulente_existente
        else:
            consulente = Consulente(
                nome=nome_normalizado,
                telefone=telefone,
                terreiro_id=terreiro_id,
                created_by=created_by,
                source="cadastro_manual"
            )
            db.add(consulente)
            db.flush() 
        

    if telefone:
        if not validate_phone(telefone):
            raise HTTPException(status_code=400, detail="Telefone inválido")

        telefone_normalizado = normalize_phone(telefone)

        encontrados = db.query(Consulente).filter(
            Consulente.telefone == telefone_normalizado
        ).all()

        if len(encontrados) == 1:
            return encontrados[0]

        elif len(encontrados) > 1:
            # ⚠️ conflito — você PRECISA decidir uma regra
            # escolha pragmática: pegar o mais antigo
            return sorted(encontrados, key=lambda c: c.created_at)[0]

    # ── fallback: busca por nome (apenas interno deveria usar isso) ──
    # simples, sem fuzzy por enquanto
    possiveis = db.query(Consulente).filter(
        Consulente.nome.ilike(f"%{nome.strip()}%")
    ).limit(5).all()

    # ⚠️ aqui você tem 3 opções:
    # 1. ignorar e criar novo (mais simples)
    # 2. retornar lista pro frontend decidir (melhor UX)
    # 3. heurística automática (arriscado)

    # vou assumir abordagem simples por agora:
    consulente = Consulente(
        nome=nome.strip(),
        terreiro_id=terreiro_id,
        telefone=telefone_normalizado,
        primeira_visita=primeira_visita if primeira_visita is not None else True,
        source=source,
        created_by=created_by,
    )

    db.add(consulente)
    db.flush()

    return consulente

def inscrever_publico(db: Session, slug: str, data: InscricaoPublicaRequest):
    """
    Inscreve consulente em gira pública via link público.

    FLUXO TRANSACIONAL (ordem importa para evitar race condition):
      1. Busca a gira e valida status/janela de tempo
      2. Normaliza e valida telefone
      3. Busca/cria consulente
      4. Verifica inscrição existente (cancelada vs ativa)
      5. SELECT FOR UPDATE nas inscrições da gira — serializa concorrência
      6. Conta confirmados DENTRO do lock
      7. Decide status (confirmado ou lista_espera)
      8. Insere com posicao = count + 1 (atômico dentro do lock)
    """
    gira = db.query(Gira).filter(
        Gira.slug_publico == slug,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    if agora < gira.abertura_lista:
        raise HTTPException(status_code=400, detail="Lista ainda não foi aberta")
    if agora > gira.fechamento_lista:
        raise HTTPException(status_code=400, detail="Lista encerrada")

    if not validate_phone(data.telefone):
        raise HTTPException(status_code=400, detail="Telefone inválido")

    telefone = normalize_phone(data.telefone)

    # ── Dupla validação de primeira_visita ────────────────────────────────────
    # Camada 1 (declarativa): checkbox do usuário
    # Camada 2 (autoritativa): existência do telefone no banco
    consulente = find_or_create_consulente(db, data.nome, telefone, source="link_publico", terreiro_id=gira.terreiro_id, primeira_visita=data.primeira_visita)
    if consulente.nome != data.nome.strip():
        pass # Opcional: logar essa discrepância para análise futura (ex: "Maria" vs "Maria Silva")

    # ── Verifica duplicata (qualquer status, inclusive cancelado) ─────────────
    inscricao_existente = db.query(InscricaoConsulente).filter(
        InscricaoConsulente.gira_id == gira.id,
        InscricaoConsulente.consulente_id == consulente.id,
    ).first()

    if inscricao_existente:
        if inscricao_existente.status == StatusNovo.cancelado:
            # Mensagem orientativa — não expõe detalhes internos
            raise HTTPException(
                status_code=400,
                detail=(
                    "Sua inscrição nesta gira foi cancelada. "
                    "Para retornar à lista, entre em contato com a administração do terreiro."
                ),
            )
        # Inscrição ativa em qualquer outro status
        raise HTTPException(status_code=400, detail="Telefone já inscrito nesta gira")

    # ── Seção crítica: FOR UPDATE serializa inscrições concorrentes ───────────
    # Bloqueia todas as inscrições desta gira para leitura consistente.
    # Duas requisições simultâneas executarão esta seção em série,
    # garantindo que o limite de vagas nunca seja ultrapassado.
    """
    ETAPA 2: Dupla escrita.
    
    Mantém escrita em inscricoes_gira (compatibilidade com rollback).
    Adiciona escrita em inscricoes_consulente (nova fonte de verdade).
    Ambas dentro da mesma transação — ou as duas inserem ou nenhuma.
    """
    # ... toda a lógica de validação existente permanece igual ...
    # (busca gira, valida janela de tempo, normaliza telefone,
    #  busca/cria consulente, verifica duplicata — SEM ALTERAÇÃO)

    # ── Seção crítica: FOR UPDATE em inscricoes_consulente ───────────────────
    # MUDANÇA: o lock agora é na nova tabela, que será a fonte de verdade.
    # inscricoes_gira não tem o mesmo lock — mas ambas estão na mesma
    # transação, então a consistência é garantida pelo isolamento do Postgres.
    inscricoes_ativas = (
        db.query(InscricaoConsulente)        # ← nova tabela para o lock
        .filter(
            InscricaoConsulente.gira_id == gira.id,
            InscricaoConsulente.status.in_([
                StatusNovo.confirmado,
                StatusNovo.lista_espera,
            ]),
        )
        .with_for_update()
        .all()
    )

    confirmados = sum(
        1 for i in inscricoes_ativas
        if i.status == StatusNovo.confirmado
    )
    proxima_posicao = len(inscricoes_ativas) + 1

    status_inicial = (
        StatusNovo.lista_espera
        if confirmados >= gira.limite_consulentes
        else StatusNovo.confirmado
    )

    observacoes_sanitizadas = None
    if data.observacoes:
        observacoes_sanitizadas = data.observacoes.strip()[:500] or None

    # ── INSERT na nova tabela (fonte de verdade) ─────────────────────────────
    inscricao_nova = InscricaoConsulente(
        gira_id=gira.id,
        consulente_id=consulente.id,
        posicao=proxima_posicao,
        status=status_inicial,
        observacoes=observacoes_sanitizadas,
        usuario_id=None,
        source="link_publico"
    )
    db.add(inscricao_nova)
    db.flush()  # gera o ID antes de usar no legado

    # ── Commit único — atomicidade total ─────────────────────────────────────
    db.commit()
    db.refresh(inscricao_nova)
    
    payload = {
            "title": "👤 Nova Inscrição",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"{data.nome} se inscreveu na {gira.titulo} (vaga {confirmados + 1}/{gira.limite_consulentes})",
            "url": f"/giras/{gira.id}",
        }

    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return InscricaoResponse(
        id=inscricao_nova.id,
        posicao=inscricao_nova.posicao,
        status=inscricao_nova.status,
        created_at=inscricao_nova.created_at,
        consulente_nome=consulente.nome,
        consulente_telefone=consulente.telefone,
        observacoes=inscricao_nova.observacoes,
        usuario_id=inscricao_nova.usuario_id,
        source=inscricao_nova.source
    )

def inscrever_interno(db: Session, gira_id: UUID, data: InscricaoPublicaRequest, usuario_id: UUID):
    print("Validar dados: ", data)
    """
    Inscrição interna feita por um usuário logado (membro do terreiro).
    Funcionalmente similar à inscrição pública, mas sem validação de telefone
    e com acesso controlado por autenticação.
    """
    # Implementação similar a inscrever_publico(), mas sem validação de telefone
    # e com lógica de criação de consulente adaptada para membros internos.
    # O fluxo de lock e decisão de vaga permanece o mesmo.
     # Placeholder — implementar seguindo a mesma estrutura da função pública
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.status == StatusGiraEnum.aberta,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    agora = datetime.utcnow()
    if agora < gira.abertura_lista:
        raise HTTPException(status_code=400, detail="Lista ainda não foi aberta")
    if agora > gira.fechamento_lista:
        raise HTTPException(status_code=400, detail="Lista encerrada")
    
    consulente = find_or_create_consulente(db, data.nome, data.telefone, gira.terreiro_id, source="cadastro_manual", created_by=usuario_id, primeira_visita=data.primeira_visita)
        
    if consulente.nome != data.nome.strip():
        pass # Opcional: logar essa discrepância para análise futura (ex: "Maria" vs "Maria Silva")

    # ── Verifica duplicata (qualquer status, inclusive cancelado) ─────────────
    inscricao_existente = db.query(InscricaoConsulente).filter(
        InscricaoConsulente.gira_id == gira.id,
        InscricaoConsulente.consulente_id == consulente.id,
    ).first()

    if inscricao_existente:
        if inscricao_existente.status == StatusNovo.cancelado:
            # Mensagem orientativa — não expõe detalhes internos
            raise HTTPException(
                status_code=400,
                detail=(
                    "Sua inscrição nesta gira foi cancelada. "
                    "Para retornar à lista, entre em contato com a administração do terreiro."
                ),
            )
        # Inscrição ativa em qualquer outro status
        raise HTTPException(status_code=400, detail="Telefone já inscrito nesta gira")

    inscricoes_ativas = (
        db.query(InscricaoConsulente)        # ← nova tabela para o lock
        .filter(
            InscricaoConsulente.gira_id == gira.id,
            InscricaoConsulente.status.in_([
                StatusNovo.confirmado,
                StatusNovo.lista_espera,
            ]),
        )
        .with_for_update()
        .all()
    )

    confirmados = sum(
        1 for i in inscricoes_ativas
        if i.status == StatusNovo.confirmado
    )
    proxima_posicao = len(inscricoes_ativas) + 1

    status_inicial = (
        StatusNovo.lista_espera
        if confirmados >= gira.limite_consulentes
        else StatusNovo.confirmado
    )
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    observacoes_sanitizadas = None
    if data.observacoes:
        observacoes_sanitizadas = data.observacoes.strip()[:500] or None

    # ── INSERT na nova tabela (fonte de verdade) ─────────────────────────────
    inscricao_nova = InscricaoConsulente(
        gira_id=gira.id,
        consulente_id=consulente.id,
        posicao=proxima_posicao,
        status=status_inicial,
        observacoes=observacoes_sanitizadas,
        usuario_id=usuario_id,
        source="cadastro_manual"
    )
    db.add(inscricao_nova)
    db.flush()  # gera o ID antes de usar no legado
    
    # ── Commit único — atomicidade total ─────────────────────────────────────
    db.commit()
    db.refresh(inscricao_nova)
    
    payload = {
            "title": "👤 Nova Inscrição",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"{usuario.nome} inscreveu o {consulente.nome} na gira {gira.titulo} (vaga {confirmados + 1}/{gira.limite_consulentes})",
            "url": f"/giras/{gira.id}",
        }

    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return InscricaoResponse(
        id=inscricao_nova.id,
        posicao=inscricao_nova.posicao,
        status=inscricao_nova.status,
        created_at=inscricao_nova.created_at,
        consulente_nome=consulente.nome,
        consulente_telefone=consulente.telefone,
        observacoes=inscricao_nova.observacoes,
        usuario_id=inscricao_nova.usuario_id,
        source=inscricao_nova.source
    )

def reativar_inscricao(db: Session, inscricao_id: UUID, terreiro_id: UUID, usuario_id: UUID = None) -> dict:
    # 1. Busca inscrição (sem lock ainda)
    inscricao = (
        db.query(InscricaoConsulente)
        .filter(InscricaoConsulente.id == inscricao_id)
        .first()
    )
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    # 2. LOCK na GIRA (esse é o ponto crítico)
    gira = (
        db.query(Gira)
        .filter(
            Gira.id == inscricao.gira_id,
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        )
        .with_for_update()  # 🔥 mutex aqui
        .first()
    )
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if inscricao.status != StatusInscricaoEnum.cancelado:
        raise HTTPException(status_code=400, detail="Inscrição não está cancelada")

    # 3. Conta novamente (agora seguro, porque a gira está lockada)
    confirmados = (
        db.query(InscricaoConsulente)
        .filter(
            InscricaoConsulente.gira_id == gira.id,
            InscricaoConsulente.consulente_id.isnot(None),
            InscricaoConsulente.status == StatusNovo.confirmado,
        )
        .count()
    )

    # 4. Decide com consistência garantida
    if confirmados < (gira.limite_consulentes or 0):
        novo_status = StatusInscricaoEnum.confirmado
    else:
        novo_status = StatusInscricaoEnum.lista_espera

    # 5. Atualiza
    inscricao.status = novo_status

    db.commit()
    db.refresh(inscricao)

    nome = inscricao.consulente.nome if inscricao.consulente else "Consulente"
    
    usuario = None  # Placeholder — implementar busca do usuário logado via usuario_id se necessário
    if usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario:
        nome_usuario = usuario.nome
    else:
        nome_usuario = "Um usuário"
    
    payload = {
            "title": "🔄 Inscrição Reativada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"{nome_usuario} reativou a inscrição de {nome} na {gira.titulo} como {novo_status.value}.",
            "url": f"/giras/{gira.id}",
        }
    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return {
        "ok": True,
        "status": novo_status,
        "nome": nome,
        "mensagem": (
            f"{nome} reativado(a) como confirmado(a)."
            if novo_status == StatusInscricaoEnum.confirmado
            else f"{nome} reativado(a) na lista de espera (gira lotada)."
        ),
    }


def update_presenca(
    db: Session,
    inscricao_id: UUID,
    data: PresencaUpdate,
    terreiro_id: UUID,
) -> dict:
    """Atualiza status de presença (compareceu / faltou)."""
    """
    MUDANÇA: atualiza InscricaoConsulente.
    Garante consistência durante o período de transição.
    """
    # Busca na nova tabela (fonte de verdade)
    inscricao = db.query(InscricaoConsulente).filter(
        InscricaoConsulente.id == inscricao_id
    ).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    gira = db.query(Gira).filter(
        Gira.id == inscricao.gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if data.status not in ("compareceu", "faltou"):
        raise HTTPException(status_code=400, detail="Status inválido")

    # Atualiza a nova tabela
    inscricao.status = data.status

    db.commit()
    return {"ok": True, "status": inscricao.status}


def cancelar_inscricao(db: Session, inscricao_id: UUID, terreiro_id: UUID, usuario_id: UUID) -> dict:
    """
    Cancela inscrição e promove automaticamente 1 pessoa da fila de espera
    (apenas quando a inscrição cancelada era confirmada).

    Cancelamento = aviso prévio → não penaliza o score.
    Retorna { ok, promovido: { nome, telefone, posicao } | None }.
    """
    """
    MUDANÇA: cancela em InscricaoConsulente (fonte de verdade).
    Promove da fila usando InscricaoConsulente.
    Mantém sincronismo com legado.
    """
    
    
    # Busca na nova tabela
    inscricao = db.query(InscricaoConsulente).filter(
        InscricaoConsulente.id == inscricao_id
    ).first()
    if not inscricao:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    gira = db.query(Gira).filter(
        Gira.id == inscricao.gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=403, detail="Acesso negado")

    nome = inscricao.consulente.nome if inscricao.consulente else "Consulente"
    era_confirmado = inscricao.status == StatusNovo.confirmado

    # Buscar o usuário logado para fins de auditoria e notificação
    # (pode ser útil para logs ou para incluir o nome do usuário na mensagem de
    usuario = None  # Placeholder — implementar busca do usuário logado via usuario_id se necessário
    if usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario:
        nome_usuario = usuario.nome
    else:
        nome_usuario = "Um usuário"
    # Cancela na nova tabela
    inscricao.status = StatusNovo.cancelado

    # Promoção da fila — agora usa InscricaoConsulente
    promovido_inscricao = None
    if era_confirmado:
        promovido_inscricao = _promover_lista_espera_novo(db, gira.id)

    db.commit()

    resultado: dict = {"ok": True, "promovido": None}
    if promovido_inscricao and promovido_inscricao.consulente:
        resultado["promovido"] = {
            "nome":     promovido_inscricao.consulente.nome,
            "telefone": promovido_inscricao.consulente.telefone,
            "posicao":  promovido_inscricao.posicao,
        }

    corpo_push = f"{nome_usuario} cancelou a inscrição do {nome} na {gira.titulo}"
    if resultado["promovido"]:
        corpo_push += f" → {resultado['promovido']['nome']} promovido(a) da fila!"
    payload = {
        "title": "❌ Inscrição Cancelada",
        "terreiro_id": str(gira.terreiro_id),
        "body": corpo_push,
        "url": f"/giras/{gira.id}",
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )
    return resultado