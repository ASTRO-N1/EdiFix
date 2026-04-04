from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
import os
import tempfile
import uvicorn
from groq import Groq
from core_parser.edi_parser import EDIParser
from core_parser.edi_generator import EDIGenerator
from auth import verify_api_key, generate_api_key, verify_supabase_session
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# ── Groq setup ────────────────────────────────────────────────────────────────
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Initialize the API
app = FastAPI(
    title="EdiFix API",
    description="Headless microservice for parsing and validating X12 837, 835, and 834 EDI files.",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    parseResult: dict | None = None
    transactionType: str | None = None


class GenerateRequest(BaseModel):
    """Request body for EDI generation endpoint."""
    tree: dict
    delimiters: dict | None = None


# ── AI Chat endpoint ──────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    system_prompt = """You are an expert EDI (Electronic Data Interchange) assistant.
Help the user understand their EDI file, explain segments and fields in simple terms, and identify any errors or issues.
Be concise, clear, and friendly."""

    user_message = f"""Transaction Type: {req.transactionType or 'Unknown'}

Parsed EDI Data:
{req.parseResult or 'No file parsed yet.'}

User Question: {req.message}"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1024,
        )
        reply = completion.choices[0].message.content
    except Exception as e:
        reply = f"⚠️ AI error: {str(e)}"

    return {"reply": reply}


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/")
def health_check():
    """Simple health check endpoint."""
    return {"status": "online", "message": "EdiFix Engine is ready.", "version": "1.0.0"}


# ── CORS preflight ────────────────────────────────────────────────────────────
@app.options("/api/v1/parse")
def options_parse_edi_file():
    return {}

@app.options("/api/v1/keys")
def options_keys():
    return {}

@app.options("/api/v1/generate")
def options_generate():
    return {}


# ── Parse endpoint (secured with API key) ─────────────────────────────────────
@app.post("/api/v1/parse")
async def parse_edi_file(
    file: UploadFile = File(...),
    api_caller: dict = Depends(verify_api_key),
):
    """
    Parses an EDI file and returns the JSON tree.
    Requires: Authorization: Bearer <api_key> header.
    """
    temp_fd, temp_path = tempfile.mkstemp(suffix=".edi")
    try:
        with os.fdopen(temp_fd, 'wb') as f:
            content = await file.read()
            f.write(content)

        parser = EDIParser(temp_path)
        final_tree = parser.parse()

        if not final_tree.get("metadata"):
            return {
                "status": "error",
                "message": "Failed to parse file. Is it a valid X12 format?",
                "errors": parser.errors,
            }

        return {
            "status": "success",
            "filename": file.filename,
            "data": final_tree,
            "called_by": api_caller.get("name", "unknown") if api_caller else "web-dashboard",
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Generate endpoint — Convert JSON tree back to EDI string ─────────────────
@app.post("/api/v1/generate", response_class=PlainTextResponse)
async def generate_edi_file(
    req: GenerateRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Generates an X12 EDI string from a JSON AST tree.
    
    Request Body:
        {
            "tree": { ... },
            "delimiters": { "element_sep": "*", "subelement_sep": ":", "segment_sep": "~" }
        }
    
    Returns: Plain text EDI string
    """
    try:
        tree = req.tree
        
        if not tree:
            raise HTTPException(status_code=400, detail="Missing 'tree' in request body.")
        
        if "envelope" not in tree:
            raise HTTPException(status_code=400, detail="Invalid tree structure: missing 'envelope' key.")
        
        generator = EDIGenerator(tree)
        
        if req.delimiters:
            generator.set_delimiters(
                element_sep=req.delimiters.get("element_sep"),
                subelement_sep=req.delimiters.get("subelement_sep"),
                segment_sep=req.delimiters.get("segment_sep"),
            )
        
        edi_string = generator.generate()
        return edi_string

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EDI generation failed: {str(e)}")


@app.post("/api/v1/generate/json")
async def generate_edi_file_json(
    req: GenerateRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Same as /api/v1/generate but returns JSON with metadata.
    """
    try:
        tree = req.tree
        
        if not tree:
            raise HTTPException(status_code=400, detail="Missing 'tree' in request body.")
        
        generator = EDIGenerator(tree)
        
        if req.delimiters:
            generator.set_delimiters(
                element_sep=req.delimiters.get("element_sep"),
                subelement_sep=req.delimiters.get("subelement_sep"),
                segment_sep=req.delimiters.get("segment_sep"),
            )
        
        edi_string = generator.generate()
        
        return {
            "status": "success",
            "edi_string": edi_string,
            "segment_count": generator._segment_count,
            "transaction_count": generator._transaction_count,
            "group_count": generator._group_count,
            "delimiters": generator.get_delimiters(),
            "called_by": api_caller.get("name", "unknown") if api_caller else "web-dashboard",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EDI generation failed: {str(e)}")


# ── API Key management endpoints ──────────────────────────────────────────────

@app.post("/api/v1/keys")
async def create_api_key(payload: dict = Body(...), verified_user_id: str = Depends(verify_supabase_session)):
    user_id = verified_user_id
    name = payload.get("name", "My API Key")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    raw_key, key_hash, key_prefix = generate_api_key()

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            headers=headers,
            json={
                "user_id": user_id,
                "name": name,
                "key_hash": key_hash,
                "key_prefix": key_prefix,
            },
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to store API key")

    created = resp.json()[0] if isinstance(resp.json(), list) else resp.json()

    return {
        "id": created["id"],
        "name": created["name"],
        "key": raw_key,
        "key_prefix": key_prefix,
        "created_at": created["created_at"],
    }


@app.get("/api/v1/keys")
async def list_api_keys(verified_user_id: str = Depends(verify_supabase_session)):
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            headers=headers,
            params={
                "user_id": f"eq.{verified_user_id}",
                "select": "id,name,key_prefix,created_at,last_used_at",
                "order": "created_at.desc",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch keys")

    return resp.json()


@app.delete("/api/v1/keys/{key_id}")
async def revoke_api_key(key_id: str, verified_user_id: str = Depends(verify_supabase_session)):
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            headers=headers,
            params={"id": f"eq.{key_id}", "user_id": f"eq.{verified_user_id}"},
        )

    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=500, detail="Failed to revoke key")

    return {"status": "revoked", "id": key_id}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)