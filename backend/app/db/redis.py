import os
from redis.asyncio import Redis

REDIS_URL = os.getenv("REDIS_URL")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "TroqueEstaSenhaRedis2026!")

if REDIS_URL:
    _redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
else:
    _redis_client = Redis(
        host="redis",
        port=6379,
        password=REDIS_PASSWORD,
        decode_responses=True,
    )


async def get_redis() -> Redis:
    return _redis_client

