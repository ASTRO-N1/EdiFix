"""
Reconciliation Engine — 835-to-837 Financial Audit Service
===========================================================

Strategy
--------
837 side:  Read directly from loops["2300"] (claims) and loops["2400"] (service
           lines) using raw_data arrays — always present on every segment.

835 side:  Use the parser's own `remittance_summary` output (built by
           EDIParser._commit_pending_clp / build_remittance_summary).
           This is a clean list of claim dicts with nested services/adjustments,
           already decoded, requiring NO loop-key guessing.

           remittance_summary item shape (from parser):
             {
               "claim_id":           str,      # CLP01 — matches CLM01
               "status_code":        str,       # CLP02
               "billed":             float,     # CLP03
               "paid":               float,     # CLP04
               "patient_responsibility": float, # CLP05
               "adjustments":        [{"group_code","reason_code","amount",...}],
               "services": [
                 {
                   "adjustments": [{"group_code","reason_code","amount",...}]
                   # NOTE: raw SVC amounts are NOT stored here by the parser.
                   # We read SVC amounts from loops["835_2110"] raw_data.
                 }
               ],
               "check_eft_number":   str,
               "supplemental":       dict,
             }

           Because the parser's `_pending_svc` only stores `{"adjustments":[]}`,
           we still need the SVC loop instances for the submitted/paid amounts.
           We read those from loops["835_2110"] raw_data.

Parser-imposed limits (DO NOT CHANGE PARSER):
  - No field names guaranteed on CAS, SVC etc. unless a schema file exists.
  - raw_data[i] is always available.
  - remittance_summary is the authoritative 835 aggregate source.
"""

import json
import os
from typing import Optional

# ── Reference data ─────────────────────────────────────────────────────────

_CARC_CACHE: Optional[dict] = None
_CPT_CACHE:  Optional[dict] = None


def _load_carc() -> dict:
    global _CARC_CACHE
    if _CARC_CACHE is None:
        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "reference_data", "carc_codes.json",
        )
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = json.load(fh)
            _CARC_CACHE = raw.get("codes", {})
        except Exception:
            _CARC_CACHE = {}
    return _CARC_CACHE


def _load_cpt() -> dict:
    global _CPT_CACHE
    if _CPT_CACHE is None:
        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "reference_data", "cpt_codes.json",
        )
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = json.load(fh)
            codes = raw.get("codes", {})
            if isinstance(codes, list):
                _CPT_CACHE = {str(c): str(c) for c in codes}
            else:
                _CPT_CACHE = {str(k): str(v) for k, v in codes.items()}
        except Exception:
            _CPT_CACHE = {}
    return _CPT_CACHE


def _carc_desc(code: str) -> str:
    carc = _load_carc()
    raw = str(carc.get(str(code), ""))
    if not raw:
        return f"Adjustment reason code {code}"
    for sep in (" Start:", ". Usage:", ". Note", " (Use ", "This"):
        idx = raw.find(sep)
        if idx > 10:
            raw = raw[:idx]
    return raw.strip().rstrip(".")


def _cpt_desc(code: str) -> str:
    cpt = _load_cpt()
    code_clean = str(code).strip().upper()
    desc = cpt.get(code_clean, "") or cpt.get(str(code).strip(), "")
    if not desc or desc == code:
        return code
    return desc[:80] + ("…" if len(desc) > 80 else "")


# ── Primitive helpers ───────────────────────────────────────────────────────

def _sf(value) -> float:
    """Safe float conversion."""
    try:
        return round(float(str(value).strip()), 2)
    except (ValueError, TypeError):
        return 0.0


def _rd(seg: dict, idx: int, default: str = "") -> str:
    """Read raw_data[idx] from a segment dict."""
    rd = seg.get("raw_data", [])
    return str(rd[idx]).strip() if idx < len(rd) else default


def _parse_composite(value) -> tuple[str, str]:
    """
    Parse a procedure code composite like 'HC:99213' into ('HC', '99213').
    Handles string or list forms.
    """
    if isinstance(value, list):
        qual = value[0].strip() if len(value) > 0 else "HC"
        code = value[1].strip() if len(value) > 1 else ""
        return qual, code
    s = str(value).strip()
    if ":" in s:
        parts = s.split(":", 1)
        return parts[0].strip(), parts[1].strip()
    return "HC", s


