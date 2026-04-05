"""
eligibility_scrubber.py
═══════════════════════════════════════════════════════════════════════════════
Two-Stage Eligibility Scrubber for Claims Processing
═══════════════════════════════════════════════════════════════════════════════

STAGE 1: ROSTER BUILDER
  - Ingests multiple 834 files sorted by file creation date
  - Processes maintenance codes (030=Audit, 021=Add, 024=Term)
  - Builds a cumulative member database with coverage periods

STAGE 2: CLAIMS SCRUBBER
  - Takes a single 837 file + the MemberDatabase from Stage 1
  - Validates each claim's date of service against member eligibility
  - Flags: MEMBER_NOT_FOUND, FLAGGED_NOT_YET_EFFECTIVE, FLAGGED_TERMINATED, CLEARED

Date Format: All EDI dates are YYYYMMDD strings (e.g. "20260115")
"""

from datetime import datetime
from typing import Dict, List, Optional, Any


# ═══════════════════════════════════════════════════════════════════════════
# HELPER: Safe date parsing from YYYYMMDD strings
# ═══════════════════════════════════════════════════════════════════════════

def parse_edi_date(date_str: str) -> Optional[datetime]:
    """
    Parse YYYYMMDD EDI date string to datetime object.
    Returns None if invalid or empty.
    """
    if not date_str or len(date_str) != 8:
        return None
    try:
        return datetime.strptime(date_str, "%Y%m%d")
    except ValueError:
        return None


def format_edi_date(date_str: str) -> str:
    """Format YYYYMMDD as YYYY-MM-DD for display."""
    if not date_str or len(date_str) != 8:
        return date_str or "—"
    return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 1: ROSTER BUILDER
# ═══════════════════════════════════════════════════════════════════════════

class MemberRecord:
    """Represents a single member's coverage period in the database."""
    
    def __init__(self, member_id: str, effective_date: str):
        self.member_id = member_id
        self.effective_date = effective_date  # YYYYMMDD
        self.termination_date: Optional[str] = None  # YYYYMMDD or None
        self.name: str = ""
        self.relationship: str = ""
        self.is_subscriber: bool = False
        
    def to_dict(self) -> dict:
        return {
            "member_id": self.member_id,
            "effective_date": self.effective_date,
            "termination_date": self.termination_date,
            "name": self.name,
            "relationship": self.relationship,
            "is_subscriber": self.is_subscriber,
        }


class MemberDatabase:
    """
    In-memory database of all members and their coverage periods.
    Indexed by member_id (REF02 from 834_2000 loop).
    """
    
    def __init__(self):
        self.members: Dict[str, MemberRecord] = {}
        self.total_additions = 0
        self.total_terminations = 0
        self.total_audits = 0
        
    def add_or_update(self, member_id: str, effective_date: str, name: str = "", 
                      relationship: str = "", is_subscriber: bool = False):
        """Add a new member or update effective date if already exists."""
        if member_id in self.members:
            # Update existing record with new effective date (if later)
            existing = self.members[member_id]
            existing_dt = parse_edi_date(existing.effective_date)
            new_dt = parse_edi_date(effective_date)
            if existing_dt and new_dt and new_dt > existing_dt:
                existing.effective_date = effective_date
        else:
            # Create new record
            record = MemberRecord(member_id, effective_date)
            record.name = name
            record.relationship = relationship
            record.is_subscriber = is_subscriber
            self.members[member_id] = record
            self.total_additions += 1
            
    def terminate(self, member_id: str, termination_date: str):
        """Mark a member as terminated with the given date."""
        if member_id in self.members:
            self.members[member_id].termination_date = termination_date
            self.total_terminations += 1
            
    def get(self, member_id: str) -> Optional[MemberRecord]:
        """Retrieve a member record by ID."""
        return self.members.get(member_id)
    
    def get_stats(self) -> dict:
        """Return database statistics."""
        active_count = sum(1 for m in self.members.values() if not m.termination_date)
        terminated_count = sum(1 for m in self.members.values() if m.termination_date)
        return {
            "total_members": len(self.members),
            "active_members": active_count,
            "terminated_members": terminated_count,
            "total_additions_processed": self.total_additions,
            "total_terminations_processed": self.total_terminations,
            "total_audits_processed": self.total_audits,
        }


