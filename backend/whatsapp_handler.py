"""
whatsapp_handler.py

Full-featured WhatsApp EDI Bot.
Flow: User uploads .edi -> Bot parses -> Lists errors -> User fixes or ignores -> Bot returns download link.
State is tracked in Supabase `whatsapp_sessions` table, keyed by phone number.
"""
import httpx
import os
import json
import hashlib
import tempfile
from fastapi import Request
from twilio.twiml.messaging_response import MessagingResponse

from core_parser.edi_parser import EDIParser
from core_parser.edi_generator import EDIGenerator

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
RAILWAY_URL = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")  # e.g. edifix-backend.up.railway.app

DB_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ─── State Constants ──────────────────────────────────────────────────────────
STATE_AWAITING_FIX_CHOICE = "AWAITING_FIX_CHOICE"
STATE_AWAITING_VALUE = "AWAITING_VALUE"


# ─── Supabase Helpers ─────────────────────────────────────────────────────────

async def get_session(phone: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers=DB_HEADERS,
            params={"phone_number": f"eq.{phone}", "select": "*"},
        )
    if resp.status_code == 200 and resp.json():
        return resp.json()[0]
    return None


async def save_session(phone: str, tree: dict, errors: list, state: str, pending_field: str | None = None, edi_string: str | None = None):
    data = {
        "phone_number": phone,
        "current_tree": json.dumps(tree),
        "last_errors": json.dumps(errors),
        "state": state,
        "pending_field": pending_field,
        "updated_at": "now()",
    }
    # Store generated EDI string temporarily for download
    if edi_string is not None:
        data["edi_output"] = edi_string
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers={**DB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=data,
        )


async def delete_session(phone: str):
    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers=DB_HEADERS,
            params={"phone_number": f"eq.{phone}"},
        )


# ─── Download Token Helpers ───────────────────────────────────────────────────

def make_download_token(phone: str) -> str:
    """Create a short, URL-safe token from the phone number."""
    return hashlib.sha256(phone.encode()).hexdigest()[:16]


def make_download_url(phone: str) -> str:
    """Build the full download URL for the fixed EDI file."""
    token = make_download_token(phone)
    base = RAILWAY_URL.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"
    return f"{base}/api/download/{token}"


# ─── Twilio Document Downloader ───────────────────────────────────────────────

async def download_twilio_document(message_sid: str) -> bytes | None:
    """
    Attempt to download document media from Twilio's REST API.
    Uses the MessageSid to fetch the media list, then downloads the first item.
    """
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return None

    auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    api_url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages/{message_sid}/Media.json"

    async with httpx.AsyncClient() as client:
        resp = await client.get(api_url, auth=auth)

    print(f"[WA] Twilio Media API status={resp.status_code} body={resp.text[:300]}")

    if resp.status_code != 200:
        return None

    data = resp.json()
    # Twilio returns either 'media_list' or nested in other keys
    media_list = data.get("media_list", [])
    if not media_list:
        return None

    media_sid = media_list[0]["sid"]
    media_url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages/{message_sid}/Media/{media_sid}"

    async with httpx.AsyncClient() as client:
        file_resp = await client.get(media_url, auth=auth, follow_redirects=True)

    return file_resp.content if file_resp.status_code == 200 else None


# ─── Error Formatter ─────────────────────────────────────────────────────────

def format_errors_for_chat(errors: list) -> str:
    if not errors:
        return "✅ No errors found!"

    lines = [f"⚠️ Found *{len(errors)} error(s)*:\n"]
    for i, err in enumerate(errors[:10], 1):
        segment = err.get("segment", "?")
        msg = err.get("message", "Unknown error")
        suggestion = err.get("suggestion", "")
        field = err.get("field", "")

        line = f"*{i}.* [{segment}] {msg}"
        if field:
            line += f" (Field: {field})"
        if suggestion:
            line += f"\n   💡 _{suggestion}_"
        lines.append(line)

    lines.append("\n\nReply with a *number* to fix that error, or *ignore* to skip all and download.")
    return "\n".join(lines)


