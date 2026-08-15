from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.utils.datetime_utils import utcnow


# Contexto responsável por gerar e validar hashes de senha.
# bcrypt é utilizado para armazenar senhas de forma segura.
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# Dependency do FastAPI responsável por extrair o token
# do header Authorization: Bearer <token>.
security = HTTPBearer()


# Exceção padrão utilizada quando a autenticação falha.
# O status 401 informa que o cliente precisa se autenticar
# novamente ou enviar um token válido.
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token inválido ou expirado",
    headers={"WWW-Authenticate": "Bearer"},
)


def hash_password(password: str) -> str:
    """
    Gera o hash seguro de uma senha.

    A senha original nunca deve ser armazenada no banco.
    O resultado dessa função é o valor que deve ser persistido
    no campo de senha do usuário.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Verifica se uma senha em texto corresponde ao hash armazenado.

    Utilizada durante o login para validar as credenciais
    fornecidas pelo usuário.
    """
    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Cria um JWT de autenticação.

    `data` contém as informações que serão armazenadas no payload
    do token, normalmente incluindo o identificador do usuário
    através da claim `sub`.

    Se `expires_delta` não for informado, utiliza o tempo de
    expiração definido em ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    to_encode = data.copy()

    if expires_delta:
        expire = utcnow() + expires_delta
    else:
        expire = utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Adiciona a data de expiração ao payload.
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _decode_token(
    credentials: HTTPAuthorizationCredentials,
) -> str:
    """
    Valida e decodifica o JWT recebido no header Authorization.

    Retorna o identificador do usuário armazenado na claim `sub`.

    A função centraliza a validação do token para que
    get_current_user() e require_role() não precisem duplicar
    essa lógica.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        # `sub` (subject) identifica o usuário proprietário do token.
        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        return user_id

    except JWTError:
        # Inclui token expirado, assinatura inválida,
        # token malformado ou qualquer outra falha de validação JWT.
        raise credentials_exception


def _get_authenticated_user(
    user_id: str,
    db: Session,
):
    """
    Busca no banco o usuário correspondente ao ID presente no JWT.

    Além de verificar a existência do usuário, garante que ele
    esteja ativo.

    Essa consulta é importante porque o JWT pode continuar válido
    mesmo depois que um usuário seja desativado no banco.
    """
    from app.models.usuario import Usuario

    user = (
        db.query(Usuario)
        .filter(
            Usuario.id == user_id,
            Usuario.ativo.is_(True),
        )
        .first()
    )

    if user is None:
        raise credentials_exception

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Dependency que autentica o usuário da requisição.

    Fluxo:
        Header Authorization
            ↓
        validação do JWT
            ↓
        obtenção do user_id
            ↓
        consulta do usuário no banco
            ↓
        usuário autenticado
    """
    user_id = _decode_token(credentials)

    return _get_authenticated_user(
        user_id,
        db,
    )


def require_role(*roles: str):
    """
    Dependency factory para controle de autorização por role.

    Recebe uma ou mais roles permitidas e retorna uma dependency
    que pode ser utilizada em uma rota.

    O usuário precisa possuir pelo menos uma das roles informadas.

    Exemplo:

        user: Usuario = Depends(
            require_role("admin", "operador")
        )

    Nesse exemplo, usuários com role `admin` ou `operador`
    podem acessar a rota.
    """

    def checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
    ):
        # Primeiro autentica o usuário através do JWT.
        user_id = _decode_token(credentials)

        # Depois verifica se o usuário existe e está ativo.
        user = _get_authenticated_user(
            user_id,
            db,
        )

        # Autenticação foi bem-sucedida, mas o usuário também
        # precisa possuir uma das roles autorizadas para a rota.
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Acesso negado. Necessário: {', '.join(roles)}. "
                    f"Seu perfil: {user.role}"
                ),
            )

        return user

    return checker