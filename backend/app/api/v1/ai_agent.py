import pybreaker
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.security import RoleChecker, sanitize_pii_lgpd
from app.core.resilience import (
    llm_circuit_breaker, count_tokens, check_and_consume_token_quota
)
from app.db.redis import get_redis
from app.api.v1.auth import FAKE_USERS_DB, log_audit

router = APIRouter(prefix="/ai", tags=["Agente IA & FinOps"])
student_or_admin = RoleChecker(["student", "admin"])


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=1500)


# Base de conhecimento local (RAG simulado - facilmente conectável ao MongoDB/pgvector)
KNOWLEDGE_BASE = {
    "matricula": "As matrículas nos cursos técnicos SENAI/SESI ocorrem pelo portal oficial mediante CPF e comprovante de escolaridade.",
    "certificado": "Os certificados digitais são emitidos automaticamente após 75% de frequência e nota mínima 7,0.",
    "suporte": "Em caso de bloqueio de acesso, utilize a opção 'Esqueci minha senha' na tela de login ou acione o suporte técnico."
}


@llm_circuit_breaker
async def call_llm_provider(sanitized_prompt: str, context: str) -> str:
    """
    Wrapper protegido pelo Circuit Breaker.
    Em produção, substitua o retorno mockado pela chamada httpx/OpenAI/Gemini API.
    """
    prompt_lower = sanitized_prompt.lower()
    if "ignore" in prompt_lower and ("instruções" in prompt_lower or "system" in prompt_lower):
        return "[GUARDRAIL BLOQUEADO] Solicitação fora do escopo educacional da plataforma."

    return (
        f"Com base nas diretrizes acadêmicas ({context}): "
        f"Sua dúvida sobre '{sanitized_prompt[:80]}...' foi processada com segurança e conformidade LGPD."
    )


@router.post("/chat")
async def chat_with_assistant(payload: ChatRequest, user_jwt: dict = Depends(student_or_admin)):
    email = user_jwt["sub"]
    user = FAKE_USERS_DB.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # 1. Sanitização LGPD antes de qualquer processamento ou contagem
    clean_prompt = sanitize_pii_lgpd(payload.prompt)
    tokens_in = count_tokens(clean_prompt)

    # 2. FinOps: Verifica e consome cota diária do aluno no Redis (com fallback resiliente)
    current_used = 0
    try:
        redis = await get_redis()
        await check_and_consume_token_quota(
            redis=redis,
            user_id=user["id"],
            tokens_needed=tokens_in + 150,  # Estimativa entrada + saída
            daily_limit=user["daily_token_limit"],
        )
        current_used = int(await redis.get(f"quota:tokens:{user['id']}") or 0)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[FINOPS WARNING] Redis indisponível: {exc}")
        current_used = tokens_in + 150

    # 3. Recuperação de contexto (RAG simples)
    context = next(
        (v for k, v in KNOWLEDGE_BASE.items() if k in clean_prompt.lower()),
        "Atendimento Acadêmico Geral SESI/SENAI"
    )

    # 4. Chamada protegida por Circuit Breaker
    try:
        answer = await call_llm_provider(clean_prompt, context)
    except pybreaker.CircuitBreakerError:
        await log_audit("AI_CIRCUIT_OPEN", email, "CRITICAL", "Circuit Breaker aberto na API LLM")
        raise HTTPException(
            status_code=503,
            detail="Serviço de IA temporariamente em contingência (Circuit Breaker ativo). Tente em 1 minuto."
        )

    return {
        "reply": answer,
        "finops": {
            "tokens_used_today": current_used,
            "daily_limit": user["daily_token_limit"],
            "remaining": max(0, user["daily_token_limit"] - current_used),
        },
    }

