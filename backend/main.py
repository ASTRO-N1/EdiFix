from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, Any
import os
import tempfile
import uvicorn
from groq import Groq
from core_parser.edi_parser import EDIParser
from core_parser.edi_generator import EDIGenerator
from core_parser.reconciliation import reconcile as run_reconciliation
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
    """
    Request body for EDI generation endpoint.
    
    Accepts either:
      1. {"tree": {...}}  - Direct tree structure
      2. {"data": {...}}  - Parse response format (tree nested in 'data')
    """
    tree: Optional[dict] = None
    data: Optional[dict] = None
    delimiters: Optional[dict] = None
    
    class Config:
        extra = "allow"  # Allow extra fields like "status", "filename", etc.


# ── AI Chat endpoint ──────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    system_prompt = """You are a specialized EDI Guide. You must provide high-brevity, non-technical support. 

### Core Response Rules:
1. **The "Short & Crisp" Mandate:** Maximum 2-3 sentences per point. If the user asks for "short," use 10 words or fewer per bullet.
2. **No Fluff Intro:** Do not start with "Nice to meet you" or "Let's start fresh." Answer the question immediately.
3. **Conversational Flow:** If the user asks a follow-up, answer ONLY that specific question. Do not reset and explain the basics again.
4. **Non-Technical Language:** No jargon. Use "Header" instead of "ISA," and "Sender ID" instead of "GS02."
5. **Anti-Hallucination:** Only explain what is in the file or standard EDI rules. If the user asks about something not present, say: "That is not in this file."

### Formatting Template (STRICT):
* **Direct Answer:** [One short sentence]
* **Quick Breakdown:**
    * [Bullet 1: Max 10 words]
    * [Bullet 2: Max 10 words]
* **Errors (Only if relevant):**
    * [Problem] -> [Fix]

### Examples of Correct vs. Incorrect:
* **User:** "What is an EDI file?"
* **Correct AI:** "It's a digital standard for businesses to swap documents like invoices."
* **Incorrect AI:** "Nice to meet you! Think of an EDI file like a recipe for a cake..." (This is too long and uses boring analogies)."""

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

@app.options("/api/v1/parse-835")
def options_parse_835():
    return {}

@app.options("/api/v1/reconcile")
def options_reconcile():
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


# ── Parse 835 Remittance endpoint ─────────────────────────────────────────
@app.post("/api/v1/parse-835")
async def parse_835_file(
    file: UploadFile = File(...),
    api_caller: dict = Depends(verify_api_key),
):
    """
    Parses an 835 Remittance EDI file and returns the JSON tree.
    Used by the Reconciliation Engine to load the remittance side.
    Requires: X-Internal-Bypass header (same as /api/v1/parse).
    """
    temp_fd, temp_path = tempfile.mkstemp(suffix=".edi")
    try:
        with os.fdopen(temp_fd, "wb") as f:
            content = await file.read()
            f.write(content)

        parser = EDIParser(temp_path)
        final_tree = parser.parse()

        if not final_tree.get("metadata"):
            return {
                "status": "error",
                "message": "Failed to parse 835 file. Is it a valid X12 format?",
                "errors": parser.errors,
            }

        tx_type = final_tree.get("metadata", {}).get("transaction_type", "")
        if tx_type and tx_type != "835":
            return {
                "status": "error",
                "message": f"Uploaded file appears to be an {tx_type} transaction, not an 835 Remittance file.",
            }

        return {
            "status": "success",
            "filename": file.filename,
            "file_type": "835",
            "data": final_tree,
            "remittance_summary": parser.build_remittance_summary(),
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Reconciliation endpoint ────────────────────────────────────────────────
class ReconcileRequest(BaseModel):
    parsed_837: dict
    parsed_835: dict


@app.post("/api/v1/reconcile")
async def reconcile_endpoint(
    req: ReconcileRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Runs the 835-to-837 reconciliation engine.
    Body: { "parsed_837": <parse response>, "parsed_835": <parse response> }
    Returns: ReconciliationReport JSON.
    """
    try:
        report = run_reconciliation(req.parsed_837, req.parsed_835)
        return {"status": "success", "report": report}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Helper to extract tree from various request formats ──────────────────────