def get_fixable_field(error: dict) -> dict | None:
    FIELD_MAP = {
        "NM109": {"label": "NPI / ID Number"},
        "NM103": {"label": "Organization / Provider Name"},
        "CLM01": {"label": "Claim ID"},
        "CLM02": {"label": "Claimed Amount ($)"},
        "DTP03": {"label": "Service Date (CCYYMMDD)"},
        "N301":  {"label": "Street Address"},
        "N401":  {"label": "City"},
        "N402":  {"label": "State"},
        "N403":  {"label": "ZIP Code"},
        "REF02": {"label": "Tax ID / Reference Number"},
    }
    return FIELD_MAP.get(error.get("field", ""))


def apply_patch_to_tree(tree: dict, error: dict, new_value: str) -> dict:
    segment_key = error.get("segment", "")
    field_key = error.get("field", "")
    if not segment_key or not field_key:
        return tree

    def patch_node(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == segment_key and isinstance(v, dict) and field_key in v:
                    v[field_key] = new_value
                else:
                    patch_node(v)
        elif isinstance(node, list):
            for item in node:
                patch_node(item)

    patch_node(tree)
    return tree


async def parse_edi_bytes(content: bytes, sender_phone: str) -> str:
    """Parse raw EDI bytes and save the session. Returns the reply string."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edi") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        parser = EDIParser(tmp_path)
        tree = parser.parse()
        errors = tree.get("errors", [])

        await save_session(sender_phone, tree, errors, STATE_AWAITING_FIX_CHOICE)

        if not errors:
            return "✅ *Perfect file!* No errors found.\n\nReply *download* to get your file."
        else:
            return format_errors_for_chat(errors)

    except Exception as e:
        print(f"[WA] Parse ERROR: {e}")
        return f"❌ Failed to parse: {str(e)}\nMake sure it's valid X12 EDI content."
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ─── Main Webhook Handler ─────────────────────────────────────────────────────

async def handle_whatsapp_webhook(request: Request) -> str:
    form_data = await request.form()
    incoming_msg = form_data.get("Body", "").strip()
    sender_phone = form_data.get("From", "")
    num_media = int(form_data.get("NumMedia", 0))
    media_url = form_data.get("MediaUrl0", "")
    message_type = form_data.get("MessageType", "text")
    message_sid = form_data.get("MessageSid", "")

    is_document = message_type == "document"
    has_media_url = num_media > 0 or bool(media_url)

    print(f"[WA] phone={sender_phone} type={message_type} sid={message_sid} NumMedia={num_media} MediaUrl={media_url!r}")

    response = MessagingResponse()

    # ── DEBUG: type "debug" to dump raw Twilio data ───────────────────────────
    if incoming_msg.lower() == "debug":
        all_keys = dict(form_data)
        debug_text = "\n".join([f"{k}: {v}" for k, v in list(all_keys.items())[:20]])
        response.message(f"🔍 Twilio data:\n{debug_text}")
        return str(response)

    # ── 1. PASTED EDI TEXT (starts with ISA*) ────────────────────────────────
    looks_like_edi = incoming_msg.upper().startswith("ISA*") or incoming_msg.upper().startswith("ISA~")
    if looks_like_edi:
        reply = await parse_edi_bytes(incoming_msg.encode("utf-8"), sender_phone)
        response.message(reply)
        return str(response)

    # ── 2. FILE UPLOADED ──────────────────────────────────────────────────────
    if has_media_url or is_document:
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID else None

        file_content = None

        # Case A: MediaUrl0 was provided (images, some files)
        if media_url and auth:
            async with httpx.AsyncClient() as client:
                r = await client.get(media_url, auth=auth, follow_redirects=True)
            if r.status_code == 200:
                file_content = r.content

        # Case B: Document type — fetch via Twilio REST API
        if not file_content and is_document and auth:
            file_content = await download_twilio_document(message_sid)

        if file_content:
            reply = await parse_edi_bytes(file_content, sender_phone)
        else:
            reply = (
                "⚠️ File received but I couldn't download it (Twilio Sandbox limitation).\n\n"
                "👉 *Easy workaround*:\n"
                "  1. Open the file in Notepad\n"
                "  2. Copy all the text\n"
                "  3. Paste it here\n\n"
                "EDI files start with *ISA* — paste that whole block!"
            )

        response.message(reply)
        return str(response)

    # ── Get session for any other text input ──────────────────────────────────
    session = await get_session(sender_phone)
    msg_lower = incoming_msg.lower().strip()

    # ── 3. NO SESSION — Greet ────────────────────────────────────────────────
    if not session:
        response.message(
            "👋 Welcome to *EdiFix Bot!* 🛠️\n\n"
            "Send me an EDI file or paste EDI text (starts with ISA*).\n\n"
            "I'll parse it, show errors in plain English, and help you fix them!"
        )
        return str(response)

    tree = json.loads(session["current_tree"])
    errors = json.loads(session["last_errors"])
    state = session["state"]
    pending_field = session.get("pending_field")

    # ── 4. DOWNLOAD ───────────────────────────────────────────────────────────
    if msg_lower in ("ignore", "ignore all", "ignore rest", "done", "download", "send", "finish"):
        try:
            generator = EDIGenerator(tree)
            edi_string = generator.generate()

            # Store generated EDI in session for the download endpoint to serve
            await save_session(sender_phone, tree, errors, state, edi_string=edi_string)

            remaining = len(errors)
            note = f"({remaining} error(s) skipped)" if remaining else "(no errors)"

            dl_url = make_download_url(sender_phone)
            response.message(
                f"✅ *Done!* {note}\n\n"
                f"📥 Download your fixed EDI file here:\n{dl_url}\n\n"
                "_Link expires in 2 hours. Send a new file to start again!_"
            )
        except Exception as e:
            response.message(f"❌ Could not generate file: {str(e)}")
        return str(response)

    # ── 5. USER SELECTED ERROR NUMBER ────────────────────────────────────────
    if state == STATE_AWAITING_FIX_CHOICE and msg_lower.isdigit():
        choice = int(msg_lower)
        if 1 <= choice <= len(errors):
            selected_error = errors[choice - 1]
            fixable = get_fixable_field(selected_error)

            await save_session(
                sender_phone, tree, errors,
                STATE_AWAITING_VALUE,
                pending_field=json.dumps({"error_index": choice - 1, **selected_error}),
            )

            if fixable:
                response.message(
                    f"📝 *Fixing error #{choice}*\n"
                    f"_{selected_error.get('message', '')}_\n\n"
                    f"Please type the correct *{fixable['label']}*:"
                )
            else:
                response.message(
                    f"⚠️ Error #{choice} ({selected_error.get('segment','?')}) can't be auto-fixed here.\n"
                    "Reply with another number, or *ignore* to download anyway."
                )
        else:
            response.message(f"Reply with a number between 1 and {len(errors)}, or *ignore*.")
        return str(response)

    # ── 6. USER PROVIDED FIX VALUE ────────────────────────────────────────────
    if state == STATE_AWAITING_VALUE and pending_field:
        try:
            pending = json.loads(pending_field) if isinstance(pending_field, str) else pending_field
            error_index = pending.get("error_index", 0)
            original_error = errors[error_index]

            patched_tree = apply_patch_to_tree(tree, original_error, incoming_msg.strip())
            remaining_errors = [e for i, e in enumerate(errors) if i != error_index]

            await save_session(sender_phone, patched_tree, remaining_errors, STATE_AWAITING_FIX_CHOICE)

            if remaining_errors:
                reply = (
                    f"✅ Fixed! Set to *{incoming_msg.strip()}*\n\n"
                    + format_errors_for_chat(remaining_errors)
                )
            else:
                reply = (
                    "🎉 *All errors fixed!*\n\n"
                    "Reply *download* to get your corrected EDI file."
                )
            response.message(reply)

        except Exception as e:
            response.message(f"❌ Something went wrong: {str(e)}")
        return str(response)

    # ── 7. CATCH-ALL ──────────────────────────────────────────────────────────
    if errors:
        response.message("Still waiting!\n\n" + format_errors_for_chat(errors))
    else:
        response.message("Reply *download* to get your file, or send a new EDI to start fresh.")

    return str(response)
