import pybreaker
import tiktoken
from fastapi import HTTPException, status
from redis.asyncio import Redis

# Circuit Breaker: abre por 60s após 3 falhas consecutivas na API da LLM
llm_circuit_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=60,
    name="LLM_Gateway_Breaker"
)


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))


async def check_and_consume_token_quota(
    redis: Redis, user_id: str, tokens_needed: int, daily_limit: int = 5000
):
    """Garante FinOps e evita abuso de recursos de IA por aluno."""
    key = f"quota:tokens:{user_id}"
    current = await redis.get(key)
    used = int(current) if current else 0

    if used + tokens_needed > daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Cota diária de tokens atingida ({used}/{daily_limit}). Contate o suporte."
        )

    pipe = redis.pipeline()
    pipe.incrby(key, tokens_needed)
    pipe.expire(key, 86400)  # Expira em 24h
    await pipe.execute()