def _extract_tree_from_body(body: dict) -> dict:
    """
    Extracts the EDI tree from request body, handling multiple formats:
    - {"tree": {...}}
    - {"data": {...}}
    - Direct tree with "envelope" at root
    """
    # Format 1: {"tree": {...}}
    if "tree" in body and body["tree"]:
        return body["tree"]
    
    # Format 2: {"data": {...}} (parse endpoint response)
    if "data" in body and body["data"]:
        return body["data"]
    
    # Format 3: Direct tree (has "envelope" at root level)
    if "envelope" in body:
        return body
    
    raise HTTPException(
        status_code=400,
        detail="Could not find EDI tree. Expected 'tree', 'data', or direct tree with 'envelope' key."
    )


# ══════════════════════════════════════════════════════════════════════════════
# DEBUG/TEST ENDPOINT - No authentication required
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/v1/generate/test")
async def generate_edi_test(request: Request):
    """
    TEST ENDPOINT - No auth required.
    Accepts raw JSON body and generates EDI.
    
    Use this for debugging. Send the full parse response or just the tree.
    """
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    try:
        tree = _extract_tree_from_body(body)
        
        if "envelope" not in tree:
            return {
                "status": "error",
                "detail": "Invalid tree structure: missing 'envelope' key.",
                "keys_found": list(tree.keys())[:10],
            }
        
        generator = EDIGenerator(tree)
        
        # Check for custom delimiters
        delimiters = body.get("delimiters")
        if delimiters:
            generator.set_delimiters(
                element_sep=delimiters.get("element_sep"),
                subelement_sep=delimiters.get("subelement_sep"),
                segment_sep=delimiters.get("segment_sep"),
            )
        
        edi_string = generator.generate()
        
        return {
            "status": "success",
            "edi_string": edi_string,
            "segment_count": generator._segment_count,
            "delimiters": generator.get_delimiters(),
        }

    except HTTPException:
        raise
    except Exception as e:
        return {
            "status": "error",
            "detail": f"Generation failed: {str(e)}",
            "error_type": type(e).__name__,
        }


# ── Generate endpoint — Convert JSON tree back to EDI string ─────────────────
@app.post("/api/v1/generate", response_class=PlainTextResponse)
async def generate_edi_file(
    request: Request,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Generates an X12 EDI string from a JSON AST tree.
    Returns: Plain text EDI string
    """
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    
    try:
        tree = _extract_tree_from_body(body)
        
        if "envelope" not in tree:
            raise HTTPException(
                status_code=400,
                detail="Invalid tree structure: missing 'envelope' key."
            )
        
        generator = EDIGenerator(tree)
        
        delimiters = body.get("delimiters")
        if delimiters:
            generator.set_delimiters(
                element_sep=delimiters.get("element_sep"),
                subelement_sep=delimiters.get("subelement_sep"),
                segment_sep=delimiters.get("segment_sep"),
            )
        
        edi_string = generator.generate()
        return edi_string

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EDI generation failed: {str(e)}")


@app.post("/api/v1/generate/json")
async def generate_edi_file_json(
    request: Request,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Same as /api/v1/generate but returns JSON with metadata.
    """
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    
    try:
        tree = _extract_tree_from_body(body)
        
        if "envelope" not in tree:
            raise HTTPException(
                status_code=400,
                detail="Invalid tree structure: missing 'envelope' key."
            )
        
        generator = EDIGenerator(tree)
        
        delimiters = body.get("delimiters")
        if delimiters:
            generator.set_delimiters(
                element_sep=delimiters.get("element_sep"),
                subelement_sep=delimiters.get("subelement_sep"),
                segment_sep=delimiters.get("segment_sep"),
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