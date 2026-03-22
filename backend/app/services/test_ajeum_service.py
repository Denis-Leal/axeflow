"""
test_ajeum_service.py — AxeFlow
Testes do sistema Ajeum focados em:
  - concorrência real (threads simultâneas simulando múltiplos usuários)
  - limite de vagas (não ultrapassar em condição de corrida)
  - idempotência (double-tap, re-seleção)
  - optimistic locking (dois admins confirmando ao mesmo tempo)
  - transições de estado válidas e inválidas
  - isolamento multi-tenant

Padrão de teste:
  - Usa pytest com fixtures de banco (mesmo padrão esperado em um projeto FastAPI)
  - Testes de concorrência usam threading.Thread (não asyncio) porque
    o SQLAlchemy síncrono (usado no projeto) usa connections por thread
  - Cada thread recebe sua própria Session para simular requests independentes

IMPORTANTE SOBRE TESTES DE CONCORRÊNCIA:
  Eles não garantem que o race condition ACONTECE — dependem de timing.
  O que garantem é que SE acontecer, o sistema lida corretamente.
  Para alta confiança, execute com pytest-repeat (pytest --count=20).

Setup necessário no conftest.py (padrão do projeto):
  - fixture `db` que fornece Session de teste
  - fixture `terreiro_factory` que cria Terreiro
  - fixture `usuario_factory` que cria Usuario
  - fixture `gira_factory` que cria Gira
"""
import threading
import time
from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models.ajeum import AjeumItem, AjeumSelecao, Ajeum, StatusSelecaoEnum
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.schemas.ajeum_schema import (
    AjeumCreate,
    AjeumItemCreate,
    AjeumItemEdit,
    ConfirmarSelecaoRequest,
)
from app.services import ajeum_service
from fastapi import HTTPException


# ══════════════════════════════════════════════════════════════════════════════
# FIXTURES LOCAIS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def ajeum_com_limite_3(db: Session, gira: Gira, admin: Usuario) -> Ajeum:
    """
    Cria um Ajeum com um item de limite 3.
    Reutilizado em múltiplos testes de concorrência.
    """
    data = AjeumCreate(
        itens=[AjeumItemCreate(descricao="Bacon", limite=3)],
    )
    return ajeum_service.criar_ajeum(db, gira.id, data, admin)