def build_roster_from_834_files(parsed_834_files: List[dict]) -> MemberDatabase:
    """
    STAGE 1: Build the member roster from multiple 834 files.
    
    Input: List of parsed 834 ASTs (from EDIParser.parse()) sorted by file date.
    Output: MemberDatabase with all coverage periods calculated.
    
    Processing Logic:
      - 030 (Audit/Full File): Add or update member with effective date
      - 021 (Addition): Add new member with effective date
      - 024 (Termination): Set termination date on existing member
    """
    db = MemberDatabase()
    
    for file_ast in parsed_834_files:
        # Unwrap if API response format
        tree = file_ast.get("data", file_ast)
        loops = tree.get("loops", {})
        
        # Get all INS (2000) loops
        ins_instances = loops.get("834_2000", [])
        if not isinstance(ins_instances, list):
            ins_instances = [ins_instances] if ins_instances else []
            
        # Get all NM1 (2100A) loops for names
        nm1_instances = loops.get("834_2100A", [])
        if not isinstance(nm1_instances, list):
            nm1_instances = [nm1_instances] if nm1_instances else []
        
        for i, ins_loop in enumerate(ins_instances):
            ins_seg = ins_loop.get("INS", {})
            ref_seg = ins_loop.get("REF", {})
            dtp_seg = ins_loop.get("DTP", {})
            
            # Extract raw_data fields
            ins_rd = ins_seg.get("raw_data", [])
            ref_rd = ref_seg.get("raw_data", [])
            dtp_rd = dtp_seg.get("raw_data", [])
            
            # Core fields
            is_subscriber = str(ins_rd[1] if len(ins_rd) > 1 else "").strip().upper() == "Y"
            relationship_code = str(ins_rd[2] if len(ins_rd) > 2 else "").strip()
            maintenance_code = str(ins_rd[3] if len(ins_rd) > 3 else "").strip()
            member_id = str(ref_rd[2] if len(ref_rd) > 2 else "").strip()
            effective_date = str(dtp_rd[3] if len(dtp_rd) > 3 else "").strip()
            
            # Name from NM1 loop
            nm1_loop = nm1_instances[i] if i < len(nm1_instances) else {}
            nm1_seg = nm1_loop.get("NM1", {})
            nm1_rd = nm1_seg.get("raw_data", [])
            first_name = str(nm1_rd[4] if len(nm1_rd) > 4 else "").strip()
            last_name = str(nm1_rd[3] if len(nm1_rd) > 3 else "").strip()
            full_name = f"{first_name} {last_name}".strip() or "Unknown"
            
            if not member_id:
                continue  # Skip if no member ID
            
            # Process based on maintenance code
            if maintenance_code == "030":  # Audit / Full File
                db.add_or_update(member_id, effective_date, full_name, relationship_code, is_subscriber)
                db.total_audits += 1
                
            elif maintenance_code == "021":  # Addition
                db.add_or_update(member_id, effective_date, full_name, relationship_code, is_subscriber)
                
            elif maintenance_code == "024":  # Termination
                # effective_date becomes termination_date for term transactions
                db.terminate(member_id, effective_date)
    
    return db


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 2: CLAIMS SCRUBBER
# ═══════════════════════════════════════════════════════════════════════════

class ClaimEligibilityResult:
    """Result of a single claim eligibility check."""
    
    def __init__(self, claim_id: str, patient_id: str, dos: str):
        self.claim_id = claim_id  # CLM01
        self.patient_id = patient_id  # Patient member ID
        self.date_of_service = dos  # YYYYMMDD
        self.flag: str = "UNKNOWN"  # CLEARED | MEMBER_NOT_FOUND | FLAGGED_NOT_YET_EFFECTIVE | FLAGGED_TERMINATED
        self.message: str = ""
        self.member_effective_date: Optional[str] = None
        self.member_termination_date: Optional[str] = None
        self.member_name: str = ""
        
    def to_dict(self) -> dict:
        return {
            "claim_id": self.claim_id,
            "patient_id": self.patient_id,
            "date_of_service": format_edi_date(self.date_of_service),
            "flag": self.flag,
            "message": self.message,
            "member_effective_date": format_edi_date(self.member_effective_date) if self.member_effective_date else None,
            "member_termination_date": format_edi_date(self.member_termination_date) if self.member_termination_date else None,
            "member_name": self.member_name,
        }


