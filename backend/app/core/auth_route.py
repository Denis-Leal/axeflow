"""Protege a entrada dos endpoints que recebem senhas e tokens."""
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from app.core.auth_rate_limit import check_ip
from app.core.password_policy import PASSWORD_POLICY_MESSAGE


ROUTE_ACTIONS = {
    "login": "login",
    "register": "register",
    "alterar_senha": "password-change",
    "buscar_terreiros": "reset-search",
    "enviar_reset": "reset-request",
    "redefinir_senha": "password-token",
    "create_membro": "member-invite",
}


class SensitiveRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        action = ROUTE_ACTIONS.get(self.endpoint.__name__)

        async def sensitive_handler(request: Request):
            if action is not None:
                check_ip(request, action)
            try:
                return await handler(request)
            except RequestValidationError as error:
                details = []
                for item in error.errors():
                    location = item.get("loc", ())
                    message = "Entrada inválida. Confira o formato e os limites do campo."
                    if location and location[-1] in {"senha", "nova_senha"}:
                        message = PASSWORD_POLICY_MESSAGE
                    details.append({"loc": location, "type": item["type"], "msg": message})
                raise HTTPException(status_code=422, detail=details)

        return sensitive_handler