def _unwrap(parsed: dict) -> dict:
    """
    API responses are wrapped: {"status":"success","data":<tree>,...}
    Return the inner tree dict.
    """
    return parsed.get("data", parsed)


def _get_loops(parsed: dict) -> dict:
    return _unwrap(parsed).get("loops", {})


# ── 837 extraction ──────────────────────────────────────────────────────────

def _get_837_claims(parsed_837: dict) -> list[dict]:
    """
    Returns all instances from loops["2300"] that contain a CLM segment.
    Each instance is a dict: {"CLM": <seg>, "HI": <seg>, ...}
    """
    loops = _get_loops(parsed_837)
    bucket = loops.get("2300", [])
    if isinstance(bucket, dict):
        bucket = [bucket]
    return [inst for inst in (bucket or []) if isinstance(inst, dict) and "CLM" in inst]


def _pcn_837(claim_inst: dict) -> str:
    """CLM raw_data[1] = Patient Control Number."""
    return _rd(claim_inst.get("CLM", {}), 1)


def _billed_837(claim_inst: dict) -> float:
    """CLM raw_data[2] = total billed amount."""
    return _sf(_rd(claim_inst.get("CLM", {}), 2))


def _get_837_service_lines(parsed_837: dict) -> list[dict]:
    """
    Returns all instances from loops["2400"] that contain SV1.
    SV1 raw_data: [0]=SV1, [1]=composite, [2]=charge
    """
    loops = _get_loops(parsed_837)
    bucket = loops.get("2400", [])
    if isinstance(bucket, dict):
        bucket = [bucket]
    result = []
    for inst in (bucket or []):
        if isinstance(inst, dict) and "SV1" in inst:
            result.append(inst)
    return result


def _lookup_billed_837(code: str, svc_lines: list[dict]) -> float:
    """Find the SV1 in 837 that matches the given procedure code."""
    code_upper = code.strip().upper()
    for inst in svc_lines:
        sv1 = inst.get("SV1", {})
        rd = sv1.get("raw_data", [])
        if len(rd) >= 3:
            _, code837 = _parse_composite(rd[1])
            if code837.strip().upper() == code_upper:
                return _sf(rd[2])
    return 0.0


# ── 835 extraction ──────────────────────────────────────────────────────────

def _get_835_svc_instances(parsed_835: dict) -> list[dict]:
    """
    Returns ALL instances from loops["835_2110"] — each has a SVC segment
    and possibly CAS segment(s).
    Order in the list follows document order (guaranteed by list append).
    """
    loops = _get_loops(parsed_835)
    bucket = loops.get("835_2110", [])
    if isinstance(bucket, dict):
        bucket = [bucket]
    return [inst for inst in (bucket or []) if isinstance(inst, dict) and "SVC" in inst]


def _get_835_clp_instances(parsed_835: dict) -> list[dict]:
    """
    Returns ALL instances from loops["835_2100"] — each has a CLP segment.
    """
    loops = _get_loops(parsed_835)
    bucket = loops.get("835_2100", [])
    if isinstance(bucket, dict):
        bucket = [bucket]
    return [inst for inst in (bucket or []) if isinstance(inst, dict) and "CLP" in inst]


def _parse_cas_from_segment(cas_seg: dict) -> list[dict]:
    """
    CAS raw_data: [0]=CAS, [1]=group_code, [2]=reason1, [3]=amt1, ...
    Up to 6 triplets of (reason, amount) after the group code.
    """
    rd = cas_seg.get("raw_data", [])
    if len(rd) < 4:
        return []
    group = rd[1].strip()
    result = []
    i = 2
    while i + 1 < len(rd):
        reason = rd[i].strip() if len(rd) > i else ""
        amount_s = rd[i + 1].strip() if len(rd) > i + 1 else ""
        if not reason:
            break
        amount = _sf(amount_s) if amount_s else 0.0
        if reason:
            result.append({
                "group_code":  group,
                "reason_code": reason,
                "amount":      amount,
                "description": _carc_desc(reason),
            })
        i += 2
    return result


def _parse_cas_from_instances(instances: list[dict]) -> list[dict]:
    """
    Pull CAS adjustments from one or more instances.
    CAS may be a single dict or a list of dicts in the instance.
    """
    result = []
    for inst in instances:
        cas_val = inst.get("CAS")
        if cas_val is None:
            continue
        cas_list = cas_val if isinstance(cas_val, list) else [cas_val]
        for cas_seg in cas_list:
            result.extend(_parse_cas_from_segment(cas_seg))
    return result