def scrub_837_claims(parsed_837: dict, member_db: MemberDatabase) -> dict:
    """
    STAGE 2: Validate 837 claims against the member roster.
    
    Input:
      - parsed_837: Parsed 837 AST (from EDIParser.parse())
      - member_db: MemberDatabase from Stage 1
      
    Output: Eligibility report with flagged claims
    """
    tree = parsed_837.get("data", parsed_837)
    loops = tree.get("loops", {})
    
    # Extract all claims (2300 loops)
    claims_instances = loops.get("2300", [])
    if not isinstance(claims_instances, list):
        claims_instances = [claims_instances] if claims_instances else []
    
    # Extract patient identifiers from 2010CA (Patient Name) or 2000C
    # We need to map each claim to a patient member ID
    # For simplicity, we'll extract from NM1 loops in 2010BA (Subscriber) or 2010CA (Patient)
    subscriber_instances = loops.get("2010BA", [])
    if not isinstance(subscriber_instances, list):
        subscriber_instances = [subscriber_instances] if subscriber_instances else []
    
    patient_instances = loops.get("2010CA", [])
    if not isinstance(patient_instances, list):
        patient_instances = [patient_instances] if patient_instances else []
    
    # Build a simple patient_id extraction (NM109 from subscriber or patient NM1)
    # In production, you'd need more sophisticated HL hierarchy walking
    patient_id_map: Dict[int, str] = {}
    
    for idx, sub_loop in enumerate(subscriber_instances):
        nm1 = sub_loop.get("NM1", {})
        nm1_rd = nm1.get("raw_data", [])
        member_id = str(nm1_rd[9] if len(nm1_rd) > 9 else "").strip()
        if member_id:
            patient_id_map[idx] = member_id
    
    for idx, pat_loop in enumerate(patient_instances):
        nm1 = pat_loop.get("NM1", {})
        nm1_rd = nm1.get("raw_data", [])
        member_id = str(nm1_rd[9] if len(nm1_rd) > 9 else "").strip()
        if member_id:
            patient_id_map[idx] = member_id
    
    # Process each claim
    results: List[ClaimEligibilityResult] = []
    cleared_count = 0
    not_found_count = 0
    not_yet_effective_count = 0
    terminated_count = 0
    
    for idx, claim_loop in enumerate(claims_instances):
        clm_seg = claim_loop.get("CLM", {})
        clm_rd = clm_seg.get("raw_data", [])
        claim_id = str(clm_rd[1] if len(clm_rd) > 1 else "").strip() or f"CLAIM-{idx+1}"
        
        # Extract date of service (DTP segment with qualifier 472)
        dtp_seg = claim_loop.get("DTP", {})
        if isinstance(dtp_seg, list):
            # Find the DTP with qualifier 472
            for dtp in dtp_seg:
                dtp_rd = dtp.get("raw_data", [])
                if len(dtp_rd) > 1 and str(dtp_rd[1]).strip() == "472":
                    dtp_seg = dtp
                    break
        
        dtp_rd = dtp_seg.get("raw_data", []) if isinstance(dtp_seg, dict) else []
        dos = str(dtp_rd[3] if len(dtp_rd) > 3 else "").strip()
        
        # Get patient ID (fallback to first available or unknown)
        patient_id = patient_id_map.get(idx, patient_id_map.get(0, "UNKNOWN"))
        
        result = ClaimEligibilityResult(claim_id, patient_id, dos)
        
        # Lookup member in database
        member = member_db.get(patient_id)
        
        if not member:
            result.flag = "MEMBER_NOT_FOUND"
            result.message = f"Patient ID '{patient_id}' not found in roster database."
            not_found_count += 1
        else:
            result.member_name = member.name
            result.member_effective_date = member.effective_date
            result.member_termination_date = member.termination_date
            
            # Parse dates for comparison
            dos_dt = parse_edi_date(dos)
            eff_dt = parse_edi_date(member.effective_date)
            term_dt = parse_edi_date(member.termination_date) if member.termination_date else None
            
            if not dos_dt:
                result.flag = "UNKNOWN"
                result.message = "Invalid date of service format."
            elif not eff_dt:
                result.flag = "UNKNOWN"
                result.message = "Member has invalid effective date."
            elif dos_dt < eff_dt:
                result.flag = "FLAGGED_NOT_YET_EFFECTIVE"
                result.message = f"DOS ({format_edi_date(dos)}) is before member's effective date ({format_edi_date(member.effective_date)})."
                not_yet_effective_count += 1
            elif term_dt and dos_dt > term_dt:
                result.flag = "FLAGGED_TERMINATED"
                result.message = f"DOS ({format_edi_date(dos)}) is after member's termination date ({format_edi_date(member.termination_date)})."
                terminated_count += 1
            else:
                result.flag = "CLEARED"
                result.message = f"DOS falls within coverage period ({format_edi_date(member.effective_date)} – {format_edi_date(member.termination_date) if member.termination_date else 'Active'})."
                cleared_count += 1
        
        results.append(result)
    
    return {
        "status": "success",
        "total_claims": len(results),
        "cleared_count": cleared_count,
        "flagged_not_found": not_found_count,
        "flagged_not_yet_effective": not_yet_effective_count,
        "flagged_terminated": terminated_count,
        "roster_stats": member_db.get_stats(),
        "claims": [r.to_dict() for r in results],
    }


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API: Combined Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def run_eligibility_scrubber(parsed_834_files: List[dict], parsed_837: dict) -> dict:
    """
    Full eligibility scrubber pipeline.
    
    Args:
        parsed_834_files: List of 834 parse responses (sorted by file date, oldest first)
        parsed_837: Single 837 parse response
        
    Returns:
        Eligibility report with flagged claims
    """
    # Stage 1: Build roster
    member_db = build_roster_from_834_files(parsed_834_files)
    
    # Stage 2: Scrub claims
    report = scrub_837_claims(parsed_837, member_db)
    
    return report