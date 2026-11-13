import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_USER = os.getenv("MONGO_USER", "fiec_audit")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "TroqueEstaSenhaMongo2026!")
MONGO_URI = os.getenv("MONGO_URI") or f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@mongo:27017"

_client = AsyncIOMotorClient(
    MONGO_URI,
    serverSelectionTimeoutMS=3000,
    connectTimeoutMS=3000,
)
_db = _client["fiec_audit_db"]


async def get_audit_collection():
    return _db["audit_logs"]

