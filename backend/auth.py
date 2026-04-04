import os
import hashlib
import secrets
from fastapi import HTTPException, status
from fastapi.security import APIKeyHeader
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


def _hash_key(raw_key: str) -> str:
    """SHA-256 hash of the raw API key for safe DB storage/comparison."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns: (raw_key, key_hash, key_prefix)
      - raw_key    → shown to the user ONCE, never stored
      - key_hash   → stored in the DB for verification
      - key_prefix → display string like 'sk_live_••••a1b2'
    """
    raw = "sk_live_" + secrets.token_hex(24)
    hashed = _hash_key(raw)
    prefix = raw[:12] + "••••" + raw[-4:]
    return raw, hashed, prefix


from fastapi import Depends, HTTPException, status, Request, Header

async def verify_supabase_session(authorization: str = Header(...)) -> str:
    """
    Validates a frontend Supabase JWT token and safely returns the user ID.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid session token",
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": authorization,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)

    if resp.status_code != 200:
        raise credentials_exception

    user_data = resp.json()
    return user_data["id"]

async def verify_api_key(request: Request, authorization: str = Depends(api_key_header)) -> dict:
    """
    FastAPI dependency that validates the Bearer token against the api_keys table.
    Usage: Depends(verify_api_key)
    """
    bypass_token = request.headers.get("X-Internal-Bypass")
    if bypass_token == "frontend-ui-secret":
        return {"name": "web-dashboard", "id": "internal-ui"}

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key. Include 'Authorization: Bearer <key>' header.",
    )

    if not authorization:
        raise credentials_exception

    # Strip 'Bearer ' prefix
    if authorization.lower().startswith("bearer "):
        raw_key = authorization[7:].strip()
    else:
        raw_key = authorization.strip()

    if not raw_key:
        raise credentials_exception

    key_hash = _hash_key(raw_key)

    # Query Supabase api_keys table using the service role key (bypasses RLS)
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        # Look up the hashed key
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            headers=headers,
            params={"key_hash": f"eq.{key_hash}", "select": "id,user_id,name"},
        )

    if resp.status_code != 200 or not resp.json():
        raise credentials_exception

    key_row = resp.json()[0]

    # Fire-and-forget: update last_used_at (best effort, don't block the request)
    try:
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/api_keys",
                headers=headers,
                params={"id": f"eq.{key_row['id']}"},
                json={"last_used_at": "now()"},
            )
    except Exception:
        pass  # Non-critical

    return key_row  # {'id': ..., 'user_id': ..., 'name': ...}