# ── Line-item builder ───────────────────────────────────────────────────────

def _build_line_item(
    svc_inst: dict,
    svc_lines_837: list[dict],
) -> Optional[dict]:
    """
    Build one line-item from a 835_2110 loop instance.
    SVC raw_data: [0]=SVC, [1]=composite, [2]=submitted_amt, [3]=paid_amt
    CAS may be embedded in the same instance.
    """
    svc_seg = svc_inst.get("SVC", {})
    rd = svc_seg.get("raw_data", [])
    if len(rd) < 2:
        return None

    qual, code = _parse_composite(rd[1])
    submitted = _sf(rd[2] if len(rd) > 2 else 0)  # SVC02 = submitted/allowed
    paid      = _sf(rd[3] if len(rd) > 3 else 0)  # SVC03 = paid by payer

    # CAS in the same instance
    cas_val = svc_inst.get("CAS")
    cas_list = []
    if cas_val is not None:
        cas_list = cas_val if isinstance(cas_val, list) else [cas_val]
    adjustments = []
    for cs in cas_list:
        adjustments.extend(_parse_cas_from_segment(cs))

    # Billed amount from 837 SV1
    billed = _lookup_billed_837(code, svc_lines_837)
    if billed == 0.0:
        billed = submitted  # fallback

    difference = round(billed - paid, 2)
    total_adj  = round(sum(a["amount"] for a in adjustments), 2)
    integrity_ok = abs(difference - total_adj) < 0.05

    by_group: dict[str, float] = {}
    for adj in adjustments:
        g = adj["group_code"]
        by_group[g] = round(by_group.get(g, 0.0) + adj["amount"], 2)

    return {
        "procedure_code":       code,
        "qualifier":            qual,
        "description":          _cpt_desc(code),
        "billed":               billed,
        "allowed":              submitted,
        "paid":                 paid,
        "difference":           difference,
        "adjustments":          adjustments,
        "adjustments_by_group": by_group,
        "integrity_ok":         integrity_ok,
        "pr_amount":            by_group.get("PR", 0.0),
        "co_amount":            by_group.get("CO", 0.0),
        "oa_pi_amount":         round(by_group.get("OA", 0.0) + by_group.get("PI", 0.0), 2),
    }


# ── Verdict ─────────────────────────────────────────────────────────────────

def _verdict(
    total_billed: float, total_paid: float,
    total_pr: float, total_co: float, total_oa_pi: float,
    claim_adj: list[dict], line_items: list[dict],
) -> dict:
    diff = round(total_billed - total_paid, 2)

    if total_paid == 0.0 and total_billed > 0.0:
        status, color = "denied", "red"
    elif total_oa_pi > 0.0:
        status, color = "flagged", "red"
    elif diff < 0.01:
        status, color = "paid_in_full", "green"
    elif total_pr > 0.0 and total_co > 0.0:
        status, color = "adjusted", "yellow"
    elif total_pr > 0.0:
        status, color = "patient_balance", "yellow"
    elif total_co > 0.0:
        status, color = "contractual_writeoff", "yellow"
    else:
        status, color = "adjusted", "yellow"

    sentences: list[str] = []
    if status == "paid_in_full":
        sentences.append(f"Claim paid in full. Billed ${total_billed:,.2f}, received ${total_paid:,.2f}.")
        if total_co > 0:
            sentences.append(f"${total_co:,.2f} contractual write-off absorbed per fee schedule.")
    elif status == "denied":
        sentences.append(f"Claim denied. Billed ${total_billed:,.2f}, received $0.00.")
        if claim_adj:
            codes = ", ".join(f"{a['group_code']}-{a['reason_code']}" for a in claim_adj[:3])
            sentences.append(f"Denial codes: {codes}.")
    elif status == "flagged":
        sentences.append(f"Claim flagged. Billed ${total_billed:,.2f}, paid ${total_paid:,.2f}.")
        sentences.append(f"${total_oa_pi:,.2f} in OA/PI adjustments require review.")
        if total_pr > 0:
            sentences.append(f"${total_pr:,.2f} is patient responsibility.")
        if total_co > 0:
            sentences.append(f"${total_co:,.2f} is contractual write-off.")
    else:
        sentences.append(f"Claim adjusted. Billed ${total_billed:,.2f}, paid ${total_paid:,.2f}.")
        if total_co > 0:
            sentences.append(f"${total_co:,.2f} written off as contractual obligation (fee schedule).")
        if total_pr > 0:
            sentences.append(f"${total_pr:,.2f} is patient responsibility (deductible/copay/coinsurance).")

    # Clinical denial note
    clinical_codes = {"50", "96", "97", "167", "200"}
    if any(
        a["reason_code"] in clinical_codes and a["group_code"] == "CO"
        for item in line_items for a in item["adjustments"]
    ) and status != "denied":
        sentences.append("Note: At least one line reduced for clinical policy reasons.")

    # Sequestration
    if any(a["reason_code"] == "253" for a in claim_adj):
        sentences.append("Mandatory 2% sequestration reduction (CO-253) applied at claim level.")

    labels = {
        "paid_in_full":         "Paid in Full",
        "denied":               "Denied",
        "flagged":              "Flagged — Requires Review",
        "adjusted":             "Adjusted (Underpaid)",
        "patient_balance":      "Patient Balance Due",
        "contractual_writeoff": "Contractual Write-Off",
    }
    return {"status": status, "label": labels.get(status, "Adjusted"), "color": color, "summary": " ".join(sentences)}


