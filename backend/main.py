from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, Any, List
import os
import json
import tempfile
import uvicorn
from groq import Groq
from core_parser.edi_parser import EDIParser
from core_parser.edi_generator import EDIGenerator
from core_parser.reconciliation import reconcile as run_reconciliation
from auth import verify_api_key, generate_api_key, verify_supabase_session
import httpx
from dotenv import load_dotenv
from core_parser.eligibility_scrubber import run_eligibility_scrubber
from core_parser.fix_assistant import analyze_and_suggest_fixes, apply_fix_to_tree

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


class FixErrorsRequest(BaseModel):
    errors: list
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


class SuggestFixesRequest(BaseModel):
    parse_result: dict


class ApplyFixRequest(BaseModel):
    parse_result: dict
    suggestion: dict


# ── AI Chat endpoint ──────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    system_prompt = """You are a specialized EDI Guide. You must provide high-brevity, non-technical support.

### Core Response Rules:
1. **The "Short & Crisp" Mandate:** Maximum 2-3 sentences per point.
2. **No Fluff Intro:** Answer the question immediately.
3. **Conversational Flow:** Answer ONLY the specific question asked.
4. **Non-Technical Language:** Use "Header" instead of "ISA", "Sender ID" instead of "GS02".
5. **Anti-Hallucination:** Only explain what is in the file or standard EDI rules.

### Formatting Template (STRICT):
* **Direct Answer:** [One short sentence]
* **Quick Breakdown:**
    * [Bullet 1: Max 10 words]
    * [Bullet 2: Max 10 words]
* **Errors (Only if relevant):**
    * [Problem] -> [Fix]"""

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


# ── AI Fix-Errors endpoint ────────────────────────────────────────────────────
@app.options("/ai/fix-errors")
def options_fix_errors():
    return {}


@app.post("/ai/fix-errors")
async def fix_errors_endpoint(req: FixErrorsRequest):
    """
    Returns structured JSON patches for fixable EDI errors.
    Maps each fixable error to a specific form field.
    """
    FIELD_MAP = """
fieldId          | loopKey    | segmentKey | fieldKey
submitter-name   | 1000A      | NM1        | NM103
submitter-id     | 1000A      | NM1        | NM109
receiver-name    | 1000B      | NM1        | NM103
receiver-id      | 1000B      | NM1        | NM109
billing-name     | 2010AA     | NM1        | NM103
billing-npi      | 2010AA     | NM1        | NM109
billing-address  | 2010AA     | N3         | N301
billing-taxid    | 2010AA     | REF        | REF02
billing-city     | 2010AA     | N4         | N401
billing-state    | 2010AA     | N4         | N402
billing-zip      | 2010AA     | N4         | N403
sub-member-id    | 2010BA     | NM1        | NM109
sub-last-name    | 2010BA     | NM1        | NM103
sub-first-name   | 2010BA     | NM1        | NM104
sub-dob          | 2010BA     | DMG        | DMG02
sub-gender       | 2010BA     | DMG        | DMG03
clm-id           | 2300       | CLM        | CLM01
clm-amount       | 2300       | CLM        | CLM02
clm-service-date | 2300       | DTP        | DTP03
dx-code-1        | 2300       | HI         | HI01_2
svc-proc         | 2400       | SV1        | SV101
svc-amount       | 2400       | SV1        | SV102
payer-name       | 835_1000A  | N1         | N102
payer-id         | 835_1000A  | N1         | N104
payee-name       | 835_1000B  | N1         | N102
payee-id         | 835_1000B  | N1         | N104
bpr-amount       | 835_HEADER | BPR        | BPR02"""

    system_prompt = f"""You are an EDI field correction engine. Output ONLY valid JSON — no markdown, no code fences, nothing else.

FIELD MAPPING (use these exact values):
{FIELD_MAP}

