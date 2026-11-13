import re
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

SECRET_KEY = "CHANGE_ME_VIA_ENV_IN_PROD"
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, role: str, expires_minutes: int = 15) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def sanitize_pii_lgpd(text: str) -> str:
    """Mascara CPF, e-mail e telefone antes de enviar à LLM ou gravar logs (LGPD)."""
    text = re.sub(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF_PROTEGIDO]", text)
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[EMAIL_PROTEGIDO]", text)
    text = re.sub(r"\(?\d{2}\)?\s?\d{4,5}-?\d{4}", "[TEL_PROTEGIDO]", text)
    return text


class RoleChecker:
    """Dependência RBAC para proteger rotas administrativas."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, request: Request):
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("role") not in self.allowed_roles:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Privilégio insuficiente (RBAC)")
            return payload
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