# ── Public API ──────────────────────────────────────────────────────────────

def reconcile(parsed_837: dict, parsed_835: dict) -> dict:
    """
    Cross-reference an 837 claim against an 835 remittance.

    Parameters
    ----------
    parsed_837 : dict
        Full response from /api/v1/parse  (includes "data" with "loops")
    parsed_835 : dict
        Full response from /api/v1/parse-835  (includes "data" and "remittance_summary")

    Returns
    -------
    ReconciliationReport dict with keys:
        matched, pcn, line_items, claim_summary, verdict, error
    """

    # ── 1.  Extract 837 claims ─────────────────────────────────────────────
    claims_837 = _get_837_claims(parsed_837)
    if not claims_837:
        return {
            "matched": False,
            "error": (
                "No 837 claim loops (2300 / CLM) found. "
                "Ensure the uploaded file is a valid 837 Professional or Institutional claim."
            ),
        }

    # ── 2.  Get 835 remittance_summary (preferred) or fall back to raw loops ─
    remittance_summary: list[dict] = parsed_835.get("remittance_summary", [])

    # If remittance_summary is empty (unexpected), fall back to CLP loop instances
    if not remittance_summary:
        clp_instances = _get_835_clp_instances(parsed_835)
        if not clp_instances:
            return {
                "matched": False,
                "error": (
                    "No CLP segments found in the 835 file. "
                    "Ensure the uploaded file is a valid 835 Remittance Advice."
                ),
            }
        # Build minimal remittance records from raw_data
        remittance_summary = []
        for inst in clp_instances:
            clp_seg = inst["CLP"]
            rd = clp_seg.get("raw_data", [])
            if len(rd) < 2:
                continue
            remittance_summary.append({
                "claim_id":           rd[1].strip() if len(rd) > 1 else "",
                "status_code":        rd[2].strip() if len(rd) > 2 else "",
                "billed":             _sf(rd[3] if len(rd) > 3 else 0),
                "paid":               _sf(rd[4] if len(rd) > 4 else 0),
                "patient_responsibility": _sf(rd[5] if len(rd) > 5 else 0),
                "adjustments":        [],
                "services":           [],
                "check_eft_number":   "",
                "supplemental":       {},
            })

    if not remittance_summary:
        return {
            "matched": False,
            "error": "No claim payment (CLP) records found in the 835 file.",
        }

    # ── 3.  PCN matching  ──────────────────────────────────────────────────
    matched_claim_837: Optional[dict] = None
    matched_835_rec:   Optional[dict] = None

    for rec_835 in remittance_summary:
        pcn_835 = str(rec_835.get("claim_id", "")).strip()
        for claim_inst in claims_837:
            if _pcn_837(claim_inst) == pcn_835:
                matched_claim_837 = claim_inst
                matched_835_rec   = rec_835
                break
        if matched_claim_837:
            break

    if not matched_claim_837 or not matched_835_rec:
        pcns_837 = [_pcn_837(c) for c in claims_837]
        pcns_835 = [str(r.get("claim_id", "")) for r in remittance_summary]
        return {
            "matched": False,
            "error": (
                f"PCN mismatch — no common Patient Control Number found. "
                f"837 PCN(s): {pcns_837}.  835 PCN(s): {pcns_835}. "
                "Verify you are uploading the correct matching pair of files."
            ),
        }

    pcn = str(matched_835_rec["claim_id"])

    # ── 4.  Extract 837 service lines for billed-amount lookup ────────────
    svc_lines_837 = _get_837_service_lines(parsed_837)

    # ── 5.  Build line items from 835_2110 SVC instances ─────────────────
    svc_instances_835 = _get_835_svc_instances(parsed_835)
    line_items: list[dict] = []
    for svc_inst in svc_instances_835:
        item = _build_line_item(svc_inst, svc_lines_837)
        if item:
            line_items.append(item)

    # If no SVC instances found (header-only adjudication), build from remittance_summary services
    if not line_items:
        # The parser stores list of {"adjustments":[...]} dicts under services
        # We can still produce a summary row from the CLP totals
        pass  # leave line_items empty — the summary cards will still show

    # ── 6.  Claim-level adjustments  ──────────────────────────────────────
    # Prefer adjustments from remittance_summary (parser-processed)
    # These come from CAS segments at the CLP level (before any SVC)
    raw_claim_adj = matched_835_rec.get("adjustments", [])
    # Parser stores them as {"group_code","reason_code","amount"} — enrich with desc
    claim_adj = []
    for a in raw_claim_adj:
        claim_adj.append({
            "group_code":  str(a.get("group_code", "")),
            "reason_code": str(a.get("reason_code", "")),
            "amount":      _sf(a.get("amount", 0)),
            "description": _carc_desc(str(a.get("reason_code", ""))),
        })

    # ── 7.  KPI totals ─────────────────────────────────────────────────────
    total_billed = _sf(matched_835_rec.get("billed", 0))
    total_paid   = _sf(matched_835_rec.get("paid",   0))
    patient_resp = _sf(matched_835_rec.get("patient_responsibility", 0))

    # Sum from line items
    line_pr    = round(sum(i["pr_amount"]    for i in line_items), 2)
    line_co    = round(sum(i["co_amount"]    for i in line_items), 2)
    line_oa_pi = round(sum(i["oa_pi_amount"] for i in line_items), 2)

    # From claim-level adjustments
    cl_co  = round(sum(a["amount"] for a in claim_adj if a["group_code"] == "CO"),       2)
    cl_pr  = round(sum(a["amount"] for a in claim_adj if a["group_code"] == "PR"),       2)
    cl_oa  = round(sum(a["amount"] for a in claim_adj if a["group_code"] in ("OA","PI")), 2)

    total_pr    = round(line_pr    + cl_pr,  2)
    total_co    = round(line_co    + cl_co,  2)
    total_oa_pi = round(line_oa_pi + cl_oa,  2)
    total_adj   = round(total_pr + total_co + total_oa_pi, 2)
    difference  = round(total_billed - total_paid, 2)
    integrity   = abs(difference - total_adj) < 0.05

    # Use CLP05 patient_responsibility as fallback if no PR adjustments found
    if total_pr == 0.0 and patient_resp > 0.0:
        total_pr = patient_resp

    claim_summary = {
        "total_billed":                 total_billed,
        "total_paid":                   total_paid,
        "total_patient_responsibility":  total_pr,
        "total_contractual_adjustment":  total_co,
        "total_oa_pi":                   total_oa_pi,
        "total_adjustments":             total_adj,
        "difference":                    difference,
        "integrity_check_passed":        integrity,
        "claim_level_adjustments":       claim_adj,
        "clp_patient_responsibility":    patient_resp,
    }

    # ── 8.  Verdict ────────────────────────────────────────────────────────
    verd = _verdict(
        total_billed, total_paid,
        total_pr, total_co, total_oa_pi,
        claim_adj, line_items,
    )

    return {
        "matched":       True,
        "pcn":           pcn,
        "line_items":    line_items,
        "claim_summary": claim_summary,
        "verdict":       verd,
        "error":         None,
    }