Rules:
- Amount mismatch: canAutoFix=true, calculate correct newValue from parsed data
- Date format errors: canAutoFix=true if you can derive correct CCYYMMDD
- NPI Luhn failures: canAutoFix=false, newValue=null
- Invalid codes needing external lookup: canAutoFix=false, newValue=null
- Missing segments: SKIP
- Only include errors matching a fieldId above

Output ONLY this JSON:
{{"fixes":[{{"fieldId":"<id>","label":"<label>","loopKey":"<loop>","segmentKey":"<seg>","fieldKey":"<fk>","oldValue":"<current>","newValue":"<fixed or null>","reason":"<one sentence>","canAutoFix":<true|false>}}]}}"""

    errors_text = "\n".join([
        f"- Segment={e.get('segment','?')} Field={e.get('field','')} Loop={e.get('loop','')} | {e.get('message','')} | Suggestion: {e.get('suggestion','')}"
        for e in req.errors[:15]
    ])
    parsed_ctx = ""
    if req.parseResult:
        try:
            parsed_ctx = json.dumps(req.parseResult)[:3000]
        except Exception:
            parsed_ctx = str(req.parseResult)[:3000]

    user_msg = f"""Transaction: {req.transactionType or 'Unknown'}
Errors:\n{errors_text}
Data:\n{parsed_ctx}
Output JSON:"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=2048,
            temperature=0.05,
        )
        raw = completion.choices[0].message.content.strip()
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip().lstrip("json").strip()
                try:
                    return json.loads(part)
                except Exception:
                    continue
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"fixes": [], "error": "AI returned non-JSON. Try again."}
    except Exception as e:
        return {"fixes": [], "error": str(e)}


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

@app.options("/api/reconcile/834")
def options_reconcile_834():
    return {}

@app.options("/api/reconcile/834/json")
def options_reconcile_834_json():
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


# ── 834 Change Report — multipart file upload ─────────────────────────────────
@app.post("/api/reconcile/834")
async def reconcile_834_endpoint(
    files: List[UploadFile] = File(...),
    api_caller: dict = Depends(verify_api_key),
):
    """
    834 Benefit Enrollment Change Report — multipart upload.
    Accepts 2+ raw 834 EDI files, parses each, auto-detects chronological
    order, and compares the oldest vs newest file.
    """
    from core_parser.reconciler_834 import reconcile_834

    if len(files) < 2:
        return {"status": "error", "message": "At least 2 834 files are required for the change report."}

    parsed_files = []
    temp_paths: list[str] = []

    try:
        for upload_file in files:
            temp_fd, temp_path = tempfile.mkstemp(suffix=".edi")
            temp_paths.append(temp_path)
            with os.fdopen(temp_fd, "wb") as f:
                content = await upload_file.read()
                f.write(content)

            parser = EDIParser(temp_path)
            tree = parser.parse()

            if not tree.get("metadata"):
                return {
                    "status": "error",
                    "message": f"Failed to parse '{upload_file.filename}'. Is it a valid X12 EDI file?",
                }

            tx_type = tree.get("metadata", {}).get("transaction_type", "")
            if tx_type and tx_type != "834":
                return {
                    "status": "error",
                    "message": f"File '{upload_file.filename}' appears to be an {tx_type} transaction, not an 834.",
                }

            parsed_files.append({"filename": upload_file.filename, "data": tree})

        # Compare oldest vs newest (reconcile_834 auto-sorts internally)
        report = reconcile_834(parsed_files[0], parsed_files[-1])
        return {"status": "success", "report": report}

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        for p in temp_paths:
            if os.path.exists(p):
                os.remove(p)



# ── 834 Change Report — JSON AST shortcut ─────────────────────────────────────
# Client posts pre-parsed ASTs (already fetched via /api/v1/parse) so we
# don't need a second round-trip file upload.
class Reconcile834JsonRequest(BaseModel):
    files: List[dict]  # List of parse-response dicts from /api/v1/parse


