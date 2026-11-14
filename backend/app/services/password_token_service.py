"""Emissão e consumo transacional dos links de recuperação e convite."""
import hashlib
import secrets
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.password_policy import require_new_password
from app.core.security import hash_password
from app.models.password_reset_token import PasswordResetToken
from app.models.usuario import Usuario
from app.utils.datetime_utils import utcnow


TOKEN_EXPIRA_HORAS = 1
TOKEN_PURPOSES = {"reset", "invite"}
INVALID_TOKEN_MESSAGE = "Link inválido ou expirado. Solicite um novo."


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _gerar_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw)


def invalidate_user_tokens(db: Session, user_id) -> None:
    # O chamador mantém o lock do usuário, sempre antes de alterar seus tokens.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": utcnow().replace(tzinfo=None)}, synchronize_session=False)


def issue_password_token(db: Session, user: Usuario, purpose: str) -> str:
    """Emite um link na transação do chamador, com o usuário já bloqueado."""
    if purpose not in TOKEN_PURPOSES:
        raise ValueError("Finalidade de token inválida")
    invalidate_user_tokens(db, user.id)
    raw, token_hash = _gerar_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        terreiro_id=user.terreiro_id,
        token_hash=token_hash,
        purpose=purpose,
        expires_at=(utcnow() + timedelta(hours=TOKEN_EXPIRA_HORAS)).replace(tzinfo=None),
    ))
    return raw


def consume_password_token(db: Session, raw: str, new_password: str, purpose: str = "reset") -> Usuario:
    require_new_password(new_password)
    if purpose not in TOKEN_PURPOSES:
        raise HTTPException(status_code=400, detail=INVALID_TOKEN_MESSAGE)
    token_hash = _hash_token(raw)
    token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if token is None:
        raise HTTPException(status_code=400, detail=INVALID_TOKEN_MESSAGE)

    # A mesma ordem de locks serializa emissão, consumo e alteração autenticada.
    user = db.query(Usuario).filter(
        Usuario.id == token.user_id,
        Usuario.terreiro_id == token.terreiro_id,
        Usuario.ativo.is_(True),
    ).populate_existing().with_for_update().first()
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_TOKEN_MESSAGE)

    now = utcnow().replace(tzinfo=None)
    consumed = db.execute(update(PasswordResetToken).where(
        PasswordResetToken.id == token.id,
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.terreiro_id == user.terreiro_id,
        PasswordResetToken.purpose == purpose,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    ).values(used_at=now), execution_options={"synchronize_session": False})
    if consumed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=400, detail=INVALID_TOKEN_MESSAGE)

    db.execute(update(Usuario).where(Usuario.id == user.id).values(
        senha_hash=hash_password(new_password),
        token_version=Usuario.token_version + 1,
    ), execution_options={"synchronize_session": False})
    invalidate_user_tokens(db, user.id)
    db.commit()
    db.refresh(user)
    return user
