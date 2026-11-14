"""Regressões de autenticação com HTTP real e dados locais sintéticos."""
import hashlib
import re
import unittest
from datetime import timedelta
from unittest.mock import patch

import test_security_p0 as base
from jose import jwt
from sqlalchemy.orm import sessionmaker
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.usuario import Usuario
from app.routers import auth_router, password_reset_router
from app.utils.datetime_utils import utcnow


SENHA_NOVA = "Senha sintetica longa 123!"
SENHA_LEGADA = "curta6"


class AuthSecurityTests(unittest.TestCase):
    tearDown = base.SegurancaP0Tests.tearDown
    jwt = base.SegurancaP0Tests.jwt

    def setUp(self):
        base.SegurancaP0Tests.setUp(self)
        self.app.include_router(auth_router.router)
        self.app.include_router(password_reset_router.router)
        self.app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        for modulo in (auth_router, password_reset_router):
            limiter = getattr(modulo, "limiter", None)
            if limiter is not None:
                limiter.reset()
                self.app.state.limiter = limiter
        from app.core import auth_rate_limit
        auth_rate_limit.storage.reset()
        self.ip = "192.0.2.1"

        @self.app.middleware("http")
        async def ip_sintetico(request, call_next):
            request.scope["client"] = (self.ip, 12345)
            return await call_next(request)

        self.usuarios["admin"].senha_hash = hash_password(SENHA_LEGADA)
        self.db.commit()

    def login(self, email=None, senha=SENHA_LEGADA, terreiro=None):
        dados = {"email": email or self.usuarios["admin"].email, "senha": senha}
        if terreiro is not None:
            dados["terreiro_id"] = str(terreiro)
        return self.client.post("/auth/login", json=dados)

    def token_reset(self, purpose="reset", tenant=None, expirado=False):
        token = "token-sintetico-" + str(self.a.id) + purpose
        registro = PasswordResetToken(user_id=self.usuarios["admin"].id,
                                      terreiro_id=(tenant or self.a).id,
                                      token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                      expires_at=utcnow() + timedelta(hours=-1 if expirado else 1),
                                      purpose=purpose)
        self.db.add(registro)
        self.db.commit()
        return token, registro

    def redefinir(self, token, purpose="reset", senha=SENHA_NOVA):
        return self.client.post("/auth/redefinir-senha", json={
            "token": token, "nova_senha": senha, "purpose": purpose})

    def test_ac001_login_legado_e_politica_nova(self):
        resposta = self.login()
        self.assertEqual(resposta.status_code, 200, resposta.text)
        for senha in (None, "a" * 15 + "\x00", "curta", "a" * 73, "á" * 37):
            with self.subTest(tamanho=len(senha) if senha is not None else None):
                resposta = self.client.patch("/auth/senha", headers=self.jwt(), json={
                    "senha_atual": SENHA_LEGADA, "nova_senha": senha})
                self.assertIn(resposta.status_code, (400, 422))
                self.assertTrue(verify_password(SENHA_LEGADA, self.usuarios["admin"].senha_hash))

    def test_ac001_registro_limites_unicode_e_sem_truncamento(self):
        for indice, (senha, esperado) in enumerate((("a" * 14, 422), ("á" * 37, 422),
                                                   ("a" * 15, 200), ("á" * 36, 200))):
            with self.subTest(indice=indice):
                resposta = self.client.post("/auth/register", json={
                    "nome": "Administrador", "email": f"registro{indice}@example.com", "senha": senha,
                    "telefone": "11987654321", "terreiro_nome": "Sintético", "terreiro_cidade": "Teste"})
                self.assertEqual(resposta.status_code, esperado, resposta.text)

    def test_ac002_troca_senha_revoga_jwt_legado_e_atual(self):
        legado = jwt.encode({"sub": str(self.usuarios["admin"].id), "exp": utcnow()+timedelta(hours=1)},
                            settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        atual = self.login().json()["access_token"]
        resposta = self.client.patch("/auth/senha", headers={"Authorization": f"Bearer {atual}"},
                                     json={"senha_atual": SENHA_LEGADA, "nova_senha": SENHA_NOVA})
        self.assertEqual(resposta.status_code, 200, resposta.text)
        for token in (legado, atual):
            resposta = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(resposta.status_code, 401)
            resposta = self.client.get("/api-keys", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(resposta.status_code, 401)
            resposta = self.client.post("/membros", headers={"Authorization": f"Bearer {token}"}, json={
                "nome": "Teste", "email": "nao-criar@example.com", "senha": SENHA_NOVA})
            self.assertEqual(resposta.status_code, 401)
        self.assertEqual(self.login(senha=SENHA_NOVA).status_code, 200)

    def test_ac004_reset_sucesso_replay_e_revogacao(self):
        anterior = self.login().json()["access_token"]
        token, registro = self.token_reset()
        resposta = self.redefinir(token)
        self.assertEqual(resposta.status_code, 200, resposta.text)
        self.db.refresh(registro)
        self.assertIsNotNone(registro.used_at)
        self.assertTrue(verify_password(SENHA_NOVA, self.usuarios["admin"].senha_hash))
        self.assertEqual(self.redefinir(token).status_code, 400)
        for caminho in ("/auth/me", "/api-keys", "/membros"):
            self.assertEqual(self.client.get(caminho, headers={"Authorization": f"Bearer {anterior}"}).status_code, 401)
        self.assertEqual(self.login(senha=SENHA_NOVA).status_code, 200)

    def test_ac004_expirado_nao_altera_senha(self):
        token, registro = self.token_reset(expirado=True)
        self.assertEqual(self.redefinir(token).status_code, 400)
        self.assertTrue(verify_password(SENHA_LEGADA, self.usuarios["admin"].senha_hash))
        self.assertIsNone(registro.used_at)

    def test_ac004_tenant_inconsistente_nao_altera_senha(self):
        token, _ = self.token_reset(tenant=self.b)
        self.assertEqual(self.redefinir(token).status_code, 400)
        self.assertTrue(verify_password(SENHA_LEGADA, self.usuarios["admin"].senha_hash))

    def test_ac004_convite_exige_finalidade_e_uso_unico(self):
        token, _ = self.token_reset(purpose="invite")
        self.assertEqual(self.redefinir(token).status_code, 400)
        resposta = self.redefinir(token, purpose="invite")
        self.assertEqual(resposta.status_code, 200, resposta.text)
        self.assertEqual(self.redefinir(token, purpose="invite").status_code, 400)

    def test_ac004_usuario_inativo_recusado(self):
        token, _ = self.token_reset()
        self.usuarios["admin"].ativo = False
        self.db.commit()
        self.assertEqual(self.redefinir(token).status_code, 400)

    def test_ac006_multitenant_sem_enumeracao_e_selecao(self):
        outro = Usuario(terreiro_id=self.b.id, nome="Outro tenant", email=self.usuarios["admin"].email,
                        telefone="11987654321", senha_hash=hash_password(SENHA_LEGADA), role="admin")
        self.db.add(outro)
        self.db.commit()
        resposta = self.login(senha="invalida")
        self.assertEqual(resposta.status_code, 401)
        self.assertNotIn("terreiros", resposta.json())
        resposta = self.login()
        self.assertEqual(resposta.status_code, 200, resposta.text)
        self.assertTrue(resposta.json()["requires_terreiro"])
        self.assertEqual({item["id"] for item in resposta.json()["terreiros"]}, {str(self.a.id), str(self.b.id)})
        resposta = self.login(terreiro=self.b.id)
        self.assertEqual(resposta.status_code, 200, resposta.text)
        payload = jwt.decode(resposta.json()["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        self.assertEqual(payload["sub"], str(outro.id))

    def test_ac006_segunda_conta_com_senha_distinta(self):
        outro = Usuario(terreiro_id=self.b.id, nome="Outro tenant", email=self.usuarios["admin"].email,
                        telefone="11987654321", senha_hash=hash_password(SENHA_NOVA), role="admin")
        self.db.add(outro)
        self.db.commit()
        resposta = self.login(senha=SENHA_NOVA)
        self.assertEqual(resposta.status_code, 200, resposta.text)
        payload = jwt.decode(resposta.json()["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        self.assertEqual(payload["sub"], str(outro.id))

    def test_ac003_busca_publica_sempre_vazia(self):
        respostas = []
        for email in (self.usuarios["admin"].email, "ausente@example.com"):
            resposta = self.client.post("/auth/esqueci-senha/buscar", json={"email": email})
            self.assertEqual(resposta.status_code, 200, resposta.text)
            respostas.append(resposta.json())
        self.assertEqual(respostas, [{"terreiros": []}, {"terreiros": []}])

    def test_ac003_recuperacao_generica_e_link_funcional(self):
        sessoes = sessionmaker(bind=self.engine, expire_on_commit=False)
        with patch("app.routers.password_reset_router.SessionLocal", sessoes):
            with patch("app.routers.password_reset_router._send", return_value=True) as envio:
                resposta = self.client.post("/auth/esqueci-senha/enviar", json={"email": self.usuarios["admin"].email})
                self.assertEqual(resposta.status_code, 200, resposta.text)
                html = envio.call_args.kwargs["html"]
                token = re.search(r'token=([^"&<>\s]+)', html).group(1)
                desconhecido = self.client.post("/auth/esqueci-senha/enviar", json={"email": "ausente@example.com"})
                self.assertEqual(desconhecido.status_code, resposta.status_code)
                self.assertEqual(desconhecido.json(), resposta.json())
                self.assertNotIn(token, resposta.text)
        registro = self.db.query(PasswordResetToken).one()
        self.assertEqual(registro.token_hash, hashlib.sha256(token.encode()).hexdigest())
        self.assertEqual(self.redefinir(token).status_code, 200)

    def test_ac005_convite_ignora_senha_cliente_e_ativa_por_link(self):
        self.email.stop()
        with patch("app.services.email_service._send", return_value=True) as envio:
            resposta = self.client.post("/membros", headers=self.jwt(), json={
                "nome": "Convidado", "email": "convidado@example.com", "telefone": "11987654321",
                "senha": SENHA_NOVA, "role": "membro"})
            self.assertEqual(resposta.status_code, 200, resposta.text)
            self.assertTrue(resposta.json()["email_convite_enviado"])
            html = envio.call_args.kwargs["html"]
            self.assertNotIn(SENHA_NOVA, html)
            token = re.search(r'token=([^"&<>\s]+)', html).group(1)
        usuario = self.db.query(Usuario).filter_by(email="convidado@example.com").one()
        self.assertFalse(verify_password(SENHA_NOVA, usuario.senha_hash))
        self.assertEqual(self.login(email=usuario.email, senha=SENHA_NOVA).status_code, 401)
        registro = self.db.query(PasswordResetToken).filter_by(user_id=usuario.id).one()
        self.assertEqual(registro.purpose, "invite")
        self.assertGreater(registro.expires_at.replace(tzinfo=None), utcnow().replace(tzinfo=None) + timedelta(minutes=59))
        self.assertLessEqual(registro.expires_at.replace(tzinfo=None), utcnow().replace(tzinfo=None) + timedelta(hours=1))
        self.assertEqual(self.redefinir(token, purpose="invite").status_code, 200)
        self.assertEqual(self.redefinir(token, purpose="invite").status_code, 400)
        self.assertEqual(self.login(email=usuario.email, senha=SENHA_NOVA).status_code, 200)

    def test_ac007_login_limite_conta_entre_ips_e_ip_entre_contas(self):
        for tentativa in range(10):
            self.ip = f"192.0.2.{tentativa+1}"
            resposta = self.login(senha="invalida")
            self.assertEqual(resposta.status_code, 401)
        self.ip = "192.0.2.20"
        self.assertEqual(self.login(senha="invalida").status_code, 429)
        from app.core import auth_rate_limit
        auth_rate_limit.storage.reset()
        for tentativa in range(20):
            resposta = self.login(email=f"ausente{tentativa}@example.com", senha="invalida")
            self.assertEqual(resposta.status_code, 401)
        self.assertEqual(self.login(email="ausente21@example.com", senha="invalida").status_code, 429)

    def test_ac007_reset_limite_antes_do_envio(self):
        sessoes = sessionmaker(bind=self.engine, expire_on_commit=False)
        with patch("app.routers.password_reset_router.SessionLocal", sessoes):
            with patch("app.routers.password_reset_router._send", return_value=True) as envio:
                for tentativa in range(5):
                    self.ip = f"192.0.2.{tentativa+1}"
                    resposta = self.client.post("/auth/esqueci-senha/enviar", json={"email": self.usuarios["admin"].email})
                    self.assertEqual(resposta.status_code, 200)
                self.ip = "192.0.2.20"
                resposta = self.client.post("/auth/esqueci-senha/enviar", json={"email": self.usuarios["admin"].email})
                self.assertEqual(resposta.status_code, 429)
                self.assertEqual(envio.call_count, 5)
                self.assertGreater(int(resposta.headers["Retry-After"]), 0)
                self.assertEqual(self.db.query(PasswordResetToken).count(), 5)

    def test_ac001_validacao_nao_reflete_credenciais(self):
        segredo = "senha-sintetica-nao-refletir-" + "x" * 90
        resposta = self.client.patch("/auth/senha", headers=self.jwt(), json={
            "senha_atual": SENHA_LEGADA, "nova_senha": segredo})
        self.assertIn(resposta.status_code, (400, 422))
        self.assertNotIn(segredo, resposta.text)
        resposta = self.client.post("/auth/redefinir-senha", json={
            "token": "token-sintetico-nao-refletir", "nova_senha": segredo, "purpose": "inexistente"})
        self.assertEqual(resposta.status_code, 422)
        self.assertNotIn(segredo, resposta.text)
        self.assertNotIn("token-sintetico-nao-refletir", resposta.text)

    def test_ac005_falha_email_informa_campo_e_preserva_convite(self):
        self.email.stop()
        with patch("app.services.email_service._send", return_value=False):
            resposta = self.client.post("/membros", headers=self.jwt(), json={
                "nome": "Convidado", "email": "falha@example.com", "telefone": "11987654321", "role": "membro"})
        self.assertEqual(resposta.status_code, 200, resposta.text)
        self.assertFalse(resposta.json()["email_convite_enviado"])
        usuario = self.db.query(Usuario).filter_by(email="falha@example.com").one()
        registro = self.db.query(PasswordResetToken).filter_by(user_id=usuario.id).one()
        self.assertEqual(registro.purpose, "invite")

    def test_ac001_setter_rejeita_sem_truncar_e_aceita_72_bytes(self):
        from app.services.password_token_service import consume_password_token
        from fastapi import HTTPException
        token, registro = self.token_reset()
        for senha in ("a" * 73, "\u00e1" * 37, "a" * 15 + "\x00"):
            with self.assertRaises(HTTPException):
                consume_password_token(self.db, token, senha)
            self.db.refresh(registro)
            self.assertIsNone(registro.used_at)
        senha = "\u00e1" * 36
        self.assertEqual(self.redefinir(token, senha=senha).status_code, 200)
        self.assertTrue(verify_password(senha, self.usuarios["admin"].senha_hash))
        self.assertFalse(verify_password("\u00e1" * 35 + "b", self.usuarios["admin"].senha_hash))

    def test_ac004_erro_hash_reverte_consumo_com_rollback(self):
        from app.services.password_token_service import consume_password_token
        token, registro = self.token_reset()
        version = self.usuarios["admin"].token_version
        with patch("app.services.password_token_service.hash_password", side_effect=RuntimeError("falha sintetica")):
            with self.assertRaises(RuntimeError):
                consume_password_token(self.db, token, SENHA_NOVA)
        self.db.rollback()
        self.db.refresh(registro)
        self.db.refresh(self.usuarios["admin"])
        self.assertIsNone(registro.used_at)
        self.assertEqual(self.usuarios["admin"].token_version, version)
        self.assertTrue(verify_password(SENHA_LEGADA, self.usuarios["admin"].senha_hash))
        self.assertEqual(self.redefinir(token).status_code, 200)

    def test_ac006_selecao_tenant_revalida_senha(self):
        outro = Usuario(terreiro_id=self.b.id, nome="Outro tenant", email=self.usuarios["admin"].email,
                        telefone="11987654321", senha_hash=hash_password(SENHA_NOVA), role="admin")
        self.db.add(outro)
        self.db.commit()
        resposta = self.login(terreiro=self.b.id)
        self.assertEqual(resposta.status_code, 401)
        self.assertNotIn("access_token", resposta.json())
        self.assertNotIn("terreiros", resposta.json())

    def test_ac003_multiplas_associacoes_resposta_generica(self):
        outro = Usuario(terreiro_id=self.b.id, nome="Outro tenant", email=self.usuarios["admin"].email,
                        telefone="11987654321", senha_hash=hash_password(SENHA_NOVA), role="admin")
        self.db.add(outro)
        self.db.commit()
        sessoes = sessionmaker(bind=self.engine, expire_on_commit=False)
        with patch("app.routers.password_reset_router.SessionLocal", sessoes):
            with patch("app.routers.password_reset_router._send", return_value=True) as envio:
                resposta = self.client.post("/auth/esqueci-senha/enviar", json={"email": outro.email})
                ausente = self.client.post("/auth/esqueci-senha/enviar", json={"email": "ausente@example.com"})
                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(resposta.json(), ausente.json())
                self.assertEqual(envio.call_count, 2)
        for valor in (str(self.a.id), str(self.b.id), self.a.nome, self.b.nome):
            self.assertNotIn(valor, resposta.text)


if __name__ == "__main__":
    unittest.main()
