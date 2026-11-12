"""Regressões HTTP dos P0 com dados sintéticos e SQLite em memória."""
import importlib
import inspect
import socket
import sys
import unittest
from datetime import date, time, timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic_settings import BaseSettings


def carregar_configuracao_isolada():
    inicializador = BaseSettings.__init__
    valores = dict(
        DATABASE_URL="sqlite+pysqlite:///:memory:", SECRET_KEY="teste-local-sem-segredo",
        ALGORITHM="HS256", VAPID_PRIVATE_KEY="", VAPID_PUBLIC_KEY="", VAPID_EMAIL="",
        BREVO_API_KEY="", GMAIL_USER="teste@example.com", DEV_EMAIL="teste@example.com",
        FIREBASE_CREDENTIALS="", ENVIRONMENT="local", APP_URL="http://testserver",
    )

    def inicializar(instancia, **kwargs):
        return inicializador(instancia, _env_file=None, **valores)

    with patch.object(BaseSettings, "__init__", inicializar):
        importlib.import_module("app.core.config")


carregar_configuracao_isolada()

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.sqltypes import Uuid

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.api_key import ApiKey
from app.models.consulente import Consulente
from app.models.gira import Gira
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.routers import (api_key_router, atendimento_router, consulentes_router,
                         financeiro_router, gira_router, inscricao_router, membros_router)
from app.services import api_key_service
from app.utils.datetime_utils import utcnow


@compiles(JSONB, "sqlite")
def compilar_json_sqlite(tipo, compilador, **kwargs):
    return "JSON"


# O driver PostgreSQL aceita strings UUID. O adaptador SQLite precisa convertê-las.
processador_uuid_original = Uuid.bind_processor


def processador_uuid_sqlite(tipo, dialeto):
    original = processador_uuid_original(tipo, dialeto)
    if dialeto.name != "sqlite" or original is None:
        return original

    def converter(valor):
        return original(UUID(valor) if isinstance(valor, str) else valor)

    return converter


