import pytest
from httpx import AsyncClient
from app.main import app
from app.core.security import sanitize_pii_lgpd


def test_lgpd_pii_masking():
    raw = "Meu CPF é 123.456.789-00 e meu e-mail é joana@teste.com.br"
    masked = sanitize_pii_lgpd(raw)
    assert "123.456.789-00" not in masked
    assert "joana@teste.com.br" not in masked
    assert "[CPF_PROTEGIDO]" in masked


@pytest.mark.asyncio
async def test_rbac_blocks_unauthenticated_admin_access():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.get("/api/v1/admin/users")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_security_headers_present():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.get("/metrics")
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["X-Content-Type-Options"] == "nosniff"

