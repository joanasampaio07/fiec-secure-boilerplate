import json
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.db.redis import get_redis
from app.api.v1 import auth, ai_agent, admin

app = FastAPI(title="FIEC Secure Full-Stack Boilerplate", version="1.0.0")

# 1. CORS Estrito (Nada de wildcard '*' em produção)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)


# 2. Security Headers (OWASP / NIST)
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# 3. Middleware de Idempotência (Evita duplicação de matrículas/transações)
@app.middleware("http")
async def idempotency_middleware(request: Request, call_next):
    if request.method in ("POST", "PATCH"):
        idem_key = request.headers.get("Idempotency-Key")
        if idem_key:
            redis = await get_redis()
            cache_key = f"idem:{request.url.path}:{idem_key}"
            cached = await redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return Response(
                    content=data["body"],
                    status_code=data["status"],
                    media_type="application/json",
                    headers={"X-Idempotent-Replay": "true"}
                )
    return await call_next(request)


# 4. Rotas da API v1
app.include_router(auth.router, prefix="/api/v1")
app.include_router(ai_agent.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

# 5. Métricas NOC para Prometheus/Grafana
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

