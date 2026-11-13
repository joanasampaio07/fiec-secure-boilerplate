from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.security import RoleChecker, hash_password
from app.api.v1.auth import FAKE_USERS_DB, log_audit
from app.db.mongo import get_audit_collection

router = APIRouter(prefix="/admin", tags=["Painel Admin (NOC/SOC)"])
admin_only = RoleChecker(["admin"])


class UpdateQuotaRequest(BaseModel):
    daily_token_limit: int = Field(..., ge=0, le=500000)


class AdminResetPasswordRequest(BaseModel):
    temp_password: str = Field(..., min_length=8)


@router.get("/users")
async def list_users(_: dict = Depends(admin_only)):
    return [
        {k: v for k, v in u.items() if k != "password_hash"}
        for u in FAKE_USERS_DB.values()
    ]


@router.patch("/users/{email}/quota")
async def update_user_quota(email: str, payload: UpdateQuotaRequest, admin: dict = Depends(admin_only)):
    user = FAKE_USERS_DB.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    user["daily_token_limit"] = payload.daily_token_limit
    await log_audit("ADMIN_QUOTA_UPDATE", admin["sub"], "INFO", f"Alvo: {email} -> {payload.daily_token_limit}")
    return {"message": f"Cota de {email} atualizada para {payload.daily_token_limit} tokens."}


@router.patch("/users/{email}/reset-password")
async def admin_force_password_reset(email: str, payload: AdminResetPasswordRequest, admin: dict = Depends(admin_only)):
    user = FAKE_USERS_DB.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    user["password_hash"] = hash_password(payload.temp_password)
    user["is_verified"] = True
    await log_audit("ADMIN_PASSWORD_OVERRIDE", admin["sub"], "WARNING", f"Senha redefinida para {email}")
    return {"message": f"Senha provisória definida e conta ativada para {email}."}


@router.delete("/users/{email}")
async def delete_user(email: str, admin: dict = Depends(admin_only)):
    if email == admin["sub"]:
        raise HTTPException(status_code=400, detail="Não é permitido excluir o próprio usuário admin.")
    if email not in FAKE_USERS_DB:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    del FAKE_USERS_DB[email]
    await log_audit("ADMIN_USER_DELETED", admin["sub"], "WARNING", f"Excluído: {email}")
    return {"message": f"Usuário {email} removido com sucesso."}


@router.get("/audit-logs")
async def get_audit_logs(_: dict = Depends(admin_only)):
    audit = await get_audit_collection()
    cursor = audit.find({}, {"_id": 0}).sort("timestamp", -1).limit(50)
    return await cursor.to_list(length=50)

