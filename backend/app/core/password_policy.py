"""Política aplicada somente à definição de novas senhas."""
from typing import Annotated

from fastapi import HTTPException
from pydantic import AfterValidator


PASSWORD_POLICY_MESSAGE = "Use de 15 a 72 caracteres. Acentos e emojis ocupam mais espaço e reduzem esse limite. Caracteres nulos não são aceitos."


def validate_new_password(password: str) -> str:
    if len(password) < 15 or len(password.encode("utf-8")) > 72 or "\x00" in password:
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return password


NewPassword = Annotated[str, AfterValidator(validate_new_password)]


def require_new_password(password: str) -> str:
    """Protege também chamadas aos serviços que não passam pelos schemas HTTP."""
    try:
        return validate_new_password(password)
    except ValueError:
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)
