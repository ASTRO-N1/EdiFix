"""
whatsapp_handler.py

Full-featured WhatsApp EDI Bot.
Fix strategy: Store raw EDI text, apply fixes via regex on the raw segments (reliable),
then re-parse to get the updated tree and errors list.
"""
import httpx
import os
import json
import re
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
RAILWAY_URL = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")

DB_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

STATE_AWAITING_FIX_CHOICE = "AWAITING_FIX_CHOICE"
STATE_AWAITING_VALUE = "AWAITING_VALUE"

# ─── Loop → (segment, qualifier) map for targeted element replacement ─────────
LOOP_QUALIFIER_MAP = {
    "1000A":  ("NM1", "41"),
    "1000B":  ("NM1", "40"),
    "2010AA": ("NM1", "85"),
    "2010BA": ("NM1", "IL"),
    "2010BB": ("NM1", "PR"),
    "2310B":  ("NM1", "72"),
    "2420A":  ("NM1", "82"),
}


# ─── Supabase helpers ─────────────────────────────────────────────────────────

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


async def save_session(
    phone: str,
    tree: dict,
    errors: list,
    state: str,
    pending_field: str | None = None,
    raw_edi: str | None = None,
    edi_output: str | None = None,
):
    data = {
        "phone_number": phone,
        "current_tree": json.dumps(tree),
        "last_errors": json.dumps(errors),
        "state": state,
        "pending_field": pending_field,
        "updated_at": "now()",
    }
    if raw_edi is not None:
        data["raw_edi"] = raw_edi
    if edi_output is not None:
        data["edi_output"] = edi_output

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


# ─── Download helpers ─────────────────────────────────────────────────────────

