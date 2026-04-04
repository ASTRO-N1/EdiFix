"""
834 Change Report — Delta Processor / Reconciliation Engine
===========================================================

Compares two 834 Benefit Enrollment files (T-Minus-1 vs T-Now) and
categorises every member into exactly one of three buckets:

  Additions    – In T-Now but NOT T-Minus-1, or INS03 == '021'
  Terminations – In T-Minus-1 but NOT T-Now, or INS03 == '024'
  Changes      – In both files (or INS03 == '001'), with attribute diffs

For Changes the engine diffs Demographics (name, DOB, gender),
Address (N3/N4) and Health Coverage (HD) with exact old → new values.

Every record is bound to its DTP*356 Maintenance Effective Date or
DTP*348 Coverage Date.  Audit anomalies (e.g. terminated member with
active coverage dates) are flagged automatically.
"""

from datetime import datetime
from typing import Optional


# ── Primitive helpers ────────────────────────────────────────────────────────

def _rd(seg: dict, idx: int, default: str = "") -> str:
    """Safe raw_data[idx] accessor."""
    rd = seg.get("raw_data", [])
    return str(rd[idx]).strip() if idx < len(rd) else default


def _unwrap(parsed: dict) -> dict:
    """API responses may be wrapped in {status, data, …}; extract the tree."""
    return parsed.get("data", parsed)


def _get_loops(parsed: dict) -> dict:
    return _unwrap(parsed).get("loops", {})


def _get_metadata(parsed: dict) -> dict:
    return _unwrap(parsed).get("metadata", {})


def _as_list(val) -> list:
    """Normalise – value may be a single dict or a list of dicts."""
    if val is None:
        return []
    return val if isinstance(val, list) else [val]


# ── Step 1: Chronological Sort ───────────────────────────────────────────────

def _extract_file_date(parsed: dict) -> Optional[datetime]:
    """
    Returns the file creation date from:
      1. BGN03 in 834_HEADER loop
      2. GS04 (date) from metadata
      3. ISA09 (date) from metadata
    """
    loops = _get_loops(parsed)

    # 1. BGN03
    for inst in _as_list(loops.get("834_HEADER")):
        bgn = inst.get("BGN", {})
        date_str = _rd(bgn, 3)
        if date_str and len(date_str) >= 8:
            try:
                return datetime.strptime(date_str[:8], "%Y%m%d")
            except ValueError:
                pass

    # 2. GS date
    meta = _get_metadata(parsed)
    gs_date = meta.get("gs_date", "")
    if gs_date and len(gs_date) == 8:
        try:
            return datetime.strptime(gs_date, "%Y%m%d")
        except ValueError:
            pass

    # 3. ISA date (YYMMDD)
    isa_date = meta.get("isa_date", "")
    if isa_date and len(isa_date) >= 6:
        try:
            return datetime.strptime(isa_date[:6], "%y%m%d")
        except ValueError:
            pass

    return None


# ── Step 2: Member extraction ────────────────────────────────────────────────

def _get_ref_0f(loop_2000_inst: dict) -> str:
    """Extract REF*0F Subscriber Number from 834_2000."""
    for ref in _as_list(loop_2000_inst.get("REF")):
        if _rd(ref, 1) == "0F":
            return _rd(ref, 2)
    # Fallback – return whatever first REF has
    first = _as_list(loop_2000_inst.get("REF"))
    return _rd(first[0], 2) if first else ""


def _get_effective_date(loop_2000_inst: dict) -> str:
    """Extract DTP*356 (Maintenance Effective Date) from 834_2000."""
    dtps = _as_list(loop_2000_inst.get("DTP"))
    for dtp in dtps:
        if _rd(dtp, 1) == "356":
            return _rd(dtp, 3)
    # Fallback DTP*303
    for dtp in dtps:
        if _rd(dtp, 1) == "303":
            return _rd(dtp, 3)
    return _rd(dtps[0], 3) if dtps else ""


def _get_coverage_date(loop_2300_inst: dict) -> str:
    """Extract DTP*348 Coverage Begin Date from 834_2300."""
    dtps = _as_list(loop_2300_inst.get("DTP"))
    for dtp in dtps:
        if _rd(dtp, 1) == "348":
            return _rd(dtp, 3)
    return _rd(dtps[0], 3) if dtps else ""