@app.post("/api/reconcile/834/json")
async def reconcile_834_json_endpoint(
    req: Reconcile834JsonRequest,
    api_caller: dict = Depends(verify_api_key),
):
    from core_parser.reconciler_834 import reconcile_834

    if len(req.files) < 2:
        return {"status": "error", "message": "At least 2 parsed 834 ASTs are required."}

    try:
        # Debug logging to see exactly what frontend passes
        print("======== DEBUG RECONCILE 834 ========")
        for i, f in enumerate(req.files):
            print(f"File {i} keys: {f.keys()}")
            data = f.get("data", {})
            print(f"File {i} data keys: {data.keys()}")
            loops = data.get("loops") if isinstance(data, dict) else {}
            if isinstance(loops, dict):
                print(f"File {i} loops keys: {loops.keys()}")
            else:
                print(f"File {i} loops: not a dict, type={type(loops)}")
        print("=====================================")

        report = reconcile_834(req.files[0], req.files[-1])
        return {"status": "success", "report": report}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class EligibilityScrubberRequest(BaseModel):
    parsed_834_files: List[dict]
    parsed_837: dict


@app.options("/api/eligibility/scrub")
def options_eligibility_srub():
    return {}


@app.post("/api/eligibility/scrub")
async def eligibility_scrubber_endpoint(
    req: EligibilityScrubberRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Eligibility Scrubber — validate 837 claims against 834 roster.
    
    Body:
      {
        "parsed_834_files": [<parse response>, <parse response>, ...],
        "parsed_837": <parse response>
      }
      
    Returns: Eligibility report with flagged claims.
    """
    try:
        if len(req.parsed_834_files) == 0:
            return {"status": "error", "message": "At least one 834 file is required."}
        
        report = run_eligibility_scrubber(req.parsed_834_files, req.parsed_837)
        return {"status": "success", "report": report}
    except Exception as e:
        import traceback
        print("Eligibility scrubber error:", traceback.format_exc())
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


# ── Fix Assistant Endpoints ────────────────────────────────────────────────

@app.options("/api/v1/suggest-fixes")
def options_suggest_fixes():
    return {}


@app.post("/api/v1/suggest-fixes")
async def suggest_fixes_endpoint(
    req: SuggestFixesRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Analyzes validation errors and returns deterministic fix suggestions.
    """
    try:
        print("[suggest-fixes] Received request")
        print(f"[suggest-fixes] Parse result has {len(req.parse_result.get('errors', []))} errors")
        
        suggestions = analyze_and_suggest_fixes(req.parse_result)
        
        print(f"[suggest-fixes] Generated {len(suggestions)} suggestions")
        for s in suggestions:
            print(f"  - {s['fix_type']}: {s['current_value']} → {s['suggested_value']}")
        
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        import traceback
        print("[suggest-fixes] ERROR:", traceback.format_exc())
        return {"status": "error", "message": str(e)}


@app.options("/api/v1/apply-fix")
def options_apply_fix():
    return {}


@app.post("/api/v1/apply-fix")
async def apply_fix_endpoint(
    req: ApplyFixRequest,
    api_caller: dict = Depends(verify_api_key),
):
    """
    Applies a single fix suggestion and re-validates.
    """
    try:
        print("[apply-fix] Applying fix:", req.suggestion.get('fix_type'))
        
        updated = apply_fix_to_tree(req.parse_result, req.suggestion)
        
        print("[apply-fix] Fix applied successfully")
        
        return {
            "status": "success",
            "updated_parse_result": updated,
        }
    except Exception as e:
        import traceback
        print("[apply-fix] ERROR:", traceback.format_exc())
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run the EdiFix API server.")
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host address to bind the server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port number to run the server on (default: 8000)",
    )
    args = parser.parse_args()

    import ssl
    
    # Self-signed certs for development
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile="cert.pem", keyfile="key.pem")
    
    # For debugging: disable hostname checking (not recommended for production)
    #context.check_hostname = False
    
    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        log_level="info",
        ssl=context,
    )