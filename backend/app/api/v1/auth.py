import os
import secrets
from datetime import datetime, timezone
from email.message import EmailMessage
import aiosmtplib
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from jose import jwt, JWTError
from app.core.security import (
    hash_password, verify_password, create_access_token,
    sanitize_pii_lgpd, RoleChecker, SECRET_KEY, ALGORITHM
)
from app.db.mongo import get_audit_collection

router = APIRouter(prefix="/auth", tags=["Autenticação & IAM"])

# Simulação de repositório PostgreSQL (substituir pela session SQLAlchemy Async)
FAKE_USERS_DB = {
    "admin@fiec.org.br": {
        "id": "usr_admin_01",
        "name": "Joana Paula (CISO/Admin)",
        "email": "admin@fiec.org.br",
        "password_hash": hash_password("Admin@Fiec2026!"),
        "role": "admin",
        "is_verified": True,
        "daily_token_limit": 50000,
    }
}


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=64)


async def send_local_email(to_email: str, subject: str, body: str):
    """Envia e-mail via SMTP configurável (Mailpit local ou provedor em produção)."""
    smtp_host = os.getenv("SMTP_HOST", "mailpit")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "noreply@fiec-portal.local")
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user or None,
            password=smtp_pass or None,
            start_tls=bool(smtp_user),
        )
    except Exception:
        pass  # Evita falha caso o servidor SMTP ainda esteja subindo


async def log_audit(action: str, actor: str, status_msg: str, details: str = ""):
    try:
        audit = await get_audit_collection()
        await audit.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "actor": sanitize_pii_lgpd(actor),
            "status": status_msg,
            "details": sanitize_pii_lgpd(details),
        })
    except Exception as exc:
        print(f"[AUDIT WARNING] Falha ao gravar log no MongoDB: {exc}")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_student(payload: RegisterRequest):
    if payload.email in FAKE_USERS_DB:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    temp_password = f"Fiec@{secrets.token_hex(4).upper()}"
    user_id = f"usr_{len(FAKE_USERS_DB) + 1:03d}"
    FAKE_USERS_DB[payload.email] = {
        "id": user_id,
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(temp_password),
        "role": "student",
        "is_verified": True,
        "must_change_password": True,
        "daily_token_limit": 5000,
    }

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    await send_local_email(
        payload.email,
        "Bem-vindo ao Portal Acadêmico FIEC - Seus dados de acesso",
        (
            f"Olá {payload.name},\n\n"
            f"Seu cadastro no Portal Acadêmico FIEC foi criado com sucesso!\n\n"
            f"Acesse: {frontend_url}\n"
            f"E-mail: {payload.email}\n"
            f"Senha provisória: {temp_password}\n\n"
            f"Por segurança, no seu primeiro acesso o sistema solicitará a troca desta senha."
        ),
    )
    await log_audit("USER_REGISTER", payload.email, "SUCCESS", "Senha provisória enviada por e-mail")
    return {
        "message": "Cadastro realizado! Enviamos sua senha provisória para o seu e-mail."
    }


@router.get("/verify-email")
async def verify_email(token: str):
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = data.get("sub")
        user = FAKE_USERS_DB.get(email)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        user["is_verified"] = True
        await log_audit("EMAIL_VERIFIED", email, "SUCCESS")
        return {"message": "E-mail confirmado com sucesso! Você já pode fazer login."}
    except JWTError:
        raise HTTPException(status_code=400, detail="Link de verificação inválido ou expirado.")


@router.post("/login")
async def login(payload: LoginRequest, response: Response):
    user = FAKE_USERS_DB.get(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        await log_audit("LOGIN_FAILED", payload.email, "ALERT", "Credenciais inválidas")
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    if not user["is_verified"]:
        raise HTTPException(status_code=403, detail="Conta pendente de confirmação por e-mail.")

    token = create_access_token(subject=user["email"], role=user["role"], expires_minutes=60)
    cookie_secure = os.getenv("ENVIRONMENT", "development") == "production"
    # Cookie HttpOnly protege contra roubo de sessão via XSS
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="none" if cookie_secure else "strict",
        secure=cookie_secure,
        max_age=3600,
    )
    await log_audit("LOGIN_SUCCESS", user["email"], "SUCCESS", f"Role: {user['role']}")
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "must_change_password": user.get("must_change_password", False),
        "access_token": token,
    }


@router.post("/change-password")
async def change_password_first_access(
    payload: ChangePasswordRequest,
    user_jwt: dict = Depends(RoleChecker(["student", "admin"])),
):
    email = user_jwt["sub"]
    user = FAKE_USERS_DB.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user["password_hash"] = hash_password(payload.new_password)
    user["must_change_password"] = False
    await log_audit("FIRST_LOGIN_PASSWORD_CHANGED", email, "SUCCESS")
    return {"message": "Senha definitiva cadastrada com sucesso!"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    user = FAKE_USERS_DB.get(payload.email)
    if user:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
        reset_token = create_access_token(subject=payload.email, role="reset", expires_minutes=15)
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        await send_local_email(
            payload.email,
            "Recuperação de Senha - Portal FIEC",
            f"Use o link abaixo (válido por 15 min) para redefinir sua senha:\n{reset_link}"
        )
        await log_audit("PASSWORD_RESET_REQUESTED", payload.email, "INFO")
    # Resposta genérica evita enumeração de usuários (OWASP)
    return {"message": "Se o e-mail estiver cadastrado, enviamos um link de recuperação."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    try:
        data = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("role") != "reset":
            raise HTTPException(status_code=400, detail="Token inválido para redefinição.")
        email = data.get("sub")
        user = FAKE_USERS_DB.get(email)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        user["password_hash"] = hash_password(payload.new_password)
        await log_audit("PASSWORD_RESET_COMPLETED", email, "SUCCESS")
        return {"message": "Senha atualizada com sucesso!"}
    except JWTError:
        raise HTTPException(status_code=400, detail="Token expirado ou inválido.")