def _is_active_coverage(loop_2300_inst: dict) -> bool:
    """
    Return True if DTP dates in a 2300 loop indicate currently active coverage.
    Checks for begin date <= today and (no end date OR end date >= today).
    """
    today = datetime.today()
    dtps  = _as_list(loop_2300_inst.get("DTP"))

    begin_date: Optional[datetime] = None
    end_date:   Optional[datetime] = None

    BEGIN_QUALS = {"348", "356", "300", "303"}
    END_QUALS   = {"349", "302"}

    for dtp in dtps:
        qual     = _rd(dtp, 1)
        date_str = _rd(dtp, 3)
        if not date_str:
            continue
        try:
            dt = datetime.strptime(date_str[:8], "%Y%m%d")
            if qual in BEGIN_QUALS:
                begin_date = dt
            elif qual in END_QUALS:
                end_date = dt
        except ValueError:
            continue

    if begin_date and begin_date <= today:
        if end_date is None or end_date >= today:
            return True
    return False


def _extract_coverages(loop_2300_insts: list) -> list[dict]:
    coverages = []
    for inst in loop_2300_insts:
        hd_val = inst.get("HD", {})
        # Safety: if the parser produced a list (fallback), take the first item
        if isinstance(hd_val, list):
            hd_val = hd_val[0] if hd_val else {}
        coverages.append({
            "ins_line":      _rd(hd_val, 3),   # HD03 = Insurance Line Code (HLT/DEN/VIS…)
            "plan_coverage": _rd(hd_val, 4),   # HD04 = Plan Coverage Description [was wrongly 5]
            "tier":          _rd(hd_val, 5),   # HD05 = Coverage Level Code e.g. EMP [was wrongly 6]
            "coverage_date": _get_coverage_date(inst),
            "is_active":     _is_active_coverage(inst),
        })
    return coverages


def _extract_member(
    loop_2000_inst: dict,
    loop_2100a_inst: dict,
    loop_2300_insts: list,
) -> dict:
    """Build a normalised member snapshot dict."""
    ins = loop_2000_inst.get("INS", {})

    subscriber_id     = _get_ref_0f(loop_2000_inst)
    relationship_code = _rd(ins, 2)
    golden_id         = f"{subscriber_id}|{relationship_code}"

    nm1 = loop_2100a_inst.get("NM1", {}) if loop_2100a_inst else {}
    n3  = loop_2100a_inst.get("N3",  {}) if loop_2100a_inst else {}
    n4  = loop_2100a_inst.get("N4",  {}) if loop_2100a_inst else {}
    dmg = loop_2100a_inst.get("DMG", {}) if loop_2100a_inst else {}

    demographics = {
        "last_name":   _rd(nm1, 3),
        "first_name":  _rd(nm1, 4),
        "middle_name": _rd(nm1, 5),
        "dob":         _rd(dmg, 2),
        "gender":      _rd(dmg, 3),
    }

    address = {
        "line1": _rd(n3, 1),
        "line2": _rd(n3, 2),
        "city":  _rd(n4, 1),
        "state": _rd(n4, 2),
        "zip":   _rd(n4, 3),
    }

    return {
        "golden_id":         golden_id,
        "subscriber_id":     subscriber_id,
        "relationship_code": relationship_code,
        "ins01":             _rd(ins, 1),
        "ins02":             relationship_code,
        "ins03":             _rd(ins, 3),   # Maintenance type code
        "ins04":             _rd(ins, 4),   # Benefit status code
        "effective_date":    _get_effective_date(loop_2000_inst),
        "demographics":      demographics,
        "address":           address,
        "coverages":         _extract_coverages(loop_2300_insts),
    }


def _extract_all_members(parsed: dict) -> dict:
    """
    Walk the AST and return {golden_id: member_dict} for all Loop 2000 members.
    2100A and 2300 instances are matched to their parent 2000 by document order.
    """
    loops = _get_loops(parsed)
    meta = _unwrap(parsed).get("metadata", {})

    if "834_2000" not in loops:
        # Throw a visible error describing exactly what happened
        txn = meta.get("transaction_type", "unknown")
        loop_keys = list(loops.keys())
        raise ValueError(
            f"Parser did not find '834_2000' loops. Detected transaction_type: '{txn}'. "
            f"Found loop keys: {loop_keys}. File may not be a valid 834."
        )

    inst_2000  = _as_list(loops.get("834_2000"))
    inst_2100a = _as_list(loops.get("834_2100A"))
    inst_2300  = _as_list(loops.get("834_2300"))

    n          = len(inst_2000)
    total_2300 = len(inst_2300)

    members: dict = {}

    # Build a sequential cut-point array so we assign 2300 slices in order.
    # Each cut is computed as the cumulative sum of 2300 instances consumed.
    # Because cut-points are unknown at this level of the AST, we compute a
    # best-effort sequential assignment:
    #   - If n == 0: nothing to do.
    #   - If n == total_2300: 1 coverage per member (exact assignment).
    #   - Otherwise: proportional (best guess, may be off for mixed-coverage files).
    # The parser fix (HD now triggers a new instance) means most modern 834 files
    # will land correctly here.

    for i, loop_2000 in enumerate(inst_2000):
        loop_2100a = inst_2100a[i] if i < len(inst_2100a) else {}

        # Proportional slice of 2300 loops for this member
        if n > 0 and total_2300 > 0:
            s2 = (i * total_2300) // n
            e2 = ((i + 1) * total_2300) // n
        else:
            s2, e2 = 0, 0

        member = _extract_member(loop_2000, loop_2100a, inst_2300[s2:e2])

        gid = member["golden_id"]
        # Disambiguate collisions
        if gid in members:
            suffix = 2
            while f"{gid}#{suffix}" in members:
                suffix += 1
            gid = f"{gid}#{suffix}"
            member["golden_id"] = gid

        members[gid] = member

    return members