class SegurancaP0Tests(unittest.TestCase):
    def setUp(self):
        conectar = socket.socket.connect

        def conectar_local(instancia, endereco):
            if isinstance(endereco, tuple) and endereco[0] in ("127.0.0.1", "::1"):
                return conectar(instancia, endereco)
            raise AssertionError("Rede externa proibida nos testes")

        self.rede = patch.object(socket.socket, "connect", conectar_local)
        self.rede.start()
        self.uuid = patch.object(Uuid, "bind_processor", processador_uuid_sqlite)
        self.uuid.start()
        self.engine = create_engine("sqlite+pysqlite:///:memory:",
                                    connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # A extensão pg_trgm é usada apenas para detectar nomes semelhantes.
        with self.engine.connect() as conexao:
            conexao.connection.driver_connection.create_function("similarity", 2, lambda a, b: float(a == b))
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.a = Terreiro(nome="Tenant A", cidade="Teste")
        self.b = Terreiro(nome="Tenant B", cidade="Teste")
        self.db.add_all([self.a, self.b])
        self.db.flush()
        self.usuarios = {}
        for papel in ("admin", "operador", "membro"):
            usuario = Usuario(terreiro_id=self.a.id, nome=papel, email=f"{papel}@example.com",
                              senha_hash="fixture", role=papel, telefone="11987654321")
            self.db.add(usuario)
            self.usuarios[papel] = usuario
        agora = utcnow()
        self.giras = []
        for tenant in (self.a, self.b):
            gira = Gira(terreiro_id=tenant.id, titulo=tenant.nome, tipo="Teste", data=date.today(),
                        horario=time(20), limite_consulentes=20, abertura_lista=agora-timedelta(days=1),
                        fechamento_lista=agora+timedelta(days=1), slug_publico=str(tenant.id))
            self.db.add(gira)
            self.giras.append(gira)
        self.db.commit()
        self.app = FastAPI()
        for modulo in (api_key_router, atendimento_router, consulentes_router, financeiro_router,
                       gira_router, inscricao_router, membros_router):
            self.app.include_router(modulo.router)
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(self.app)
        self.push = patch("app.services.inscricao_service.send_push_to_terreiro")
        self.email = patch("app.services.membros_service.send_convite_membro", return_value=True)
        self.push.start()
        self.convite = self.email.start()

    def tearDown(self):
        self.client.close()
        self.email.stop()
        self.push.stop()
        self.db.close()
        self.engine.dispose()
        self.uuid.stop()
        self.rede.stop()

    def jwt(self, papel="admin"):
        token = create_access_token({"sub": str(self.usuarios[papel].id)})
        return {"Authorization": f"Bearer {token}"}

    def chave(self, scopes, tenant=None, proprietario=None):
        texto, prefixo, resumo = api_key_service._gerar_chave()
        chave = ApiKey(terreiro_id=(tenant or self.a).id,
                       user_id=(proprietario or self.usuarios["admin"]).id,
                       prefix=prefixo, key_hash=resumo, nome="Teste", scopes=scopes)
        self.db.add(chave)
        self.db.commit()
        return {"Authorization": f"Bearer {texto}"}, chave

    def inscrever(self, gira, papel):
        return self.client.post(f"/gira/{gira.id}/inscrever/interno", headers=self.jwt(papel),
                                json={"nome": "Pessoa sintética", "telefone": "11987654321"})

    def test_ac001_outro_tenant_sem_escritas(self):
        for papel in ("admin", "operador"):
            with self.subTest(papel=papel):
                resposta = self.inscrever(self.giras[1], papel)
                self.assertEqual(resposta.status_code, 404, resposta.text)
                self.assertEqual(self.db.query(Consulente).count(), 0)
                self.assertEqual(self.db.query(InscricaoConsulente).count(), 0)

    def test_ac001_admin_e_operador_proprio_tenant(self):
        for papel in ("admin", "operador"):
            with self.subTest(papel=papel):
                resposta = self.inscrever(self.giras[0], papel)
                self.assertEqual(resposta.status_code, 200, resposta.text)
                inscricao = self.db.query(InscricaoConsulente).one()
                self.assertEqual(inscricao.usuario_id, self.usuarios[papel].id)
                self.db.delete(inscricao)
                self.db.query(Consulente).delete()
                self.db.commit()

    def test_ac001_membro_bloqueado(self):
        resposta = self.inscrever(self.giras[0], "membro")
        self.assertEqual(resposta.status_code, 403, resposta.text)
        self.assertEqual(self.db.query(Consulente).count(), 0)

    def test_ac002_matriz_criacao_papeis(self):
        for ator, destino, esperado in (("operador", "admin", 403), ("admin", "admin", 200),
                                         ("operador", "operador", 200), ("operador", "membro", 200)):
            with self.subTest(ator=ator, destino=destino):
                email = f"novo-{ator}-{destino}@example.com"
                resposta = self.client.post("/membros", headers=self.jwt(ator), json={
                    "nome": "Novo", "email": email, "senha": "Teste123!seguro", "role": destino,
                    "telefone": "11987654321"})
                self.assertEqual(resposta.status_code, esperado, resposta.text)
                usuario = self.db.query(Usuario).filter_by(email=email).first()
                self.assertEqual(usuario is not None, esperado == 200)

    def test_ac002_recusa_antes_de_hash_e_convite(self):
        with patch("app.services.membros_service.hash_password") as hash_senha:
            resposta = self.client.post("/membros", headers=self.jwt("operador"), json={
                "nome": "Recusado", "email": "recusado@example.com", "senha": "Teste123!", "role": "admin"})
            self.assertEqual(resposta.status_code, 403, resposta.text)
            hash_senha.assert_not_called()
            self.convite.assert_not_called()
        resposta = self.client.post("/membros", headers=self.jwt("membro"), json={
            "nome": "Recusado", "email": "recusado@example.com", "senha": "Teste123!", "role": "membro"})
        self.assertEqual(resposta.status_code, 403, resposta.text)

    def test_ac003_chave_read_bloqueada_no_painel(self):
        headers, _ = self.chave(["giras:read"])
        for caminho in ("/consulentes/lista", "/api-keys"):
            with self.subTest(caminho=caminho):
                resposta = self.client.get(caminho, headers=headers)
                self.assertEqual(resposta.status_code, 401, resposta.text)
        for caminho in ("/membros", f"/giras/{self.giras[0].id}/inscricoes"):
            resposta = self.client.get(caminho, headers=headers)
            self.assertEqual(resposta.status_code, 403, resposta.text)
        resposta = self.client.post(f"/gira/{self.giras[0].id}/inscrever/interno", headers=headers,
                                    json={"nome": "Teste", "telefone": "11987654321"})
        self.assertEqual(resposta.status_code, 401, resposta.text)
        self.assertEqual(self.db.query(Consulente).count(), 0)

    def test_ac003_contratos_leitura_preservados(self):
        matriz = (("membros:read", "/membros"),
                  ("inscricoes:read", f"/giras/{self.giras[0].id}/inscricoes"),
                  ("giras:read", "/v1/giras"), ("atendimentos:read", "/atendimentos"),
                  ("agendamentos:read", "/agendamentos"), ("financeiro:read", "/formas-pagamento"))
        for scope, caminho in matriz:
            with self.subTest(scope=scope):
                headers, _ = self.chave([scope])
                resposta = self.client.get(caminho, headers=headers)
                self.assertEqual(resposta.status_code, 200, resposta.text)

    def test_ac003_chave_outro_tenant_ou_inativa(self):
        headers, chave = self.chave(["giras:read"], tenant=self.b)
        resposta = self.client.get("/v1/giras", headers=headers)
        self.assertEqual(resposta.status_code, 401, resposta.text)
        chave.terreiro_id = self.a.id
        chave.ativa = False
        self.db.commit()
        resposta = self.client.get("/v1/giras", headers=headers)
        self.assertEqual(resposta.status_code, 401, resposta.text)

    def test_ac003_jwt_painel_preservado(self):
        for caminho in ("/membros", "/consulentes/lista", "/api-keys"):
            resposta = self.client.get(caminho, headers=self.jwt())
            self.assertEqual(resposta.status_code, 200, resposta.text)

    def test_ac003_export_scope_e_tenant(self):
        caminho = f"/giras/{self.giras[0].id}/export?formato=xlsx"
        for scopes in ([], ["giras:read"]):
            headers, _ = self.chave(scopes)
            resposta = self.client.get(caminho, headers=headers)
            self.assertEqual(resposta.status_code, 403, resposta.text)
        headers, _ = self.chave(["relatorios:read"])
        resposta = self.client.get(caminho, headers=headers)
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.content.startswith(b"PK"))
        resposta = self.client.get(f"/giras/{self.giras[1].id}/export", headers=headers)
        self.assertEqual(resposta.status_code, 404, resposta.text)

    def test_ac003_chave_expirada_e_usuario_inativo(self):
        headers, chave = self.chave(["giras:read"])
        chave.expires_at = utcnow() - timedelta(days=1)
        self.db.commit()
        self.assertEqual(self.client.get("/v1/giras", headers=headers).status_code, 401)
        chave.expires_at = None
        self.usuarios["admin"].ativo = False
        self.db.commit()
        self.assertEqual(self.client.get("/v1/giras", headers=headers).status_code, 401)

    def test_ac003_escrita_atendimentos_agendamentos_financeiro(self):
        tipo_payload = {"nome": "Atendimento teste", "valor": "10.00", "tipo_cobranca": "servico"}
        leitura, _ = self.chave(["atendimentos:read"])
        self.assertEqual(self.client.post("/atendimentos", headers=leitura, json=tipo_payload).status_code, 403)
        tipos, _ = self.chave(["atendimentos:write"])
        resposta = self.client.post("/atendimentos", headers=tipos, json=tipo_payload)
        self.assertEqual(resposta.status_code, 201, resposta.text)
        tipo_id = resposta.json()["id"]
        resposta = self.client.patch(f"/atendimentos/{tipo_id}", headers=tipos, json={"nome": "Editado"})
        self.assertEqual(resposta.status_code, 200, resposta.text)
        consulente = Consulente(terreiro_id=self.a.id, nome="Sintético", telefone="11999999999",
                                primeira_visita=True, source="cadastro_manual")
        self.db.add(consulente)
        self.db.commit()
        payload = {"consulente_id": str(consulente.id), "atendimento_tipo_id": tipo_id,
                   "data": "2030-01-01", "hora_inicio": "15:00", "hora_fim": "16:00"}
        resposta = self.client.post("/agendamentos", headers=tipos, json=payload)
        self.assertEqual(resposta.status_code, 403, resposta.text)
        agendamentos, _ = self.chave(["agendamentos:write"])
        resposta = self.client.post("/agendamentos", headers=agendamentos, json=payload)
        self.assertEqual(resposta.status_code, 201, resposta.text)
        agendamento_id = resposta.json()["id"]
        resposta = self.client.patch(f"/agendamentos/{agendamento_id}", headers=agendamentos,
                                     json={"observacoes": "Editado"})
        self.assertEqual(resposta.status_code, 200, resposta.text)
        resposta = self.client.post("/formas-pagamento", headers=tipos, json={"nome": "Teste"})
        self.assertEqual(resposta.status_code, 403, resposta.text)
        financeiro, _ = self.chave(["financeiro:write"])
        resposta = self.client.post("/formas-pagamento", headers=financeiro, json={"nome": "Teste"})
        self.assertEqual(resposta.status_code, 201, resposta.text)

    def test_ac003_escrita_giras_scope_canonico(self):
        payload = {"titulo": "Gira teste", "tipo": "Teste", "data": "2030-01-01", "horario": "20:00",
                   "limite_consulentes": 20, "abertura_lista": "2029-12-30T10:00:00Z",
                   "fechamento_lista": "2030-01-01T19:00:00Z"}
        leitura, _ = self.chave(["giras:read"])
        resposta = self.client.post("/giras", headers=leitura, json=payload)
        self.assertEqual(resposta.status_code, 403, resposta.text)
        escrita, _ = self.chave(["giras:write"])
        with patch("app.services.gira_service.send_push_to_terreiro"):
            resposta = self.client.post("/giras", headers=escrita, json=payload)
            self.assertEqual(resposta.status_code, 200, resposta.text)
            resposta = self.client.patch(f"/giras/{resposta.json()['id']}", headers=escrita,
                                         json={"titulo": "Editada"})
            self.assertEqual(resposta.status_code, 200, resposta.text)

    def test_ac003_scopes_usados_existem_no_catalogo(self):
        import re
        for modulo in (api_key_router, atendimento_router, financeiro_router, gira_router):
            scopes = re.findall(r'verificar_scope\([^,]+,\s*["\']([^"\']+)', inspect.getsource(modulo))
            self.assertTrue(set(scopes).issubset(api_key_service.SCOPES_DISPONIVEIS),
                            f"Scopes desconhecidos em {modulo.__name__}: {scopes}")


if __name__ == "__main__":
    unittest.main()