@pytest.fixture
def item_limite_1(db: Session, ajeum_com_limite_3: Ajeum) -> AjeumItem:
    """Item separado com limite 1 para testar esgotamento."""
    item = AjeumItem(
        terreiro_id = ajeum_com_limite_3.terreiro_id,
        ajeum_id    = ajeum_com_limite_3.id,
        descricao   = "Item único",
        limite      = 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ══════════════════════════════════════════════════════════════════════════════
# 1. TESTES BÁSICOS DE SELEÇÃO
# ══════════════════════════════════════════════════════════════════════════════

class TestSelecaoBasica:

    def test_selecionar_item_cria_selecao(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
    ):
        """Seleção básica deve criar registro com status selecionado."""
        item = ajeum_com_limite_3.itens[0]
        selecao = ajeum_service.selecionar_item(db, item.id, membro)

        assert selecao.status   == StatusSelecaoEnum.selecionado
        assert str(selecao.membro_id) == str(membro.id)
        assert str(selecao.item_id)   == str(item.id)
        assert selecao.version        == 1

    def test_selecionar_item_errado_terreiro_retorna_403(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro_outro_terreiro: Usuario,  # fixture de outro terreiro
    ):
        """Membro de outro terreiro não pode selecionar item."""
        item = ajeum_com_limite_3.itens[0]

        with pytest.raises(HTTPException) as exc:
            ajeum_service.selecionar_item(db, item.id, membro_outro_terreiro)

        assert exc.value.status_code == 403

    def test_gira_concluida_bloqueia_selecao(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
    ):
        """Seleção deve ser bloqueada em gira concluída."""
        # Conclui a gira
        ajeum = ajeum_com_limite_3
        gira  = db.query(Gira).filter(Gira.id == ajeum.gira_id).first()
        gira.status = "concluida"
        db.commit()

        item = ajeum_com_limite_3.itens[0]

        with pytest.raises(HTTPException) as exc:
            ajeum_service.selecionar_item(db, item.id, membro)

        assert exc.value.status_code == 400
        assert "concluída" in exc.value.detail


# ══════════════════════════════════════════════════════════════════════════════
# 2. TESTES DE LIMITE
# ══════════════════════════════════════════════════════════════════════════════

class TestLimiteVagas:

    def test_limite_atingido_retorna_409(
        self,
        db: Session,
        item_limite_1: AjeumItem,
        membro: Usuario,
        membro2: Usuario,  # segundo membro fixture
    ):
        """
        Cenário: item com limite 1.
        Primeiro membro seleciona → sucesso.
        Segundo membro tenta → 409.
        """
        # Primeiro membro seleciona
        ajeum_service.selecionar_item(db, item_limite_1.id, membro)

        # Segundo membro tenta selecionar o mesmo item
        with pytest.raises(HTTPException) as exc:
            ajeum_service.selecionar_item(db, item_limite_1.id, membro2)

        assert exc.value.status_code == 409
        assert "suficiente" in exc.value.detail.lower()

    def test_cancelar_libera_vaga(
        self,
        db: Session,
        item_limite_1: AjeumItem,
        membro: Usuario,
        membro2: Usuario,
    ):
        """
        Cenário: item lotado, primeiro cancela, segundo consegue selecionar.
        """
        # Membro 1 seleciona
        selecao = ajeum_service.selecionar_item(db, item_limite_1.id, membro)

        # Membro 2 não consegue
        with pytest.raises(HTTPException):
            ajeum_service.selecionar_item(db, item_limite_1.id, membro2)

        # Membro 1 cancela
        ajeum_service.cancelar_selecao(db, selecao.id, membro)

        # Membro 2 agora consegue
        selecao2 = ajeum_service.selecionar_item(db, item_limite_1.id, membro2)
        assert selecao2.status == StatusSelecaoEnum.selecionado


# ══════════════════════════════════════════════════════════════════════════════
# 3. TESTES DE IDEMPOTÊNCIA (DOUBLE-TAP E RE-SELEÇÃO)
# ══════════════════════════════════════════════════════════════════════════════

class TestIdempotencia:

    def test_double_tap_retorna_mesmo_resultado(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
    ):
        """
        Clicar duas vezes (double-tap) deve retornar o mesmo resultado.
        Não deve criar duas seleções nem retornar erro.
        """
        item = ajeum_com_limite_3.itens[0]

        selecao1 = ajeum_service.selecionar_item(db, item.id, membro)
        selecao2 = ajeum_service.selecionar_item(db, item.id, membro)

        # Deve ser o mesmo registro
        assert str(selecao1.id) == str(selecao2.id)
        assert selecao1.status  == selecao2.status

        # Não deve ter criado duplicata no banco
        total = db.query(AjeumSelecao).filter(
            AjeumSelecao.item_id   == item.id,
            AjeumSelecao.membro_id == membro.id,
        ).count()
        assert total == 1

    def test_reselecao_apos_cancelamento(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
    ):
        """
        Membro cancela e depois seleciona novamente.
        Deve reutilizar o registro existente (UPDATE, não INSERT).
        """
        item = ajeum_com_limite_3.itens[0]

        # Seleciona
        selecao = ajeum_service.selecionar_item(db, item.id, membro)
        selecao_id_original = selecao.id

        # Cancela
        ajeum_service.cancelar_selecao(db, selecao.id, membro)

        # Re-seleciona
        selecao_nova = ajeum_service.selecionar_item(db, item.id, membro)

        # Deve ser o mesmo registro (UPDATE, não novo INSERT)
        assert str(selecao_nova.id) == str(selecao_id_original)
        assert selecao_nova.status  == StatusSelecaoEnum.selecionado

        # Ainda deve ter apenas 1 registro no banco
        total = db.query(AjeumSelecao).filter(
            AjeumSelecao.item_id   == item.id,
            AjeumSelecao.membro_id == membro.id,
        ).count()
        assert total == 1

    def test_reselecao_com_limite_atingido_retorna_409(
        self,
        db: Session,
        item_limite_1: AjeumItem,
        membro: Usuario,
        membro2: Usuario,
    ):
        """
        Membro cancela, mas outra pessoa já pegou a vaga.
        Re-seleção deve retornar 409.
        """
        # Membro 1 seleciona e cancela
        selecao = ajeum_service.selecionar_item(db, item_limite_1.id, membro)
        ajeum_service.cancelar_selecao(db, selecao.id, membro)

        # Membro 2 pega a vaga
        ajeum_service.selecionar_item(db, item_limite_1.id, membro2)

        # Membro 1 tenta voltar
        with pytest.raises(HTTPException) as exc:
            ajeum_service.selecionar_item(db, item_limite_1.id, membro)

        assert exc.value.status_code == 409


# ══════════════════════════════════════════════════════════════════════════════
# 4. TESTES DE CONCORRÊNCIA (THREADING)
# ══════════════════════════════════════════════════════════════════════════════

class TestConcorrencia:
    """
    Testes com threads reais para validar que o FOR UPDATE funciona.

    ATENÇÃO: estes testes dependem de timing e podem ser não-determinísticos.
    Execute com --count=10 para maior confiança:
      pytest test_ajeum_service.py::TestConcorrencia --count=10
    """

    def test_limite_nunca_ultrapassado_com_requests_simultaneos(
        self,
        db_factory,         # fixture que cria nova Session por chamada
        item_limite_1: AjeumItem,
        membros_factory,    # fixture que cria N usuarios do mesmo terreiro
    ):
        """
        Cenário: item com limite 1.
        10 membros tentam selecionar ao mesmo tempo.
        Resultado esperado: exatamente 1 seleção ativa, 9 com 409.

        Este é o teste mais importante do sistema.
        """
        NUM_THREADS    = 10
        item_id        = item_limite_1.id
        terreiro_id    = item_limite_1.terreiro_id
        membros        = membros_factory(n=NUM_THREADS, terreiro_id=terreiro_id)

        resultados = []  # lista de (sucesso: bool, status_code: int | None)
        lock_resultados = threading.Lock()

        def tentar_selecionar(membro: Usuario):
            """Cada thread usa sua própria Session (conexão independente)."""
            session = db_factory()
            try:
                # Busca o membro na nova session (objeto pertence a outra session)
                membro_local = session.query(Usuario).get(membro.id)
                ajeum_service.selecionar_item(session, item_id, membro_local)
                with lock_resultados:
                    resultados.append((True, None))
            except HTTPException as exc:
                with lock_resultados:
                    resultados.append((False, exc.status_code))
            except Exception as exc:
                with lock_resultados:
                    resultados.append((False, 500))
            finally:
                session.close()

        # Cria threads e as inicia quase simultaneamente
        threads = [
            threading.Thread(target=tentar_selecionar, args=(membros[i],))
            for i in range(NUM_THREADS)
        ]

        # Barreira: todas as threads prontas antes de iniciar
        # (maximiza chance de concorrência real)
        inicio = threading.Barrier(NUM_THREADS)

        def com_barreira(membro):
            inicio.wait()
            tentar_selecionar(membro)

        threads = [
            threading.Thread(target=com_barreira, args=(membros[i],))
            for i in range(NUM_THREADS)
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)  # timeout de segurança

        # Validações
        sucessos = [r for r in resultados if r[0]]
        conflitos = [r for r in resultados if not r[0] and r[1] == 409]

        # NUNCA deve haver mais de 1 seleção bem-sucedida
        assert len(sucessos) == 1, (
            f"Esperado exatamente 1 sucesso, obtido {len(sucessos)}. "
            f"O FOR UPDATE não está funcionando corretamente."
        )

        # As 9 falhas devem ser 409 (limite atingido), não 500
        assert len(conflitos) == NUM_THREADS - 1, (
            f"Esperados {NUM_THREADS - 1} conflitos 409, obtidos {len(conflitos)}. "
            f"Resultados: {resultados}"
        )

        # Verificação direta no banco
        nova_session = db_factory()
        try:
            total_no_banco = nova_session.query(AjeumSelecao).filter(
                AjeumSelecao.item_id == item_id,
                AjeumSelecao.status  != StatusSelecaoEnum.cancelado,
            ).count()
            assert total_no_banco == 1, (
                f"Banco tem {total_no_banco} seleções ativas. Limite deveria ser 1."
            )
        finally:
            nova_session.close()

    def test_double_click_simultaneo_nao_cria_duplicata(
        self,
        db_factory,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
    ):
        """
        Cenário: mesmo membro clica duas vezes exatamente ao mesmo tempo.
        Resultado: exatamente 1 seleção no banco, sem erro 500.

        Valida o tratamento do IntegrityError no serviço.
        """
        item_id  = ajeum_com_limite_3.itens[0].id

        resultados    = []
        lock_resultados = threading.Lock()

        def tentar(idx: int):
            session = db_factory()
            try:
                membro_local = session.query(Usuario).get(membro.id)
                selecao = ajeum_service.selecionar_item(session, item_id, membro_local)
                with lock_resultados:
                    resultados.append(("ok", str(selecao.id)))
            except HTTPException as exc:
                with lock_resultados:
                    resultados.append(("http_error", exc.status_code))
            except Exception as exc:
                with lock_resultados:
                    resultados.append(("exception", str(exc)))
            finally:
                session.close()

        barreira = threading.Barrier(2)

        def com_barreira(idx):
            barreira.wait()
            tentar(idx)

        t1 = threading.Thread(target=com_barreira, args=(0,))
        t2 = threading.Thread(target=com_barreira, args=(1,))

        t1.start(); t2.start()
        t1.join(); t2.join()

        # Não deve ter lançado exceção genérica (500)
        exceptions = [r for r in resultados if r[0] == "exception"]
        assert len(exceptions) == 0, f"Exceção inesperada: {exceptions}"

        # Deve haver exatamente 1 seleção no banco
        nova_session = db_factory()
        try:
            total = nova_session.query(AjeumSelecao).filter(
                AjeumSelecao.item_id   == item_id,
                AjeumSelecao.membro_id == membro.id,
            ).count()
            assert total == 1, f"Esperado 1 registro, encontrado {total}"
        finally:
            nova_session.close()


# ══════════════════════════════════════════════════════════════════════════════
# 5. TESTES DE OPTIMISTIC LOCKING (CONFIRMAÇÃO)
# ══════════════════════════════════════════════════════════════════════════════

class TestOptimisticLocking:

    def _criar_selecao_ativa(
        self,
        db: Session,
        ajeum: Ajeum,
        membro: Usuario,
    ) -> AjeumSelecao:
        """Helper: cria uma seleção ativa para usar nos testes."""
        item = ajeum.itens[0]
        return ajeum_service.selecionar_item(db, item.id, membro)

    def test_confirmar_com_version_correta_funciona(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
    ):
        """Confirmação com version correta deve funcionar."""
        selecao = self._criar_selecao_ativa(db, ajeum_com_limite_3, membro)
        assert selecao.version == 1

        data = ConfirmarSelecaoRequest(novo_status="confirmado", version=1)
        resultado = ajeum_service.confirmar_selecao(db, selecao.id, data, admin)

        assert resultado.status  == StatusSelecaoEnum.confirmado
        assert resultado.version == 2  # incrementado

    def test_confirmar_com_version_errada_retorna_409(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
        admin2: Usuario,  # segundo admin
    ):
        """
        Cenário: admin A e admin B abrem a tela ao mesmo tempo.
        Admin A confirma primeiro (version 1 → 2).
        Admin B tenta confirmar com version 1 (stale) → deve receber 409.
        """
        selecao = self._criar_selecao_ativa(db, ajeum_com_limite_3, membro)

        # Admin A confirma primeiro
        data_a = ConfirmarSelecaoRequest(novo_status="confirmado", version=1)
        ajeum_service.confirmar_selecao(db, selecao.id, data_a, admin)

        # Admin B tenta com version desatualizada
        data_b = ConfirmarSelecaoRequest(novo_status="nao_entregue", version=1)

        with pytest.raises(HTTPException) as exc:
            ajeum_service.confirmar_selecao(db, selecao.id, data_b, admin2)

        assert exc.value.status_code == 409
        assert "modificado" in exc.value.detail.lower()

    def test_confirmar_em_sequencia_incrementa_version(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
    ):
        """
        Garante que version é incrementada corretamente em sequência.
        Útil para verificar que não há bug de incremento duplo.
        """
        selecao = self._criar_selecao_ativa(db, ajeum_com_limite_3, membro)
        assert selecao.version == 1

        # Primeira confirmação (1 → 2)
        data = ConfirmarSelecaoRequest(novo_status="confirmado", version=1)
        resultado = ajeum_service.confirmar_selecao(db, selecao.id, data, admin)
        assert resultado.version == 2

        # Tentativa de segunda confirmação com version 2 → deve falhar (é terminal)
        data2 = ConfirmarSelecaoRequest(novo_status="nao_entregue", version=2)
        with pytest.raises(HTTPException) as exc:
            ajeum_service.confirmar_selecao(db, selecao.id, data2, admin)

        assert exc.value.status_code == 400
        assert "terminal" in exc.value.detail.lower() or "inválida" in exc.value.detail.lower()


# ══════════════════════════════════════════════════════════════════════════════
# 6. TESTES DE TRANSIÇÃO DE ESTADO
# ══════════════════════════════════════════════════════════════════════════════

class TestTransicoes:

    def test_transicoes_validas(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
    ):
        """
        Tabela completa de transições válidas.
        """
        item = ajeum_com_limite_3.itens[0]

        # selecionado → cancelado (pelo membro)
        selecao = ajeum_service.selecionar_item(db, item.id, membro)
        ajeum_service.cancelar_selecao(db, selecao.id, membro)
        db.refresh(selecao)
        assert selecao.status == StatusSelecaoEnum.cancelado

        # cancelado → selecionado (re-seleção)
        selecao = ajeum_service.selecionar_item(db, item.id, membro)
        assert selecao.status == StatusSelecaoEnum.selecionado

        # selecionado → confirmado (pelo admin)
        data = ConfirmarSelecaoRequest(novo_status="confirmado", version=selecao.version)
        ajeum_service.confirmar_selecao(db, selecao.id, data, admin)
        db.refresh(selecao)
        assert selecao.status == StatusSelecaoEnum.confirmado

    def test_confirmado_nao_pode_ser_cancelado(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
    ):
        """Estado 'confirmado' é terminal — nenhuma transição permitida."""
        item = ajeum_com_limite_3.itens[0]
        selecao = ajeum_service.selecionar_item(db, item.id, membro)

        data = ConfirmarSelecaoRequest(novo_status="confirmado", version=1)
        ajeum_service.confirmar_selecao(db, selecao.id, data, admin)

        with pytest.raises(HTTPException) as exc:
            ajeum_service.cancelar_selecao(db, selecao.id, membro)

        assert exc.value.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# 7. TESTES DE MULTI-TENANT
# ══════════════════════════════════════════════════════════════════════════════

class TestMultiTenant:

    def test_membro_nao_ve_itens_de_outro_terreiro(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro_outro_terreiro: Usuario,
    ):
        """Membro de terreiro B não pode selecionar item de terreiro A."""
        item = ajeum_com_limite_3.itens[0]

        with pytest.raises(HTTPException) as exc:
            ajeum_service.selecionar_item(db, item.id, membro_outro_terreiro)

        assert exc.value.status_code == 403

    def test_admin_nao_confirma_selecao_de_outro_terreiro(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin_outro_terreiro: Usuario,
    ):
        """Admin de terreiro B não pode confirmar seleção de terreiro A."""
        item = ajeum_com_limite_3.itens[0]
        selecao = ajeum_service.selecionar_item(db, item.id, membro)

        data = ConfirmarSelecaoRequest(novo_status="confirmado", version=1)

        with pytest.raises(HTTPException) as exc:
            ajeum_service.confirmar_selecao(db, selecao.id, data, admin_outro_terreiro)

        assert exc.value.status_code == 403

    def test_criar_ajeum_em_gira_de_outro_terreiro_retorna_403(
        self,
        db: Session,
        gira_outro_terreiro: Gira,
        admin: Usuario,
    ):
        """Admin não pode criar Ajeum em gira de outro terreiro."""
        data = AjeumCreate(itens=[AjeumItemCreate(descricao="Bacon", limite=3)])

        with pytest.raises(HTTPException) as exc:
            ajeum_service.criar_ajeum(db, gira_outro_terreiro.id, data, admin)

        assert exc.value.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 8. TESTES DE EDIÇÃO E DELETE DE ITEM
# ══════════════════════════════════════════════════════════════════════════════

class TestEdicaoItem:

    def test_reduzir_limite_abaixo_de_selecoes_ativas_retorna_409(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        membro2: Usuario,
        admin: Usuario,
    ):
        """
        Item com 2 seleções ativas não pode ter limite reduzido para 1.
        """
        item = ajeum_com_limite_3.itens[0]

        # 2 membros selecionam
        ajeum_service.selecionar_item(db, item.id, membro)
        ajeum_service.selecionar_item(db, item.id, membro2)

        # Tenta reduzir limite para 1
        with pytest.raises(HTTPException) as exc:
            ajeum_service.editar_item(db, item.id, AjeumItemEdit(limite=1), admin)

        assert exc.value.status_code == 409
        assert "seleções ativas" in exc.value.detail

    def test_deletar_item_com_selecoes_ativas_retorna_409(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        membro: Usuario,
        admin: Usuario,
    ):
        """Item com seleção ativa não pode ser deletado."""
        item = ajeum_com_limite_3.itens[0]
        ajeum_service.selecionar_item(db, item.id, membro)

        with pytest.raises(HTTPException) as exc:
            ajeum_service.deletar_item(db, item.id, admin)

        assert exc.value.status_code == 409

    def test_deletar_item_sem_selecoes_funciona(
        self,
        db: Session,
        ajeum_com_limite_3: Ajeum,
        admin: Usuario,
    ):
        """Item sem seleções pode ser deletado (soft delete)."""
        item = ajeum_com_limite_3.itens[0]
        resultado = ajeum_service.deletar_item(db, item.id, admin)

        assert resultado["ok"] is True

        # Verifica soft delete (deleted_at preenchido, não removido fisicamente)
        from app.models.ajeum import AjeumItem
        item_no_banco = db.query(AjeumItem).filter(AjeumItem.id == item.id).first()
        assert item_no_banco is not None         # existe fisicamente
        assert item_no_banco.deleted_at is not None  # marcado como deletado