# ── Step 4: Attribute diff ───────────────────────────────────────────────────

def _diff_attributes(old: dict, new: dict) -> list[dict]:
    """
    Return a list of {field, category, old_value, new_value} dicts for
    every attribute that changed between two member snapshots.
    """
    diffs: list[dict] = []

    def _check(old_val: str, new_val: str, label: str, category: str):
        if old_val != new_val:
            diffs.append({
                "field":     label,
                "category":  category,
                "old_value": old_val if old_val else "(empty)",
                "new_value": new_val if new_val else "(empty)",
            })

    # Demographics
    DEMO = {
        "last_name":   "Last Name",
        "first_name":  "First Name",
        "middle_name": "Middle Name",
        "dob":         "Date of Birth (DMG02)",
        "gender":      "Gender (DMG03)",
    }
    od, nd = old.get("demographics", {}), new.get("demographics", {})
    for f, lbl in DEMO.items():
        _check(od.get(f, ""), nd.get(f, ""), lbl, "Demographics")

    # Address
    ADDR = {
        "line1": "Address Line 1 (N301)",
        "line2": "Address Line 2 (N302)",
        "city":  "City (N401)",
        "state": "State (N402)",
        "zip":   "ZIP Code (N403)",
    }
    oa, na = old.get("address", {}), new.get("address", {})
    for f, lbl in ADDR.items():
        _check(oa.get(f, ""), na.get(f, ""), lbl, "Address")

    # Coverage – match by insurance line (HD03)
    old_cov = {c.get("ins_line", str(i)): c for i, c in enumerate(old.get("coverages", []))}
    new_cov = {c.get("ins_line", str(i)): c for i, c in enumerate(new.get("coverages", []))}
    all_lines = sorted(set(old_cov) | set(new_cov))

    COV = {
        "ins_line":      "Insurance Line (HD03)",
        "plan_coverage": "Plan Coverage (HD05)",
        "tier":          "Coverage Tier (HD06)",
        "coverage_date": "Coverage Effective Date (DTP*348)",
    }
    for line in all_lines:
        oc = old_cov.get(line, {})
        nc = new_cov.get(line, {})
        for f, lbl in COV.items():
            _check(oc.get(f, ""), nc.get(f, ""), f"[{line}] {lbl}", "Coverage")

    return diffs


# ── Step 6: Audit anomalies ──────────────────────────────────────────────────

def _flag_anomalies(member: dict) -> list[str]:
    """
    Detect logical inconsistencies:
      • Terminated (INS03=024) but has active DTP dates in Loop 2300.
      • Addition (INS03=021) but no DTP*356 effective date.
      • Missing Subscriber ID (REF*0F).
    """
    anomalies: list[str] = []
    ins03     = member.get("ins03", "")
    coverages = member.get("coverages", [])

    if ins03 == "024":
        for cov in coverages:
            if cov.get("is_active"):
                anomalies.append(
                    f"Member is terminated (INS03=024) but coverage line "
                    f"'{cov.get('ins_line', '?')}' has active DTP dates — possible data lag."
                )

    if ins03 == "021" and not member.get("effective_date"):
        anomalies.append(
            "Member is flagged as an addition (INS03=021) but no "
            "Maintenance Effective Date (DTP*356) was found."
        )

    if not member.get("subscriber_id"):
        anomalies.append(
            "Subscriber ID is empty — REF*0F segment is missing or blank."
        )

    return anomalies


# ── Public API ───────────────────────────────────────────────────────────────