def make_download_token(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()[:16]


def make_download_url(phone: str) -> str:
    token = make_download_token(phone)
    base = RAILWAY_URL.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"
    return f"{base}/api/download/{token}"


# ─── Raw EDI fix engine ───────────────────────────────────────────────────────

def _element_index(segment: str, field: str) -> int:
    """NM109 -> 9, CLM01 -> 1, DTP03 -> 3"""
    try:
        return int(field[len(segment):])
    except (ValueError, TypeError, IndexError):
        return -1


def fix_in_raw_edi(raw_edi: str, error: dict, new_value: str) -> str:
    """
    Apply a single field correction directly to the raw EDI string using regex.
    Much more reliable than tree patching since it doesn't depend on the parser's
    internal JSON structure.
    """
    segment = error.get("segment", "")
    field = error.get("field", "")
    loop = error.get("loop", "")

    if not segment or not field:
        print(f"[PATCH] Skipped — no segment or field in error: {error}")
        return raw_edi

    idx = _element_index(segment, field)
    if idx < 1:
        print(f"[PATCH] Could not parse element index from field={field!r}")
        return raw_edi

    # Determine if we can target by qualifier (e.g., NM1*85 for billing provider)
    qualifier = None
    if loop in LOOP_QUALIFIER_MAP:
        mapped_seg, mapped_qual = LOOP_QUALIFIER_MAP[loop]
        if mapped_seg == segment:
            qualifier = mapped_qual

    # Build regex pattern
    # Elements are separated by * and segments end with ~
    ELEM = r'[^*~]*'  # matches one element value

    if qualifier:
        # e.g. NM1*85 then 7 more elements then *NPI_value
        n_between = idx - 2  # elements between qualifier and target
        if n_between >= 0:
            pattern = rf'({re.escape(segment)}\*{re.escape(qualifier)}(?:\*{ELEM}){{{n_between}}}\*){ELEM}'
        else:
            # target IS the qualifier (shouldn't happen for NPI but safety)
            pattern = rf'({re.escape(segment)}\*){ELEM}'
    else:
        # Less targeted — count from segment start
        n_before = idx - 1
        pattern = rf'({re.escape(segment)}(?:\*{ELEM}){{{n_before}}}\*){ELEM}'

    def replacer(m):
        return m.group(1) + new_value

    result, count = re.subn(pattern, replacer, raw_edi, count=1)
    if count:
        print(f"[PATCH] ✅ {segment}.{field} (loop={loop}) → {new_value!r}")
    else:
        print(f"[PATCH] ❌ No match found for {segment}.{field} (loop={loop}, qualifier={qualifier}, idx={idx})")
    return result


# ─── Parse helpers ────────────────────────────────────────────────────────────

async def parse_edi_content(raw_edi: str, sender_phone: str) -> str:
    """Parse raw EDI string, save session with both tree and raw text. Returns reply."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edi", mode="w", encoding="utf-8") as tmp:
            tmp.write(raw_edi)
            tmp_path = tmp.name

        parser = EDIParser(tmp_path)
        tree = parser.parse()
        errors = tree.get("errors", [])

        await save_session(sender_phone, tree, errors, STATE_AWAITING_FIX_CHOICE, raw_edi=raw_edi)

        if not errors:
            return "✅ *Perfect file!* No errors found.\n\nReply *download* to get your file."
        return format_errors_for_chat(errors)

    except Exception as e:
        print(f"[WA] Parse ERROR: {e}")
        return f"❌ Failed to parse: {str(e)}\nMake sure it's valid X12 EDI content."
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ─── Twilio document downloader ───────────────────────────────────────────────

async def download_twilio_document(message_sid: str) -> bytes | None:
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
    media_list = data.get("media_list", [])
    if not media_list:
        return None
    media_sid = media_list[0]["sid"]
    media_url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages/{message_sid}/Media/{media_sid}"
    async with httpx.AsyncClient() as client:
        file_resp = await client.get(media_url, auth=auth, follow_redirects=True)
    return file_resp.content if file_resp.status_code == 200 else None


# ─── Error formatter ──────────────────────────────────────────────────────────

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
            line += f" (Field: `{field}`)"
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


# ─── Main webhook handler ─────────────────────────────────────────────────────

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

    print(f"[WA] phone={sender_phone} type={message_type} NumMedia={num_media} MediaUrl={bool(media_url)}")

    response = MessagingResponse()

    # ── DEBUG ─────────────────────────────────────────────────────────────────
    if incoming_msg.lower() == "debug":
        all_keys = dict(form_data)
        debug_text = "\n".join([f"{k}: {v}" for k, v in list(all_keys.items())[:20]])
        response.message(f"🔍 Twilio data:\n{debug_text}")
        return str(response)

    # ── 1. PASTED EDI TEXT (starts with ISA*) ────────────────────────────────
    looks_like_edi = incoming_msg.upper().startswith("ISA*") or incoming_msg.upper().startswith("ISA~")
    if looks_like_edi:
        reply = await parse_edi_content(incoming_msg, sender_phone)
        response.message(reply)
        return str(response)

    # ── 2. UPLOADED FILE ──────────────────────────────────────────────────────
    if has_media_url or is_document:
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID else None
        file_content = None

        if media_url and auth:
            async with httpx.AsyncClient() as client:
                r = await client.get(media_url, auth=auth, follow_redirects=True)
            if r.status_code == 200:
                file_content = r.content

        if not file_content and is_document and auth:
            file_content = await download_twilio_document(message_sid)

        if file_content:
            raw_edi = file_content.decode("utf-8", errors="replace").strip()
            reply = await parse_edi_content(raw_edi, sender_phone)
        else:
            reply = (
                "⚠️ *File received but couldn't download it* (Twilio Sandbox limitation).\n\n"
                "👉 *Workaround for testing*:\n"
                "Open the file in Notepad → Copy all → Paste here.\n"
                "EDI content starts with *ISA** — just paste the whole thing!"
            )

        response.message(reply)
        return str(response)

    # ── Get session for text input ────────────────────────────────────────────
    session = await get_session(sender_phone)
    msg_lower = incoming_msg.lower().strip()

    # ── 3. NO SESSION ─────────────────────────────────────────────────────────
    if not session:
        response.message(
            "👋 Welcome to *EdiFix Bot!* 🛠️\n\n"
            "Send me an EDI file *or* paste EDI text (starts with ISA*).\n\n"
            "I'll parse it, show errors in plain English, and help you fix them!"
        )
        return str(response)

    tree = json.loads(session["current_tree"])
    errors = json.loads(session["last_errors"])
    state = session["state"]
    pending_field = session.get("pending_field")
    raw_edi = session.get("raw_edi", "")

    # ── 4. DOWNLOAD ───────────────────────────────────────────────────────────
    if msg_lower in ("ignore", "ignore all", "ignore rest", "done", "download", "send", "finish"):
        try:
            # Generate from tree
            generator = EDIGenerator(tree)
            edi_string = generator.generate()

            remaining = len(errors)
            note = f"({remaining} error(s) skipped)" if remaining else "(all clean)"

            # Save edi_output and then send link
            await save_session(sender_phone, tree, errors, state, edi_output=edi_string)

            dl_url = make_download_url(sender_phone)
            response.message(
                f"✅ *Done!* {note}\n\n"
                f"📥 Download your fixed EDI file:\n{dl_url}\n\n"
                "_Link valid for 2 hours. Send a new file to start again!_"
            )
        except Exception as e:
            response.message(f"❌ Could not generate file: {str(e)}")
        return str(response)

    # ── 5. USER SELECTED AN ERROR NUMBER ─────────────────────────────────────
    if state == STATE_AWAITING_FIX_CHOICE and msg_lower.isdigit():
        choice = int(msg_lower)
        if 1 <= choice <= len(errors):
            selected_error = errors[choice - 1]
            fixable = get_fixable_field(selected_error)

            await save_session(
                sender_phone, tree, errors,
                STATE_AWAITING_VALUE,
                raw_edi=raw_edi,
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
                    f"⚠️ Error #{choice} [{selected_error.get('segment','?')}] can't be auto-fixed.\n"
                    "Reply with another number, or *ignore* to download anyway."
                )
        else:
            response.message(f"Reply with 1–{len(errors)}, or *ignore*.")
        return str(response)

    # ── 6. USER PROVIDED FIX VALUE ────────────────────────────────────────────
    if state == STATE_AWAITING_VALUE and pending_field:
        try:
            pending = json.loads(pending_field) if isinstance(pending_field, str) else pending_field
            error_index = pending.get("error_index", 0)
            original_error = {k: v for k, v in pending.items() if k != "error_index"}

            new_value = incoming_msg.strip()

            # ✅ Apply fix to raw EDI string (reliable) then re-parse
            if raw_edi:
                fixed_edi = fix_in_raw_edi(raw_edi, original_error, new_value)
                reply = await parse_edi_content(fixed_edi, sender_phone)
                # Show confirmation prefix
                reply = f"✅ Fixed *{original_error.get('field', '')}* → `{new_value}`\n\n" + reply
            else:
                # No raw EDI stored (shouldn't happen), do tree patch as fallback
                remaining_errors = [e for i, e in enumerate(errors) if i != error_index]
                await save_session(sender_phone, tree, remaining_errors, STATE_AWAITING_FIX_CHOICE, raw_edi=raw_edi)
                reply = f"✅ Noted! (raw EDI not stored, tree patch skipped)\n\n" + format_errors_for_chat(remaining_errors)

            response.message(reply)

        except Exception as e:
            response.message(f"❌ Something went wrong: {str(e)}")
        return str(response)

    # ── 7. CATCH-ALL ──────────────────────────────────────────────────────────
    if errors:
        response.message("Still here!\n\n" + format_errors_for_chat(errors))
    else:
        response.message("Reply *download* to get your file, or send new EDI to start fresh.")

    return str(response)
