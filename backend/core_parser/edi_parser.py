"""
EDI Parser — Production-Grade X12 837/835/834 Parser & Validator
================================================================
Validation architecture:
  Layer 1 — Structural / format    (always in-code, zero external deps)
  Layer 2 — Codeset / reference    (loaded from reference_data/*.json)
  Layer 3 — Presence / completeness (required segments per loop)
  Layer 4 — Cross-segment          (reconciliation across the full file)
"""
# MADE BY ROMA only

import json
import os
import re
import itertools
from datetime import datetime

# ---------------------------------------------------------------------------
# Reference-data loader (Layer 2)
# ---------------------------------------------------------------------------

class ReferenceData:
    _FILENAMES = {
        "carc":  "carc_codes.json",
        "rarc":  "rarc_codes.json",
        "icd10": "icd10_codes.json",
        "cpt":   "cpt_codes.json",
        "hcpcs": "hcpcs_codes.json",
    }

    def __init__(self, base_dir: str):
        self._base  = os.path.abspath(os.path.join(base_dir, "reference_data"))
        self._cache: dict = {}
        self.versions: dict = {}

    def _load(self, key: str):
        if key in self._cache:
            return self._cache[key]

        path = os.path.join(self._base, self._FILENAMES[key])
        if not os.path.exists(path):
            self._cache[key]  = None
            self.versions[key] = "NOT_LOADED"
            return None

        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = json.load(fh)
            codes = raw.get("codes", [])
            code_set = set(
                str(c).strip().upper()
                for c in (codes if isinstance(codes, list) else codes.keys())
            )
            if not code_set:
                self._cache[key]  = None
                self.versions[key] = raw.get("version", "unknown")
                return None
            self._cache[key]  = code_set
            self.versions[key] = raw.get("version", "unknown")
            return code_set
        except Exception as exc:
            self._cache[key]  = None
            self.versions[key] = f"LOAD_ERROR: {exc}"
            return None

    def carc(self):  return self._load("carc")
    def rarc(self):  return self._load("rarc")
    def icd10(self): return self._load("icd10")
    def cpt(self):   return self._load("cpt")
    def hcpcs(self): return self._load("hcpcs")

    def check(self, key: str, value: str) -> str:
        code_set = self._load(key)
        if code_set is None:
            return "unknown"
        raw_norm = str(value).strip().upper()
        if raw_norm in code_set:
            return "valid"
        compact = re.sub(r"[^A-Z0-9]", "", raw_norm)
        if compact in code_set:
            return "valid"
        return "invalid"


# ---------------------------------------------------------------------------
# Layer 3 — Required-segment presence rules
# ---------------------------------------------------------------------------

REQUIRED_SEGMENTS: dict = {
    # ── 837P / 837I shared ──────────────────────────────────────────────────
    "HEADER": {
        "ISA": ("ISA - Interchange Control Header", "Every X12 file must begin with an ISA segment."),
        "GS":  ("GS - Functional Group Header", "A GS segment must follow the ISA segment."),
        "ST":  ("ST - Transaction Set Header", "Every transaction must begin with an ST segment."),
        "BHT": ("BHT - Beginning of Hierarchical Transaction", "BHT is required as the first segment after ST in 837 transactions."),
    },
    "1000A": {
        "NM1": ("NM1 - Submitter Name", "Loop 1000A must contain an NM1 segment identifying the submitter."),
        "PER": ("PER - Submitter Contact Information", "Loop 1000A must contain a PER segment with contact details."),
    },
    "1000B": {
        "NM1": ("NM1 - Receiver Name", "Loop 1000B must contain an NM1 segment identifying the receiver."),
    },
    "2000A": {
        "HL":  ("HL - Billing Provider Hierarchical Level", "Loop 2000A must contain an HL segment with level code 20."),
        "PRV": ("PRV - Billing Provider Specialty", "Loop 2000A should contain a PRV segment with provider taxonomy code."),
    },
    "2010AA": {
        "NM1": ("NM1 - Billing Provider Name", "Loop 2010AA must contain an NM1 segment identifying the billing provider."),
        "N3":  ("N3 - Billing Provider Address", "Loop 2010AA must contain an N3 segment with the billing provider's street address."),
        "N4":  ("N4 - Billing Provider City/State/ZIP", "Loop 2010AA must contain an N4 segment with city, state, and ZIP."),
        "REF": ("REF - Billing Provider Tax ID", "Loop 2010AA must contain a REF segment with the provider's EIN or SSN (REF01=EI or SY)."),
    },
    "2000B": {
        "HL":  ("HL - Subscriber Hierarchical Level", "Loop 2000B must contain an HL segment with level code 22."),
        "SBR": ("SBR - Subscriber Information", "Loop 2000B must contain an SBR segment identifying subscriber relationship and payer."),
    },
    "2010BA": {
        "NM1": ("NM1 - Subscriber Name", "Loop 2010BA must contain an NM1 segment identifying the subscriber."),
        "N3":  ("N3 - Subscriber Address", "Loop 2010BA must contain an N3 segment with the subscriber's address."),
        "N4":  ("N4 - Subscriber City/State/ZIP", "Loop 2010BA must contain an N4 segment."),
        "DMG": ("DMG - Subscriber Demographics", "Loop 2010BA must contain a DMG segment with DOB and gender."),
    },
    "2010BB": {
        "NM1": ("NM1 - Payer Name", "Loop 2010BB must contain an NM1 segment identifying the payer."),
    },
    "2000C": {
        "HL":  ("HL - Patient Hierarchical Level", "Loop 2000C must contain an HL segment with level code 23."),
        "PAT": ("PAT - Patient Information", "Loop 2000C must contain a PAT segment with patient relationship code."),
    },
    "2010CA": {
        "NM1": ("NM1 - Patient Name", "Loop 2010CA must contain an NM1 segment identifying the patient."),
        "N3":  ("N3 - Patient Address", "Loop 2010CA must contain an N3 address segment."),
        "N4":  ("N4 - Patient City/State/ZIP", "Loop 2010CA must contain an N4 segment."),
        "DMG": ("DMG - Patient Demographics", "Loop 2010CA must contain a DMG segment with DOB and gender."),
    },
    "2300": {
        "CLM": ("CLM - Claim Information", "Loop 2300 must contain a CLM segment with patient control number and charge amount."),
        "HI":  ("HI - Diagnosis Codes", "Loop 2300 must contain at least one HI segment with ICD-10-CM diagnosis codes."),
        "DTP": ("DTP - Service Date", "Loop 2300 must contain a DTP segment with the date of service (qualifier 472)."),
    },
    "2310B": {
        "NM1": ("NM1 - Rendering Provider Name", "Loop 2310B must contain an NM1 segment identifying the rendering provider (NM101=82)."),
    },
    "2400": {
        "LX":  ("LX - Service Line Number", "Loop 2400 must begin with an LX segment."),
        "SV1": ("SV1 - Professional Service (837P)", "Loop 2400 must contain an SV1 segment with procedure code and charge (837P)."),
        "SV2": ("SV2 - Institutional Service (837I)", "Loop 2400 must contain an SV2 segment with procedure code and charge (837I)."),
        "DTP": ("DTP - Service Line Date", "Loop 2400 must contain a DTP segment with service date (qualifier 472)."),
    },

    # ── 835 specific ────────────────────────────────────────────────────────
    "835_HEADER": {
        "BPR": ("BPR - Financial Information", "835 transactions must contain a BPR segment with payment amount and method."),
        "TRN": ("TRN - Reassociation Trace Number", "835 transactions must contain a TRN segment with the check/EFT trace number."),
    },
    "835_1000A": {
        "N1":  ("N1 - Payer Identification", "Loop 1000A in 835 must contain an N1 segment identifying the payer (N101=PR)."),
    },
    "835_1000B": {
        "N1":  ("N1 - Payee Identification", "Loop 1000B in 835 must contain an N1 segment identifying the payee (N101=PE)."),
    },
    "835_2100": {
        "CLP": ("CLP - Claim Payment Information", "Loop 2100 must contain a CLP segment with claim ID, status, amounts."),
        "NM1": ("NM1 - Patient/Insured Name", "Loop 2100 must contain an NM1 segment identifying the patient."),
    },
    "835_2110": {
        "SVC": ("SVC - Service Payment Information", "Loop 2110 must contain an SVC segment with procedure code and paid amount."),
        "CAS": ("CAS - Claim Adjustment", "Loop 2110 should contain CAS segment(s) when paid amount differs from billed."),
        "AMT": ("AMT - Service Supplemental Amount", "Loop 2110 should contain an AMT segment."),
    },

    # ── 834 specific ────────────────────────────────────────────────────────
    "834_HEADER": {
        "BGN": ("BGN - Beginning Segment", "834 transactions must contain a BGN segment with file purpose code and date."),
    },
    "834_1000A": {
        "N1":  ("N1 - Sponsor Name", "Loop 1000A in 834 must contain an N1 segment identifying the sponsor/employer."),
    },
    "834_1000B": {
        "N1":  ("N1 - Payer Name", "Loop 1000B in 834 must contain an N1 segment identifying the insurance carrier."),
    },
    "834_2000": {
        "INS": ("INS - Insured Benefit", "Loop 2000 must contain an INS segment with maintenance type and relationship codes."),
        "REF": ("REF - Subscriber Identifier", "Loop 2000 must contain a REF segment with member ID (REF01=0F)."),
        "DTP": ("DTP - Maintenance Effective Date", "Loop 2000 must contain a DTP segment with the coverage effective date (qualifier 356)."),
    },
    "834_2100A": {
        "NM1": ("NM1 - Member Name", "Loop 2100A must contain an NM1 segment identifying the insured member."),
        "N3":  ("N3 - Member Address", "Loop 2100A must contain an N3 address segment."),
        "N4":  ("N4 - Member City/State/ZIP", "Loop 2100A must contain an N4 segment."),
        "DMG": ("DMG - Member Demographics", "Loop 2100A must contain a DMG segment with DOB and gender."),
    },
    "834_2300": {
        "HD":  ("HD - Health Coverage", "Loop 2300 must contain an HD segment with insurance line and coverage type."),
        "DTP": ("DTP - Coverage Dates", "Loop 2300 must contain DTP segment(s) with begin/end coverage dates."),
    },
}

# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class EDIParser:
    _VALID_CAS_GROUP_CODES = {"CO", "OA", "PI", "PR"}
    _NPI_QUALIFIER         = "XX"

    def __init__(self, file_path: str):
        self.file_path      = file_path
        self.segment_sep    = "~"
        self.element_sep    = "*"
        self.subelement_sep = ":"

        self.metadata: dict = {}
        self.schema:   dict = {}
        self.schemas:  dict = {}

        self.errors:   list = []
        self.warnings: list = []

        self.metrics = {
            "total_segments":    0,
            "total_providers":   0,
            "total_subscribers": 0,
            "total_claims":      0,
            "total_services":    0,
        }

        self.loop_stack:     list = []
        self.segment_counts: dict = {}

        # Envelope tracking
        self.isa_control = None
        self.gs_control  = None
        self.st_control  = None

        # AST state pointers
        self.hl_nodes:             dict = {}
        self.current_transaction        = None
        self.current_hl_node            = None
        self.current_claim              = None
        self.current_service_line       = None
        self.current_member             = None
        self.current_loop_id            = None
        self.current_loop_instance      = None
        
        # Reconciliation helpers
        self._claim_amounts:      dict = {}   
        self._claim_dob:          dict = {}   
        self._claim_service_date: dict = {}   
        self._pending_clm_amount       = None
        self._pending_ins_line         = None

        # 834 duplicate detection
        self._member_registry: dict = {}

        # Presence tracking
        self._loop_segments_seen: dict = {}
        self._open_loops: list = []
        self._closed_loops: list = []

        # 835 CLP reconciliation
        self._clp_records: dict = {}
        self._pending_clp  = None   
        self._pending_svc  = None   

        # Reference data
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self._ref  = ReferenceData(os.path.abspath(os.path.join(script_dir, "..")))

    # =========================================================================
    # 2. STREAMING LEXER
    # =========================================================================
    def stream_and_tokenize(self):
        """Streams segment by segment, reading the file EXACTLY ONCE."""
        with open(self.file_path, "r", encoding="utf-8") as f:
            head = f.read(500).replace("\n", "").replace("\r", "")
            isa_start = head.find("ISA")
            
            if isa_start == -1 or len(head) < isa_start + 106:
                self.errors.append({
                    "line": 1, "segment": "ISA", "type": "Critical",
                    "message": "File does not contain a valid 106-character ISA envelope.",
                    "suggestion": "Ensure the file begins with a strictly formatted 106-character ISA segment.",
                })
                return

            isa_string = head[isa_start:isa_start+106]
            
            self.element_sep    = isa_string[3]   
            self.subelement_sep = isa_string[104] 
            self.segment_sep    = isa_string[105] 

            f.seek(0)
            buffer = ""
            while True:
                chunk = f.read(4096)
                if not chunk:
                    if buffer.strip():
                        yield buffer.strip().split(self.element_sep)
                    break
                buffer += chunk.replace("\n", "").replace("\r", "")
                while self.segment_sep in buffer:
                    segment, buffer = buffer.split(self.segment_sep, 1)
                    segment = segment.strip()
                    if segment:
                        yield segment.split(self.element_sep)

    # =========================================================================
    # 3. SCHEMA LOADER
    # =========================================================================
    def load_schema(self, filename: str):
        script_dir  = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(script_dir, "..", "schemas", filename)
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                self.schema  = json.load(f)
            self.schemas = self.schema.get("components", {}).get("schemas", {})
        except Exception:
            pass

    def determine_schema_filename(self):
        txn  = self.metadata.get("transaction_type", "")
        impl = self.metadata.get("implementation_reference", "")
        if txn == "834": return "834.json"
        if txn == "835": return "835.json"
        if txn == "837":
            if "X222" in impl: return "837p.json"
            if "X223" in impl: return "837i.json"
            return "837p.json"
        return None

    # =========================================================================
    # 4. COMPLETE STATE MACHINE
    # =========================================================================
    def update_loop_state(self, seg_id: str, elements: list, line: int):
        txn = self.metadata.get("transaction_type", "")

        if seg_id == "ISA":
            self._push_loop("HEADER", line)

        if self._open_loops:
            self._open_loops[-1]["seen"].add(seg_id)

        if seg_id == "ST":
            self._ensure_loop("HEADER", line)
            return

        if seg_id in ("SE", "GE", "IEA"):
            self._close_all_loops(line)
            self.loop_stack = []
            return

        if txn == "837":
            self._update_837_loops(seg_id, elements, line)
        elif txn == "835":
            self._update_835_loops(seg_id, elements, line)
        elif txn == "834":
            self._update_834_loops(seg_id, elements, line)
        else:
            self._update_generic_loops(seg_id, elements, line)

    def _update_837_loops(self, seg_id, elements, line):
        entity = elements[1].strip() if seg_id == "NM1" and len(elements) > 1 else ""

        if seg_id == "BHT":
            self._ensure_loop("HEADER", line)

        elif seg_id == "NM1":
            nm1_map = {
                "41": ("1000A", True),   
                "40": ("1000B", True),   
                "85": ("2010AA", True),  
                "87": ("2010AB", True),  
                "IL": ("2010BA", True),  
                "PR": ("2010BB", True),  
                "QC": ("2010CA", True),  
                "74": ("2010CB", True),  
                "82": (None, False),     
                "71": (None, False),     # Attending — context-dependent
                "77": ("2310A", True),   
                "DN": ("2310A", True),   
                "P3": ("2310E", True),   
                "72": ("2310F", True),   
                "1P": ("2420B", True),   
                "45": ("2420C", True),   
                "FA": ("2420D", True),   
                "PW": ("2420E", True),   
                "QB": ("2420F", True),   
                "HK": ("2420G", True),   
            }
            if entity in nm1_map:
                loop_id, should_push = nm1_map[entity]
                
                # Context determines 2310x vs 2420x
                if entity in ("82", "71"):
                    if "2400" in self.loop_stack:
                        self._push_loop("2420A", line)
                    elif "2300" in self.loop_stack:
                        target_loop = "2310A" if entity == "71" else "2310B"
                        self._push_loop(target_loop, line)
                elif loop_id and should_push:
                    self._push_loop(loop_id, line)
                    
                if self._open_loops:
                    self._open_loops[-1]["seen"].add("NM1")

        elif seg_id == "HL":
            level = elements[3].strip() if len(elements) > 3 else ""
            level_map = {
                "20": "2000A",   
                "22": "2000B",   
                "23": "2000C",   
                "PT": "2000D",   
            }
            if level in level_map:
                self._close_loops_at_or_above("2000A", line)
                self._push_loop(level_map[level], line)
                if self._open_loops:
                    self._open_loops[-1]["seen"].add("HL")

        elif seg_id == "SBR":
            self._ensure_loop("2000B", line)

        elif seg_id == "PAT":
            self._ensure_loop("2000C", line)

        elif seg_id == "CLM":
            self._close_loops_below("2000B", line)
            self._push_loop("2300", line)
            if self._open_loops:
                self._open_loops[-1]["seen"].add("CLM")

        elif seg_id == "LX":
            self._close_loops_at_or_above("2400", line)
            self._push_loop("2400", line)
            if self._open_loops:
                self._open_loops[-1]["seen"].add("LX")

        elif seg_id == "SV1":
            self._ensure_loop("2400", line)

        elif seg_id == "SV2":
            self._ensure_loop("2400", line)

        elif seg_id == "PWK":
            if "2400" in self.loop_stack:
                self._push_loop("2430", line)
            elif "2300" in self.loop_stack:
                self._push_loop("2320", line)

        elif seg_id == "SBR" and "2300" in self.loop_stack:
            self._push_loop("2320", line)

    def _update_835_loops(self, seg_id, elements, line):
        entity = elements[1].strip() if seg_id == "N1" and len(elements) > 1 else ""

        if seg_id == "BPR":
            self._ensure_loop("835_HEADER", line)

        elif seg_id == "N1":
            self._close_loops_at_or_above("835_HEADER", line)
            if entity == "PR":
                self._push_loop("835_1000A", line)
            elif entity == "PE":
                self._push_loop("835_1000B", line)

        elif seg_id == "LX":
            self._push_loop("835_2000", line)

        elif seg_id == "CLP":
            self._close_loops_at_or_above("835_2100", line)
            self._push_loop("835_2100", line)

        elif seg_id == "SVC":
            self._close_loops_at_or_above("835_2110", line)
            self._push_loop("835_2110", line)

    def _update_834_loops(self, seg_id, elements, line):
        entity = elements[1].strip() if seg_id == "N1" and len(elements) > 1 else ""
        qual   = elements[1].strip() if seg_id == "NM1" and len(elements) > 1 else ""

        if seg_id == "BGN":
            self._ensure_loop("834_HEADER", line)

        elif seg_id == "N1":
            n1_map = {
                "P5": "834_1000A",  
                "IN": "834_1000B",  
                "TV": "834_1000C",  
            }
            if entity in n1_map:
                self._push_loop(n1_map[entity], line)

        elif seg_id == "INS":
            self._close_loops_at_or_above("834_2000", line)
            self._push_loop("834_2000", line)

        elif seg_id == "NM1":
            nm1_834 = {
                "IL": "834_2100A",  
                "70": "834_2100B",  
                "36": "834_2100C",  
                "M8": "834_2100D",  
                "S3": "834_2100E",  
                "7C": "834_2100F",  
                "GW": "834_2100G",  
                "9K": "834_2100H",  
            }
            if qual in nm1_834:
                self._push_loop(nm1_834[qual], line)

        elif seg_id == "HD":
            self._push_loop("834_2300", line)

        elif seg_id == "COB":
            self._push_loop("834_2320", line)

        elif seg_id == "LX":
            self._push_loop("834_2700", line)

    def _update_generic_loops(self, seg_id, elements, line):
        if seg_id == "HL":
            level = elements[3].strip() if len(elements) > 3 else ""
            lmap  = {"20": "2000A", "22": "2000B", "23": "2000C"}
            if level in lmap:
                self._close_loops_at_or_above("2000A", line)
                self._push_loop(lmap[level], line)
        elif seg_id == "CLM":
            self._push_loop("2300", line)
        elif seg_id == "LX":
            self._push_loop("2400", line)

    # ── Loop stack helpers ───────────────────────────────────────────────────

    def _push_loop(self, loop_id: str, line: int):
        if self.loop_stack and self.loop_stack[-1] == loop_id:
            return
        if loop_id in self.loop_stack:
            idx = len(self.loop_stack) - 1 - self.loop_stack[::-1].index(loop_id)
            self._close_loops_from_index(idx, line)
        self.loop_stack.append(loop_id)
        self._open_loop(loop_id, line)

    def _ensure_loop(self, loop_id: str, line: int):
        if loop_id not in self.loop_stack:
            self.loop_stack.append(loop_id)
            self._open_loop(loop_id, line)

    def _open_loop(self, loop_id: str, line: int):
        self._open_loops.append({"loop_id": loop_id, "start_line": line, "seen": set()})

    def _close_loops_at_or_above(self, loop_id: str, line: int):
        # SAFETY CHECK to prevent emptying stack if loop isn't active
        if loop_id not in self.loop_stack:
            return
        while self.loop_stack:
            top = self.loop_stack[-1]
            self._close_top_loop(line)
            if top == loop_id:
                break

    def _close_loops_below(self, loop_id: str, line: int):
        # SAFETY CHECK to prevent emptying stack if loop isn't active
        if loop_id not in self.loop_stack:
            return
        while self.loop_stack and self.loop_stack[-1] != loop_id:
            self._close_top_loop(line)

    def _close_loops_from_index(self, idx: int, line: int):
        while len(self.loop_stack) > idx:
            self._close_top_loop(line)

    def _close_top_loop(self, line: int):
        if not self.loop_stack:
            return
        loop_id = self.loop_stack.pop()
        if self._open_loops:
            record = self._open_loops.pop()
            self._closed_loops.append(record)

    def _close_all_loops(self, line: int):
        while self.loop_stack:
            self._close_top_loop(line)

    def get_current_loop(self) -> str:
        return self.loop_stack[-1] if self.loop_stack else None

    # =========================================================================
    # 5. LAYER-3 PRESENCE CHECKER
    # =========================================================================
    def check_required_segments(self):
        txn = self.metadata.get("transaction_type", "")

        for record in self._closed_loops:
            loop_id    = record["loop_id"]
            seen       = record["seen"]
            start_line = record["start_line"]

            rule_key = loop_id

            if txn == "835" and not loop_id.startswith("835_"):
                if loop_id == "HEADER":
                    rule_key = "835_HEADER"

            if txn == "834":
                if loop_id == "HEADER":
                    rule_key = "834_HEADER"

            rules = REQUIRED_SEGMENTS.get(rule_key, {})
            if not rules:
                continue

            for req_seg, (human_name, suggestion) in rules.items():
                if req_seg not in seen:
                    if req_seg == "SV1" and txn == "837":
                        impl = self.metadata.get("implementation_reference", "")
                        if "X223" in impl:  
                            continue
                    if req_seg == "SV2" and txn == "837":
                        impl = self.metadata.get("implementation_reference", "")
                        if "X222" in impl:  
                            continue
                    if req_seg == "PRV" and loop_id == "2000A":
                        self.warnings.append({
                            "line":       start_line,
                            "segment":    req_seg,
                            "field":      "N/A",
                            "type":       "MissingSegment_Situational",
                            "loop":       loop_id,
                            "message":    f"Loop {loop_id}: {human_name} was not found. This is situationally required.",
                            "suggestion": suggestion,
                        })
                        continue

                    self.errors.append({
                        "line":       start_line,
                        "segment":    req_seg,
                        "field":      "N/A",
                        "type":       "MissingRequiredSegment",
                        "loop":       loop_id,
                        "message":    f"Loop {loop_id}: Required segment {human_name} was not found. Loop started at segment line {start_line}.",
                        "suggestion": suggestion,
                    })

    # =========================================================================
    # 6. LAYER-1 DOMAIN VALIDATORS
    # =========================================================================

    @staticmethod
    def _luhn_checksum(number_str: str) -> int:
        digits = [int(d) for d in number_str]
        for i in range(len(digits) - 2, -1, -2):
            digits[i] *= 2
            if digits[i] > 9:
                digits[i] -= 9
        return sum(digits) % 10

    def validate_npi(self, npi: str, line: int, segment: str) -> bool:
        loop = self.get_current_loop()
        if not npi or not npi.isdigit() or len(npi) != 10:
            self.errors.append({
                "line": line, "segment": segment, "field": "NM109",
                "type": "InvalidNPI", "loop": loop,
                "message": f"NPI '{npi}' must be exactly 10 numeric digits.",
                "suggestion": "Verify the NPI at https://npiregistry.cms.hhs.gov/",
            })
            return False
        if self._luhn_checksum("80840" + npi) != 0:
            self.errors.append({
                "line": line, "segment": segment, "field": "NM109",
                "type": "InvalidNPI", "loop": loop,
                "message": f"NPI '{npi}' fails the Luhn checksum (CMS '80840' prefix). The identifier is structurally invalid.",
                "suggestion": "Verify the correct NPI at https://npiregistry.cms.hhs.gov/",
            })
            return False
        return True

    def validate_date(self, date_str: str, line: int, segment: str,
                      field: str = "date") -> "datetime | None":
        if not date_str:
            return None
        loop = self.get_current_loop()
        if len(date_str) != 8 or not date_str.isdigit():
            self.errors.append({
                "line": line, "segment": segment, "field": field,
                "type": "InvalidDateFormat", "loop": loop,
                "message": f"Date '{date_str}' must be 8 digits in CCYYMMDD format.",
                "suggestion": "Reformat as CCYYMMDD (e.g., 20240315).",
            })
            return None
        try:
            return datetime.strptime(date_str, "%Y%m%d")
        except ValueError:
            self.errors.append({
                "line": line, "segment": segment, "field": field,
                "type": "InvalidDateValue", "loop": loop,
                "message": f"Date '{date_str}' is not a real calendar date.",
                "suggestion": "Correct the month (01-12) and day values.",
            })
            return None

    def validate_zip(self, zip_code: str, line: int, segment: str,
                     field: str = "N403") -> bool:
        if not zip_code:
            return True
        clean = zip_code.replace("-", "")
        if re.fullmatch(r"\d{5}|\d{9}", clean):
            return True
        self.errors.append({
            "line": line, "segment": segment, "field": field,
            "type": "InvalidZIP", "loop": self.get_current_loop(),
            "message": f"ZIP code '{zip_code}' must be 5 digits or ZIP+4.",
            "suggestion": "Use format 12345 or 12345-6789.",
        })
        return False

    def validate_cpt_hcpcs_format(self, code: str, qualifier: str,
                                   line: int, segment: str) -> bool:
        if not code:
            return True
        if (re.fullmatch(r"\d{5}[A-Z0-9]{0,2}", code) or
                re.fullmatch(r"[A-Z]\d{4}", code)):
            return True
        self.errors.append({
            "line": line, "segment": segment, "field": "SV101",
            "type": "InvalidCPT_HCPCS_Format", "loop": self.get_current_loop(),
            "message": f"Procedure code '{code}' (qualifier '{qualifier}') has invalid format. CPT = 5 digits; HCPCS Level II = letter + 4 digits.",
            "suggestion": "Verify in AMA CPT book or CMS HCPCS quarterly update.",
        })
        return False

    def _validate_cas_group_code(self, group_code: str, field: str, line: int) -> bool:
        if group_code in self._VALID_CAS_GROUP_CODES:
            return True
        self.errors.append({
            "line": line, "segment": "CAS", "field": field,
            "type": "InvalidCASGroupCode", "loop": self.get_current_loop(),
            "message": f"CAS group code '{group_code}' is invalid. Valid values: {sorted(self._VALID_CAS_GROUP_CODES)}.",
            "suggestion": "CO=Contractual, OA=Other, PI=Payer Initiated, PR=Patient Responsibility.",
        })
        return False

    # =========================================================================
    # 7. LAYER-2 CODESET VALIDATORS
    # =========================================================================

    def _codeset_check(self, key, value, line, segment, field, error_type,
                       human_name, suggestion):
        result = self._ref.check(key, value)
        if result == "invalid":
            self.errors.append({
                "line": line, "segment": segment, "field": field,
                "type": error_type, "loop": self.get_current_loop(),
                "message": f"{human_name} '{value}' not found in reference code set (version: {self._ref.versions.get(key, 'unknown')}).",
                "suggestion": suggestion,
            })
        elif result == "unknown":
            self.warnings.append({
                "line": line, "segment": segment, "field": field,
                "type": f"{error_type}_Unverified", "loop": self.get_current_loop(),
                "message": f"Cannot verify {human_name} '{value}': reference file '{self._ref._FILENAMES[key]}' not loaded.",
                "suggestion": f"Run build_reference_data.py to enable full codeset validation.",
            })

    def validate_carc(self, code, line, segment, field):
        self._codeset_check("carc", code, line, segment, field, "InvalidCARC",
            "CARC reason code", "See https://x12.org/codes/claim-adjustment-reason-codes")

    def validate_rarc(self, code, line, segment, field):
        self._codeset_check("rarc", code, line, segment, field, "InvalidRARC",
            "RARC remark code", "See https://x12.org/codes/remittance-advice-remark-codes")

    def validate_icd10(self, code, line, segment, field):
        clean = code.replace(".", "")
        if not re.fullmatch(r"[A-Z]\d{2}[A-Z0-9]{0,4}", clean, re.IGNORECASE):
            self.errors.append({
                "line": line, "segment": segment, "field": field,
                "type": "InvalidICD10Format", "loop": self.get_current_loop(),
                "message": f"ICD-10-CM code '{code}' has invalid format.",
                "suggestion": "Verify in the CMS ICD-10-CM tabular list.",
            })
            return
        self._codeset_check("icd10", clean.upper(), line, segment, field,
            "InvalidICD10", "ICD-10-CM diagnosis code", "Verify at https://www.cms.gov/medicare/coding-billing/icd-10-codes")

    def validate_cpt_existence(self, code, line, segment, field):
        if re.fullmatch(r"\d{5}", code):
            self._codeset_check("cpt", code, line, segment, field,
                "InvalidCPT", "CPT procedure code", "Verify in the current AMA CPT code set.")
        elif re.fullmatch(r"[A-Z]\d{4}", code):
            self._codeset_check("hcpcs", code, line, segment, field,
                "InvalidHCPCS", "HCPCS Level II code", "Verify at https://www.cms.gov/medicare/coding-billing/HCPCS")

    # =========================================================================
    # 8. SEGMENT-LEVEL VALIDATION DISPATCHER
    # =========================================================================
    def _run_domain_validations(self, seg_id: str, elements: list, line: int):

        if seg_id == "NM1":
            qualifier = elements[8].strip() if len(elements) > 8 else ""
            npi       = elements[9].strip() if len(elements) > 9 else ""
            if qualifier == self._NPI_QUALIFIER and npi:
                self.validate_npi(npi, line, seg_id)
            if len(elements) <= 8 or not elements[8].strip():
                self.warnings.append({
                    "line": line, "segment": "NM1", "type": "SituationalWarning",
                    "loop": self.get_current_loop(),
                    "message": "NM108/09 identifier missing. Verify with trading partner.",
                })

        elif seg_id == "DTP":
            qualifier   = elements[1].strip() if len(elements) > 1 else ""
            format_code = elements[2].strip() if len(elements) > 2 else ""
            date_val    = elements[3].strip() if len(elements) > 3 else ""
            if format_code == "D8" and date_val:
                dt = self.validate_date(date_val, line, seg_id,
                                        field=f"DTP03({qualifier})")
                
                # Context-aware date assignment for Claims vs Service Lines
                current_loop = self.get_current_loop()
                if qualifier == "472" and self.current_claim is not None and dt:
                    cid = id(self.current_claim)
                    if current_loop == "2300":
                        self._claim_service_date[cid] = dt
                    elif current_loop == "2400" and cid not in self._claim_service_date:
                        # Fallback: if 2300 DTP was skipped, use first 2400 date
                        self._claim_service_date[cid] = dt

        elif seg_id == "DMG":
            format_code = elements[1].strip() if len(elements) > 1 else ""
            date_val    = elements[2].strip() if len(elements) > 2 else ""
            if format_code == "D8" and date_val:
                dt = self.validate_date(date_val, line, seg_id, field="DMG02(DOB)")
                if dt is not None and self.current_claim is not None:
                    self._claim_dob[id(self.current_claim)] = dt

        elif seg_id == "N4":
            zip_code = elements[3].strip() if len(elements) > 3 else ""
            if zip_code:
                self.validate_zip(zip_code, line, seg_id)

        elif seg_id == "SV1":
            composite = elements[1].strip() if len(elements) > 1 else ""
            parts     = composite.split(self.subelement_sep)
            qualifier = parts[0] if parts else ""
            code      = parts[1] if len(parts) > 1 else ""
            if qualifier in ("HC", "HP", "WK", "NU"):
                if self.validate_cpt_hcpcs_format(code, qualifier, line, seg_id):
                    self.validate_cpt_existence(code, line, seg_id, "SV101")
            amt_str = elements[2].strip() if len(elements) > 2 else "0"
            try:
                amt = float(amt_str)
            except ValueError:
                amt = 0.0
                self.errors.append({
                    "line": line, "segment": "SV1", "field": "SV102",
                    "type": "InvalidAmount", "loop": self.get_current_loop(),
                    "message": f"Service line charge '{amt_str}' is not a valid number.",
                    "suggestion": "Provide a numeric dollar amount (e.g., 125.00).",
                })
            if self.current_claim is not None:
                cid = id(self.current_claim)
                self._claim_amounts.setdefault(
                    cid, {"node": self.current_claim, "claimed": None, "services": []})
                self._claim_amounts[cid]["services"].append(amt)

        elif seg_id == "SV2":
            # SV203 is the line item charge amount for 837I
            amt_str = elements[3].strip() if len(elements) > 3 else "0"
            try:
                amt = float(amt_str)
            except ValueError:
                amt = 0.0
                self.errors.append({
                    "line": line, "segment": "SV2", "field": "SV203",
                    "type": "InvalidAmount", "loop": self.get_current_loop(),
                    "message": f"Service line charge '{amt_str}' is not a valid number.",
                    "suggestion": "Provide a numeric dollar amount (e.g., 125.00).",
                })
            
            if self.current_claim is not None:
                cid = id(self.current_claim)
                self._claim_amounts.setdefault(
                    cid, {"node": self.current_claim, "claimed": None, "services": []})
                self._claim_amounts[cid]["services"].append(amt)

        elif seg_id == "CLM":
            amt_str = elements[2].strip() if len(elements) > 2 else ""
            self.current_claim = {
                "Segment_ID": "CLM",
                "PatientControlNumber_01": elements[1].strip() if len(elements) > 1 else "",
            }
            self.metrics["total_claims"] += 1
            if not amt_str:
                self.errors.append({
                    "line": line, "segment": "CLM", "field": "CLM02",
                    "type": "MissingClaimAmount", "loop": self.get_current_loop(),
                    "message": "CLM02 (Total Claim Charge Amount) is missing or empty.",
                    "suggestion": "Populate CLM02 with the total billed charge.",
                })
                self._pending_clm_amount = (line, None)
            else:
                try:
                    self._pending_clm_amount = (line, float(amt_str))
                except ValueError:
                    self.errors.append({
                        "line": line, "segment": "CLM", "field": "CLM02",
                        "type": "InvalidAmount", "loop": self.get_current_loop(),
                        "message": f"CLM02 total charge '{amt_str}' is not numeric.",
                        "suggestion": "Provide a numeric dollar amount (e.g., 1500.00).",
                    })
                    self._pending_clm_amount = (line, None)
            if self._pending_clm_amount:
                _ln, amt = self._pending_clm_amount
                cid = id(self.current_claim)
                self._claim_amounts.setdefault(
                    cid, {"node": self.current_claim, "claimed": None, "services": []})
                self._claim_amounts[cid]["claimed"] = amt
                self._pending_clm_amount = None

        elif seg_id == "HI":
            for idx in range(1, len(elements)):
                composite = elements[idx].strip()
                if not composite:
                    continue
                parts     = composite.split(self.subelement_sep)
                qualifier = parts[0] if parts else ""
                code      = parts[1].strip() if len(parts) > 1 else ""
                if qualifier in ("ABK", "ABF") and code:
                    self.validate_icd10(code, line, seg_id,
                                        field=f"HI{idx:02d}({qualifier})")

        elif seg_id == "CAS":
            for i in range(1, len(elements) - 2, 3):
                group_code  = elements[i].strip()   if i   < len(elements) else ""
                reason_code = elements[i+1].strip() if i+1 < len(elements) else ""
                amount      = elements[i+2].strip() if i+2 < len(elements) else ""
                if not group_code:
                    break
                self._validate_cas_group_code(group_code, f"CAS{i:02d}", line)
                if reason_code:
                    self.validate_carc(reason_code, line, "CAS", f"CAS{i+1:02d}")
                if amount:
                    try:
                        float(amount)
                    except ValueError:
                        self.errors.append({
                            "line": line, "segment": "CAS", "field": f"CAS{i+2:02d}",
                            "type": "InvalidCASAmount", "loop": self.get_current_loop(),
                            "message": f"CAS amount '{amount}' is not numeric.",
                            "suggestion": "Provide a numeric dollar amount (e.g., 25.00).",
                        })
            
            # ── 835 CLP reconciliation: route CAS adjustments ───────────
            for i in range(1, len(elements) - 2, 3):
                group_code  = elements[i].strip()   if i   < len(elements) else ""
                reason_code = elements[i+1].strip() if i+1 < len(elements) else ""
                amount_str  = elements[i+2].strip() if i+2 < len(elements) else "0"
                if not group_code:
                    break
                try:
                    amt = float(amount_str)
                except ValueError:
                    amt = 0.0
                
                adj = {"group": group_code, "reason": reason_code, "amount": amt}
                if self.get_current_loop() == "835_2110" and self._pending_svc is not None:
                    self._pending_svc["adjustments"].append(adj)
                elif self.get_current_loop() == "835_2100" and self._pending_clp is not None:
                    self._pending_clp["adjustments"].append(adj)

        elif seg_id == "MOA":
            for idx in (2, 3, 4):
                code = elements[idx].strip() if idx < len(elements) else ""
                if code:
                    self.validate_rarc(code, line, "MOA", f"MOA{idx:02d}")

        elif seg_id == "LQ":
            qualifier = elements[1].strip() if len(elements) > 1 else ""
            code      = elements[2].strip() if len(elements) > 2 else ""
            if qualifier == "HE" and code:
                self.validate_rarc(code, line, "LQ", "LQ02")

        elif seg_id == "INS":
            # Clear previous member state before setting new one
            self._pending_ins_line = line

        elif seg_id in ("HD", "LX"):
            # Exiting the REF loop for members
            self._pending_ins_line = None

        elif seg_id == "REF" and self._pending_ins_line:
            ref_qualifier = elements[1].strip() if len(elements) > 1 else ""
            ref_value     = elements[2].strip() if len(elements) > 2 else ""
            if ref_qualifier in ("0F", "1L") and ref_value:
                key = (ref_value, ref_qualifier)
                if key in self._member_registry:
                    self._member_registry[key].append(line)
                else:
                    self._member_registry[key] = [self._pending_ins_line, line]

        # ── 835 CLP: capture payment amounts for reconciliation ──────────────
        elif seg_id == "CLP":
            claim_id     = elements[1].strip() if len(elements) > 1 else "Unknown"
            status_code  = elements[2].strip() if len(elements) > 2 else ""
            billed       = self._safe_float(elements[3]) if len(elements) > 3 else 0.0
            paid         = self._safe_float(elements[4]) if len(elements) > 4 else 0.0
            patient_resp = self._safe_float(elements[5]) if len(elements) > 5 else 0.0
            self._pending_clp = {
                "claim_id":     claim_id,
                "status_code":  status_code,
                "billed":       billed,
                "paid":         paid,
                "patient_resp": patient_resp,
                "adjustments":  [],
                "services":     [],
                "check_number": "",
            }

        elif seg_id == "SVC":
            self._pending_svc = {"adjustments": []}
            if self._pending_clp is not None:
                self._pending_clp["services"].append(self._pending_svc)

        elif seg_id == "TRN":
            # TRN02 = check/EFT reference number
            ref = elements[2].strip() if len(elements) > 2 else ""
            if self._pending_clp is not None:
                self._pending_clp["check_number"] = ref

        elif seg_id == "AMT" and self._pending_clp is not None:
            # AMT01=B6 (allowed), AMT01=KH (deductible), etc.
            qualifier = elements[1].strip() if len(elements) > 1 else ""
            amount    = self._safe_float(elements[2]) if len(elements) > 2 else 0.0
            self._pending_clp.setdefault("supplemental_amounts", {})[qualifier] = amount

    @staticmethod
    def _safe_float(value) -> float:
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return 0.0

    # =========================================================================
    # 9. SEGMENT DECODER
    # =========================================================================
    def decode_and_validate(self, raw_elements: list, line: int) -> dict:
        segment_id   = raw_elements[0]
        current_loop = self.get_current_loop()

        self._run_domain_validations(segment_id, raw_elements, line)

        target_schema = segment_id
        if segment_id == "NM1":
            ctx = {
                "1000A":  "NM1_SubmitterName",
                "1000B":  "NM1_ReceiverName",
                "2010AA": "NM1_BillingProviderName",
                "2010AB": "NM1_PayToProviderName",
                "2010BA": "NM1_SubscriberName",
                "2010BB": "NM1_PayerName",
                "2010CA": "NM1_PatientName",
                "2310A":  "NM1_ReferringProviderName",
                "2310B":  "NM1_RenderingProviderName",
                "2420A":  "NM1_RenderingProviderName"
            }
            target_schema = ctx.get(current_loop, segment_id)

        schema_key = next(
            (k for k in self.schemas if k.startswith(target_schema + "_")), None)
        if not schema_key:
            return {"Segment_ID": segment_id, "raw_data": raw_elements}

        properties = self.schemas[schema_key].get("properties", {})
        decoded    = {"Segment_ID": segment_id}

        for prop, prop_details in properties.items():
            try:
                index = int(prop.split("_")[-1])
                if index < len(raw_elements):
                    value = raw_elements[index].strip()
                    if value:
                        if self.subelement_sep in value:
                            decoded[prop] = value.split(self.subelement_sep)
                        else:
                            decoded[prop] = value
                            max_len = prop_details.get("maxLength")
                            min_len = prop_details.get("minLength")
                            if max_len and len(value) > max_len:
                                self.errors.append({
                                    "line": line, "segment": segment_id, "field": prop,
                                    "type": "LengthExceeded",
                                    "message": f"'{value}' exceeds max length of {max_len}.",
                                    "suggestion": f"Truncate to {max_len} characters.",
                                })
                            if min_len and len(value) < min_len:
                                self.errors.append({
                                    "line": line, "segment": segment_id, "field": prop,
                                    "type": "LengthBelowMin",
                                    "message": f"'{value}' below min length of {min_len}.",
                                    "suggestion": f"Pad to at least {min_len} characters.",
                                })
            except Exception:
                pass

        return decoded

    def validate_envelope(self, seg_id: str, elements: list, line: int):
        if seg_id == "ISA":
            self.isa_control = elements[13] if len(elements) > 13 else None
        elif seg_id == "IEA":
            iea = elements[2] if len(elements) > 2 else None
            if self.isa_control != iea:
                self.errors.append({
                    "line": line, "segment": "IEA", "type": "EnvelopeMismatch",
                    "message": f"ISA13 ({self.isa_control}) ≠ IEA02 ({iea}).",
                    "suggestion": "IEA02 must exactly match ISA13.",
                })
        elif seg_id == "GS":
            self.gs_control = elements[6] if len(elements) > 6 else None
        elif seg_id == "GE":
            ge = elements[2] if len(elements) > 2 else None
            if self.gs_control != ge:
                self.errors.append({
                    "line": line, "segment": "GE", "type": "EnvelopeMismatch",
                    "message": f"GS06 ({self.gs_control}) ≠ GE02 ({ge}).",
                    "suggestion": "GE02 must exactly match GS06.",
                })
        elif seg_id == "ST":
            self.st_control = elements[2] if len(elements) > 2 else None
        elif seg_id == "SE":
            se = elements[2] if len(elements) > 2 else None
            if self.st_control != se:
                self.errors.append({
                    "line": line, "segment": "SE", "type": "EnvelopeMismatch",
                    "message": f"ST03 ({self.st_control}) ≠ SE02 ({se}).",
                    "suggestion": "SE02 must exactly match ST03.",
                })

    # =========================================================================
    # 10. AST (TREE) BUILDER
    # =========================================================================
    def attach_to_tree(self, decoded: dict, seg_id: str, tree: dict):
        if seg_id in ("ISA", "GS", "ST", "SE", "GE", "IEA"):
            tree["envelope"][seg_id] = decoded
            return

        current_loop = self.get_current_loop() or "UNASSIGNED"
    
        is_new_instance = (
            current_loop != self.current_loop_id
            or seg_id in ("NM1", "HL", "CLM", "LX", "INS")
        )
    
        if is_new_instance:
            self.current_loop_id = current_loop
            self.current_loop_instance = {}
            tree["loops"].setdefault(current_loop, []).append(self.current_loop_instance)
    
        if self.current_loop_instance is None:
            self.current_loop_instance = {}
            tree["loops"].setdefault(current_loop, []).append(self.current_loop_instance)
    
        if seg_id in self.current_loop_instance:
            existing = self.current_loop_instance[seg_id]
            if isinstance(existing, list):
                existing.append(decoded)
            else:
                self.current_loop_instance[seg_id] = [existing, decoded]
        else:
            self.current_loop_instance[seg_id] = decoded
            if seg_id in ("ISA", "GS", "ST", "SE", "GE", "IEA"):
                tree["envelope"][seg_id] = decoded
                return
    
            current_loop = self.get_current_loop() or "UNASSIGNED"
    
            is_new_instance = (
                current_loop != self.current_loop_id
                or (
                    seg_id == "HL"
                    or seg_id == "CLM"
                    or seg_id == "LX"
                    or seg_id == "INS"
                    or (seg_id == "NM1" and current_loop in ("1000A", "1000B", "2010AA", "2010BA", "2010BB", "2010CA"))
                )  
            )
    
            if is_new_instance:
                self.current_loop_id = current_loop
                self.current_loop_instance = {}
                tree["loops"].setdefault(current_loop, []).append(self.current_loop_instance)

    # =========================================================================
    # 11. LAYER-4 POST-PARSE RECONCILIATION
    # =========================================================================

    def reconcile_claim_amounts(self):
        for cid, entry in self._claim_amounts.items():
            claimed  = entry.get("claimed")
            services = entry.get("services", [])
            if claimed is None or not services:
                continue
            total   = round(sum(services), 2)
            claimed = round(claimed, 2)
            diff    = round(abs(total - claimed), 2)
            if diff > 0.01:
                node     = entry.get("node", {})
                claim_id = (
                    node.get("CLM", {}).get("PatientControlNumber_01")
                    or node.get("PatientControlNumber_01")
                    or "Unknown"
                ) if isinstance(node, dict) else "Unknown"
                self.errors.append({
                    "line": "post-parse", "segment": "CLM", "field": "CLM02",
                    "type": "ClaimAmountMismatch", "loop": "2300/2400",
                    "message": (
                        f"Claim '{claim_id}': CLM02 billed ${claimed:.2f} ≠ "
                        f"sum of service line charges ${total:.2f} (diff ${diff:.2f})."
                    ),
                    "suggestion": "Recalculate CLM02 as the exact sum of all service line amounts.",
                })

    def reconcile_dob_vs_service_date(self):
        for cid in set(self._claim_dob) & set(self._claim_service_date):
            dob      = self._claim_dob[cid]
            svc_date = self._claim_service_date[cid]
            if dob and svc_date and dob >= svc_date:
                self.errors.append({
                    "line": "post-parse", "segment": "DMG/DTP",
                    "field": "DOB vs ServiceDate",
                    "type": "DOBAfterServiceDate", "loop": "2000C/2300",
                    "message": (
                        f"Patient DOB ({dob.strftime('%Y%m%d')}) is on or after "
                        f"service date ({svc_date.strftime('%Y%m%d')})."
                    ),
                    "suggestion": "Verify DMG02 (DOB) and DTP03 (service date) are correct.",
                })

    def detect_duplicate_members(self):
        for (ref_value, ref_qualifier), lines in self._member_registry.items():
            if len(lines) > 1:
                label = "Member ID" if ref_qualifier == "0F" else "Group/Plan Number"
                self.errors.append({
                    "line": lines[0], "segment": "INS/REF", "field": "REF02",
                    "type": "DuplicateMember", "loop": "2000",
                    "message": (
                        f"{label} '{ref_value}' appears {len(lines)} times "
                        f"(first at line {lines[0]})."
                    ),
                    "suggestion": "Remove duplicate INS loops or use maintenance type 001 (Change).",
                })

    def _commit_pending_clp(self):
        if self._pending_clp is None:
            return

        rec      = self._pending_clp
        billed   = rec["billed"]
        paid     = rec["paid"]
        pat_resp = rec["patient_resp"]
        
        # Calculate adjustments across both the claim level and all service lines
        adj_sum_claim = sum(a["amount"] for a in rec["adjustments"])
        adj_sum_svc   = sum(a["amount"] for svc in rec.get("services", []) for a in svc.get("adjustments", []))
        adj_sum       = round(adj_sum_claim + adj_sum_svc, 2)
        
        accounted = round(paid + pat_resp + adj_sum, 2)
        billed_r  = round(billed, 2)

        if billed_r > 0 and abs(accounted - billed_r) > 0.01:
            self.errors.append({
                "line":    "post-parse",
                "segment": "CLP/CAS",
                "field":   "CLP03/CLP04/CLP05",
                "type":    "CLPReconciliationMismatch",
                "loop":    "835_2100",
                "message": (
                    f"835 Claim '{rec['claim_id']}': "
                    f"Billed ${billed_r:.2f} ≠ "
                    f"Paid ${paid:.2f} + "
                    f"Patient Responsibility ${pat_resp:.2f} + "
                    f"Adjustments ${adj_sum:.2f} = ${accounted:.2f} "
                    f"(diff ${abs(accounted - billed_r):.2f})."
                ),
                "suggestion": (
                    "Verify CLP04 (paid amount), CLP05 (patient responsibility), "
                    "and all CAS adjustment amounts. They must sum to CLP03 (billed amount)."
                ),
            })

        self._clp_records[rec["claim_id"]] = rec
        self._pending_clp = None

    def build_remittance_summary(self) -> list:
        summary = []
        for claim_id, rec in self._clp_records.items():
            summary.append({
                "claim_id":               claim_id,
                "status_code":            rec["status_code"],
                "billed":                 rec["billed"],
                "paid":                   rec["paid"],
                "patient_responsibility": rec["patient_resp"],
                "adjustments":            rec["adjustments"],
                "services":               rec.get("services", []),
                "check_eft_number":       rec["check_number"],
                "supplemental":           rec.get("supplemental_amounts", {}),
            })
        return summary

    # =========================================================================
    # 12. MASTER ORCHESTRATOR
    # =========================================================================
    def parse(self) -> dict:
        stream         = self.stream_and_tokenize()
        first_segments = []

        for seg in stream:
            first_segments.append(seg)
            if seg[0] == "ISA":
                self.metadata["sender_id"]      = seg[6].strip()  if len(seg) > 6  else ""
                self.metadata["receiver_id"]    = seg[8].strip()  if len(seg) > 8  else ""
                self.metadata["isa_date"]       = seg[9].strip()  if len(seg) > 9  else ""
                self.metadata["isa_time"]       = seg[10].strip() if len(seg) > 10 else ""
                self.metadata["control_number"] = seg[13].strip() if len(seg) > 13 else ""
            if seg[0] == "GS":
                self.metadata["gs_control"]     = seg[6].strip()  if len(seg) > 6  else ""
                self.metadata["gs_date"]        = seg[4].strip()  if len(seg) > 4  else ""
                self.metadata["gs_time"]        = seg[5].strip()  if len(seg) > 5  else ""
            if seg[0] == "ST":
                self.metadata["transaction_type"] = seg[1].strip() if len(seg) > 1 else ""
                if len(seg) > 3:
                    self.metadata["implementation_reference"] = seg[3].strip()
                break

        schema_file = self.determine_schema_filename()
        if schema_file:
            self.load_schema(schema_file)

        tree = {
            "metadata": self.metadata,
            "envelope": {
                "ISA": {},
                "GS": {},
                "ST": {},
                "SE": {},
                "GE": {},
                "IEA": {},
            },
            "loops": {},
            "errors": self.errors,
            "warnings": self.warnings,
            "metrics": self.metrics,
        }

        full_stream = itertools.chain(first_segments, stream)

        for line, raw_seg in enumerate(full_stream, 1):
            self.metrics["total_segments"] += 1
            seg_id = raw_seg[0]
            self.update_loop_state(seg_id, raw_seg, line)   
            self.validate_envelope(seg_id, raw_seg, line)
            decoded = self.decode_and_validate(raw_seg, line)
            self.attach_to_tree(decoded, seg_id, tree)

        # ── Post-parse passes ────────────────────────────────────────────────
        self._commit_pending_clp()           
        self.reconcile_claim_amounts()       
        self.reconcile_dob_vs_service_date() 
        self.detect_duplicate_members()      
        self.check_required_segments()       

        return tree