def reconcile_834(
    parsed_file_a: dict,
    parsed_file_b: dict,
) -> dict:
    """
    Compare two parsed 834 Benefit Enrollment ASTs and return a change report.

    Parameters
    ----------
    parsed_file_a, parsed_file_b:
        Full parse response dicts from /api/v1/parse (include "data" with "loops").
        Order does not matter — the engine auto-detects which is older.

    Returns
    -------
    dict with keys:
        summary       – counts and file dates
        additions     – new/rejoining members
        terminations  – dropped/cancelled members
        changes       – members with attribute diffs
        anomalies     – list of audit anomaly strings
    """

    # ── 1. Determine T-Minus-1 vs T-Now ─────────────────────────────────
    date_a = _extract_file_date(parsed_file_a)
    date_b = _extract_file_date(parsed_file_b)

    file_order_swapped = False
    if date_a is not None and date_b is not None and date_a > date_b:
        parsed_file_a, parsed_file_b = parsed_file_b, parsed_file_a
        date_a, date_b = date_b, date_a
        file_order_swapped = True

    parsed_old = parsed_file_a   # T-Minus-1
    parsed_new = parsed_file_b   # T-Now

    # ── 2. Extract members ───────────────────────────────────────────────
    members_old: dict = _extract_all_members(parsed_old)
    members_new: dict = _extract_all_members(parsed_new)

    all_gids = set(members_old) | set(members_new)

    additions:    list[dict] = []
    terminations: list[dict] = []
    changes:      list[dict] = []
    all_anomalies: list[str] = []

    # ── 3. Three-Bucket Sort ─────────────────────────────────────────────
    for gid in sorted(all_gids):
        in_old = gid in members_old
        in_new = gid in members_new

        old_m     = members_old.get(gid, {})
        new_m     = members_new.get(gid, {})
        ins03_new = new_m.get("ins03", "") if in_new else ""
        ins03_old = old_m.get("ins03", "") if in_old else ""

        ref_member = new_m if in_new else old_m
        name = (
            f"{ref_member.get('demographics', {}).get('first_name', '')} "
            f"{ref_member.get('demographics', {}).get('last_name', '')}".strip()
        )

        # ── Addition ─────────────────────────────────────────────────
        if not in_old or ins03_new == "021":
            anoms = _flag_anomalies(new_m) if in_new else []
            all_anomalies.extend(anoms)
            additions.append({
                "golden_id":      gid,
                "subscriber_id":  ref_member.get("subscriber_id", ""),
                "name":           name,
                "relationship":   ref_member.get("relationship_code", ""),
                "effective_date": ref_member.get("effective_date", ""),
                "ins03":          ins03_new,
                "member":         new_m if in_new else {},
                "anomalies":      anoms,
            })

        # ── Termination ───────────────────────────────────────────────
        elif not in_new or ins03_new == "024":
            term_m = old_m if in_old else new_m
            term_ins03 = ins03_new if in_new else ins03_old
            anoms = _flag_anomalies(new_m if in_new else old_m)
            all_anomalies.extend(anoms)
            terminations.append({
                "golden_id":      gid,
                "subscriber_id":  term_m.get("subscriber_id", ""),
                "name":           name,
                "relationship":   term_m.get("relationship_code", ""),
                "effective_date": (new_m if in_new else old_m).get("effective_date", ""),
                "ins03":          term_ins03,
                "member":         term_m,
                "anomalies":      anoms,
            })

        # ── Change ────────────────────────────────────────────────────
        elif in_old and in_new:
            diffs = _diff_attributes(old_m, new_m)
            anoms = _flag_anomalies(new_m)
            all_anomalies.extend(anoms)
            changes.append({
                "golden_id":       gid,
                "subscriber_id":   new_m.get("subscriber_id", ""),
                "name":            name,
                "relationship":    new_m.get("relationship_code", ""),
                "effective_date":  new_m.get("effective_date", ""),
                "ins03":           ins03_new,
                "attribute_diffs": diffs,
                "old_member":      old_m,
                "new_member":      new_m,
                "has_changes":     len(diffs) > 0,
                "anomalies":       anoms,
            })

    # ── 4. Summary ───────────────────────────────────────────────────────
    summary = {
        "total_members_t_minus_1": len(members_old),
        "total_members_t_now":     len(members_new),
        "additions_count":         len(additions),
        "terminations_count":      len(terminations),
        "changes_count":           len(changes),
        "anomalies_count":         len(all_anomalies),
        "file_date_t_minus_1":     date_a.strftime("%Y%m%d") if date_a else "unknown",
        "file_date_t_now":         date_b.strftime("%Y%m%d") if date_b else "unknown",
        "file_order_auto_swapped": file_order_swapped,
    }

    return {
        "summary":      summary,
        "additions":    additions,
        "terminations": terminations,
        "changes":      changes,
        "anomalies":    all_anomalies,
    }
