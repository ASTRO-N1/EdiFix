"""
whatsapp_handler.py

Full-featured WhatsApp EDI Bot.
Flow: User uploads .edi -> Bot parses -> Lists errors -> User fixes or ignores -> Bot returns fixed file.
State is tracked in Supabase `whatsapp_sessions` table, keyed by phone number.
Sessions auto-expire after 2 hours of inactivity via Supabase TTL logic.
"""
import httpx
import os
import json
import re
import tempfile
from fastapi import Request
from twilio.twiml.messaging_response import MessagingResponse

from core_parser.edi_parser import EDIParser
from core_parser.edi_generator import EDIGenerator

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

DB_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ─── State Constants ──────────────────────────────────────────────────────────
STATE_IDLE = "IDLE"
STATE_AWAITING_FIX_CHOICE = "AWAITING_FIX_CHOICE"  # User chose an error #, now we ask for the value
STATE_AWAITING_VALUE = "AWAITING_VALUE"              # Waiting for the user to type the corrected value


# ─── Supabase Helpers ─────────────────────────────────────────────────────────

async def get_session(phone: str) -> dict | None:
    """Fetch a session from the DB by phone number."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers=DB_HEADERS,
            params={"phone_number": f"eq.{phone}", "select": "*"},
        )
    if resp.status_code == 200 and resp.json():
        return resp.json()[0]
    return None


async def save_session(phone: str, tree: dict, errors: list, state: str, pending_field: str | None = None):
    """Upsert session data for this phone number."""
    data = {
        "phone_number": phone,
        "current_tree": json.dumps(tree),
        "last_errors": json.dumps(errors),
        "state": state,
        "pending_field": pending_field,
        "updated_at": "now()",
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers={**DB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=data,
        )


async def delete_session(phone: str):
    """Remove the session once the user is done."""
    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{SUPABASE_URL}/rest/v1/whatsapp_sessions",
            headers=DB_HEADERS,
            params={"phone_number": f"eq.{phone}"},
        )


# ─── Twilio File Sender ───────────────────────────────────────────────────────

async def send_edi_file(to: str, edi_content: str, filename: str):
    """
    Use the Twilio REST API to send the fixed EDI back as a media message.
    This is a separate call outside TwiML because sending binary files requires the REST API.
    """
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return  # Silently skip if Twilio is not configured yet

    # We upload the content to a temp Twilio URL via the Media API.
    # Simplest approach for demos: base64-encode and send as a text file link.
    # For now, we'll just send it as a text reply with the EDI content (Twilio sandbox limitation).
    # In production, you'd host the file and send a URL.
    pass


# ─── Error Formatter ─────────────────────────────────────────────────────────

def format_errors_for_chat(errors: list) -> str:
    """Turn the list of EDI errors into a human-readable WhatsApp message."""
    if not errors:
        return "✅ No errors found!"

    lines = [f"⚠️ Found *{len(errors)} error(s)*:\n"]
    for i, err in enumerate(errors[:10], 1):  # Cap at 10 for readability
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

    lines.append("\n\nReply with a number to fix that error, or *ignore* to skip and get the file.")
    return "\n".join(lines)


def get_fixable_field(error: dict) -> dict | None:
    """Map a known error to the field in the EDI tree that needs to be changed."""
    FIELD_MAP = {
        "NM109": {"path": ["NM1", "NM109"], "label": "NPI / ID Number"},
        "NM103": {"path": ["NM1", "NM103"], "label": "Organization / Provider Name"},
        "CLM01":  {"path": ["CLM", "CLM01"],  "label": "Claim ID"},
        "CLM02":  {"path": ["CLM", "CLM02"],  "label": "Claimed Amount ($)"},
        "DTP03":  {"path": ["DTP", "DTP03"],  "label": "Service Date (CCYYMMDD)"},
        "N301":   {"path": ["N3",  "N301"],   "label": "Street Address"},
        "N401":   {"path": ["N4",  "N401"],   "label": "City"},
        "N402":   {"path": ["N4",  "N402"],   "label": "State"},
        "N403":   {"path": ["N4",  "N403"],   "label": "ZIP Code"},
        "REF02":  {"path": ["REF", "REF02"],  "label": "Tax ID / Reference Number"},
    }
    field_key = error.get("field", "")
    return FIELD_MAP.get(field_key)


def apply_patch_to_tree(tree: dict, error: dict, new_value: str) -> dict:
    """
    Walk the tree and apply the new_value to the correct segment/field.
    This is a simplified deep-patch for the session flow.
    """
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


# ─── Main Webhook Handler ─────────────────────────────────────────────────────

async def handle_whatsapp_webhook(request: Request) -> str:
    form_data = await request.form()
    incoming_msg = form_data.get("Body", "").strip()
    sender_phone = form_data.get("From", "")
    num_media = int(form_data.get("NumMedia", 0))

    response = MessagingResponse()

    # ── 1. FILE UPLOADED — Parse it ───────────────────────────────────────────
    if num_media > 0:
        media_url = form_data.get("MediaUrl0", "")
        response.message("📂 File received! Parsing now... Please wait a moment.")

        try:
            # Download with Twilio credentials
            auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID else None
            async with httpx.AsyncClient() as client:
                file_resp = await client.get(media_url, auth=auth, follow_redirects=True)

            with tempfile.NamedTemporaryFile(delete=False, suffix=".edi") as tmp:
                tmp.write(file_resp.content)
                tmp_path = tmp.name

            parser = EDIParser(tmp_path)
            tree = parser.parse()

            errors = tree.get("errors", [])
            await save_session(sender_phone, tree, errors, STATE_AWAITING_FIX_CHOICE)

            if not errors:
                reply = (
                    "✅ *Perfect file!* No errors found.\n\n"
                    "Reply *download* to get your file sent back, or just drop a new one."
                )
            else:
                reply = format_errors_for_chat(errors)

            response.message(reply)

        except Exception as e:
            response.message(f"❌ Failed to parse the file: {str(e)}\nPlease make sure it's a valid X12 EDI file.")
        finally:
            if "tmp_path" in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)

        return str(response)

    # ── Get current session ───────────────────────────────────────────────────
    session = await get_session(sender_phone)
    msg_lower = incoming_msg.lower().strip()

    # ── 2. NO SESSION — Greet the user ────────────────────────────────────────
    if not session:
        response.message(
            "👋 Welcome to *EdiFix Bot!* 🛠️\n\n"
            "Just drop an EDI file here (.edi) and I'll:\n"
            "  1. Parse it instantly\n"
            "  2. Show you all the errors in plain English\n"
            "  3. Help you fix them one by one\n"
            "  4. Send the fixed file back!\n\n"
            "_Send your file to get started._"
        )
        return str(response)

    tree = json.loads(session["current_tree"])
    errors = json.loads(session["last_errors"])
    state = session["state"]
    pending_field = session.get("pending_field")

    # ── 3. USER WANTS TO IGNORE ALL & DOWNLOAD ───────────────────────────────
    if msg_lower in ("ignore", "ignore all", "ignore rest", "done", "download", "send", "finish"):
        try:
            generator = EDIGenerator(tree)
            edi_string = generator.generate()
            await delete_session(sender_phone)

            remaining = len(errors)
            note = f"({remaining} error(s) were skipped)" if remaining else "(file was clean)"

            # Send the EDI as text (Twilio sandbox limitation)
            response.message(
                f"✅ *Done!* Here is your fixed EDI file {note}:\n\n"
                f"```\n{edi_string[:3000]}\n```\n\n"
                "_Copy the above text and save it as a .edi file._\n"
                "Send a new file to start again!"
            )
        except Exception as e:
            response.message(f"❌ Could not generate the file: {str(e)}")
        return str(response)

    # ── 4. USER SELECTED AN ERROR NUMBER TO FIX ──────────────────────────────
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
                    f"⚠️ This error ({selected_error.get('segment','?')}) cannot be fixed automatically.\n"
                    f"Reply with another error number, or *ignore* to skip and get the file."
                )
        else:
            response.message(f"Please reply with a number between 1 and {len(errors)}, or *ignore* to skip.")
        return str(response)

    # ── 5. USER PROVIDED A VALUE FOR THE PENDING FIX ─────────────────────────
    if state == STATE_AWAITING_VALUE and pending_field:
        try:
            pending = json.loads(pending_field) if isinstance(pending_field, str) else pending_field
            error_index = pending.get("error_index", 0)
            original_error = errors[error_index]

            # Patch the tree
            patched_tree = apply_patch_to_tree(tree, original_error, incoming_msg.strip())

            # Remove this error from the list
            remaining_errors = [e for i, e in enumerate(errors) if i != error_index]

            await save_session(sender_phone, patched_tree, remaining_errors, STATE_AWAITING_FIX_CHOICE)

            if remaining_errors:
                reply = (
                    f"✅ Fixed! Value set to *{incoming_msg.strip()}*\n\n"
                    + format_errors_for_chat(remaining_errors)
                )
            else:
                reply = (
                    "🎉 *All errors fixed!*\n\n"
                    "Reply *download* to get your corrected EDI file."
                )
            response.message(reply)

        except Exception as e:
            response.message(f"❌ Something went wrong applying that fix: {str(e)}")
        return str(response)

    # ── 6. CATCH-ALL ─────────────────────────────────────────────────────────
    if errors:
        response.message(
            "I'm waiting for your input!\n\n"
            + format_errors_for_chat(errors)
        )
    else:
        response.message(
            "Reply *download* to get your file, or send a new .edi file to start fresh."
        )

    return str(response)
