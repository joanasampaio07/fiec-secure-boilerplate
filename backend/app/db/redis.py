import os
from redis.asyncio import Redis

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "TroqueEstaSenhaRedis2026!")

_redis_client = Redis(
    host="redis",
    port=6379,
    password=REDIS_PASSWORD,
    decode_responses=True,
)


async def get_redis() -> Redis:
    return _redis_client

