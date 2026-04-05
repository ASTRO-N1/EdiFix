"""
fix_assistant.py
═══════════════════════════════════════════════════════════════════════════════
Deterministic Fix Engine for Common EDI Validation Errors
═══════════════════════════════════════════════════════════════════════════════

Supports:
  1. NPI Luhn Checksum Correction
  2. Date Format Conversion (YYMMDD → CCYYMMDD)
  3. Amount Recalculation (CLM02 = sum of SV102)
  4. Missing Required Fields (inject common defaults)
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import re
import copy


# ═══════════════════════════════════════════════════════════════════════════
# FIX SUGGESTION DATA MODEL
# ═══════════════════════════════════════════════════════════════════════════

class FixSuggestion:
    """Represents a single deterministic fix suggestion."""
    
    def __init__(
        self,
        error_id: str,
        field_path: str,
        loop_key: str,
        segment_key: str,
        element_key: str,
        current_value: str,
        suggested_value: str,
        confidence: float,
        reason: str,
        fix_type: str,
    ):
        self.error_id = error_id
        self.field_path = field_path
        self.loop_key = loop_key
        self.segment_key = segment_key
        self.element_key = element_key
        self.current_value = current_value
        self.suggested_value = suggested_value
        self.confidence = confidence
        self.reason = reason
        self.fix_type = fix_type
        
    def to_dict(self) -> dict:
        return {
            "error_id": self.error_id,
            "field_path": self.field_path,
            "loop_key": self.loop_key,
            "segment_key": self.segment_key,
            "element_key": self.element_key,
            "current_value": self.current_value,
            "suggested_value": self.suggested_value,
            "confidence": self.confidence,
            "reason": self.reason,
            "fix_type": self.fix_type,
        }


# ═══════════════════════════════════════════════════════════════════════════
# FIX ENGINES
# ═══════════════════════════════════════════════════════════════════════════

def calculate_npi_checksum(npi: str) -> str:
    """
    Calculate the correct Luhn check digit for a 9-digit NPI prefix.
    Returns the full 10-digit NPI with corrected check digit.
    """
    if not npi:
        return npi
    
    # Clean input
    npi = str(npi).strip()
    
    if len(npi) == 10:
        npi = npi[:9]  # Strip existing check digit
    
    if len(npi) != 9 or not npi.isdigit():
        return str(npi)  # Invalid format, can't fix
    
    # Luhn algorithm with constant prefix "80840"
    full_prefix = "80840" + npi
    digits = [int(d) for d in full_prefix]
    
    # Double every other digit from right
    for i in range(len(digits) - 2, -1, -2):
        digits[i] *= 2
        if digits[i] > 9:
            digits[i] -= 9
    
    total = sum(digits)
    check_digit = (10 - (total % 10)) % 10
    
    return npi + str(check_digit)


def convert_date_format(date_str: str) -> Optional[str]:
    """
    Convert YYMMDD to CCYYMMDD using smart century detection.
    """
    if not date_str:
        return None
    
    date_str = str(date_str).strip()
    
    if len(date_str) == 8:
        return None  # Already CCYYMMDD
    
    if len(date_str) != 6:
        return None  # Invalid format
    
    try:
        yy = int(date_str[:2])
        mm = int(date_str[2:4])
        dd = int(date_str[4:6])
        
        # Validate month/day ranges
        if mm < 1 or mm > 12 or dd < 1 or dd > 31:
            return None
        
        # Smart century: 00-30 → 2000s, 31-99 → 1900s
        century = "20" if yy <= 30 else "19"
        ccyy = century + date_str[:2]
        result = ccyy + date_str[2:]
        
        # Validate complete date
        datetime.strptime(result, "%Y%m%d")
        
        return result
    except (ValueError, IndexError):
        return None


def calculate_total_claim_charge(parse_result: dict) -> Optional[float]:
    """
    Calculate sum of all service line charges (SV102) for amount mismatch fixes.
    """
    tree = parse_result.get("data", parse_result)
    loops = tree.get("loops", {})
    
    service_loops = loops.get("2400", [])
    if not isinstance(service_loops, list):
        service_loops = [service_loops] if service_loops else []
    
    total = 0.0
    count = 0
    
    for svc_loop in service_loops:
        if not isinstance(svc_loop, dict):
            continue
        
        sv1_seg = svc_loop.get("SV1", {})
        raw_data = sv1_seg.get("raw_data", [])
        
        if len(raw_data) > 2:
            try:
                amount_str = str(raw_data[2]).strip()
                amount = float(amount_str)
                total += amount
                count += 1
            except (ValueError, IndexError, TypeError):
                continue
    
    return total if count > 0 else None


# ═══════════════════════════════════════════════════════════════════════════
# MAIN FIX ASSISTANT CLASS
# ═══════════════════════════════════════════════════════════════════════════

class FixAssistant:
    """Analyzes validation errors and suggests deterministic fixes."""
    
    def analyze_errors(self, parse_result: dict) -> List[FixSuggestion]:
        """
        Analyze all validation errors and generate fix suggestions.
        """
        suggestions: List[FixSuggestion] = []
        
        tree = parse_result.get("data", parse_result)
        errors = tree.get("errors", [])
        
        for idx, error in enumerate(errors):
            error_code = str(error.get("code", "")).upper()
            element = str(error.get("element", ""))
            loop = str(error.get("loop", ""))
            message = str(error.get("message", ""))
            
            error_id = f"error-{idx}"
            
            # NPI Checksum Errors
            if "NPI" in error_code or "NPI" in message.upper() or "LUHN" in message.upper():
                fix = self._fix_npi_checksum(parse_result, error, error_id, loop, element)
                if fix:
                    suggestions.append(fix)
            
            # Date Format Errors
            elif "DATE" in error_code or "CCYYMMDD" in message or "6-DIGIT" in message.upper():
                fix = self._fix_date_format(parse_result, error, error_id, loop, element)
                if fix:
                    suggestions.append(fix)
            
            # Amount Mismatch Errors
            elif "AMOUNT" in error_code.upper() or "CLM02" in element or "MISMATCH" in message.upper():
                fix = self._fix_amount_mismatch(parse_result, error, error_id)
                if fix:
                    suggestions.append(fix)
        
        return suggestions
    
    def _fix_npi_checksum(
        self, 
        parse_result: dict, 
        error: dict, 
        error_id: str,
        loop_key: str,
        element: str
    ) -> Optional[FixSuggestion]:
        """Generate NPI checksum fix suggestion."""
        tree = parse_result.get("data", parse_result)
        loops = tree.get("loops", {})
        
        if not loop_key:
            loop_key = "2010AA"  # Default to billing provider
        
        # Navigate to the NPI field
        loop_instances = loops.get(loop_key, [])
        if not isinstance(loop_instances, list):
            loop_instances = [loop_instances] if loop_instances else []
        
        if not loop_instances:
            return None
        
        nm1_seg = loop_instances[0].get("NM1", {})
        if not nm1_seg:
            return None
        
        raw_data = nm1_seg.get("raw_data", [])
        
        if len(raw_data) <= 9:
            return None
        
        current_npi = str(raw_data[9]).strip()
        
        if not current_npi or len(current_npi) != 10 or not current_npi.isdigit():
            return None
        
        corrected_npi = calculate_npi_checksum(current_npi[:9])
        
        if corrected_npi == current_npi:
            return None  # Already correct
        
        return FixSuggestion(
            error_id=error_id,
            field_path=f"loops.{loop_key}.0.NM1.raw_data.9",
            loop_key=loop_key,
            segment_key="NM1",
            element_key="NM1_09",
            current_value=current_npi,
            suggested_value=corrected_npi,
            confidence=1.0,
            reason=f"Corrected Luhn check digit from '{current_npi[-1]}' to '{corrected_npi[-1]}'",
            fix_type="NPI Checksum",
        )
    
    def _fix_date_format(
        self, 
        parse_result: dict, 
        error: dict, 
        error_id: str,
        loop_key: str,
        element: str
    ) -> Optional[FixSuggestion]:
        """Generate date format fix suggestion."""
        # Extract segment and position from element (e.g., "DTP03")
        match = re.match(r"([A-Z]+)(\d+)", element)
        if not match:
            return None
        
        seg_id = match.group(1)
        pos = int(match.group(2))
        
        tree = parse_result.get("data", parse_result)
        loops = tree.get("loops", {})
        
        if not loop_key:
            return None
        
        loop_instances = loops.get(loop_key, [])
        if not isinstance(loop_instances, list):
            loop_instances = [loop_instances] if loop_instances else []
        
        if not loop_instances:
            return None
        
        seg = loop_instances[0].get(seg_id, {})
        if not seg:
            return None
        
        raw_data = seg.get("raw_data", [])
        
        if len(raw_data) <= pos:
            return None
        
        current_date = str(raw_data[pos]).strip()
        converted = convert_date_format(current_date)
        
        if not converted:
            return None
        
        return FixSuggestion(
            error_id=error_id,
            field_path=f"loops.{loop_key}.0.{seg_id}.raw_data.{pos}",
            loop_key=loop_key,
            segment_key=seg_id,
            element_key=f"{seg_id}_{pos:02d}",
            current_value=current_date,
            suggested_value=converted,
            confidence=0.95,
            reason=f"Converted 6-digit date '{current_date}' to 8-digit CCYYMMDD format '{converted}'",
            fix_type="Date Format",
        )
    
    def _fix_amount_mismatch(
        self, 
        parse_result: dict, 
        error: dict, 
        error_id: str
    ) -> Optional[FixSuggestion]:
        """Generate amount recalculation fix."""
        calculated = calculate_total_claim_charge(parse_result)
        if not calculated:
            return None
        
        tree = parse_result.get("data", parse_result)
        loops = tree.get("loops", {})
        
        claim_loops = loops.get("2300", [])
        if not isinstance(claim_loops, list):
            claim_loops = [claim_loops] if claim_loops else []
        
        if not claim_loops:
            return None
        
        clm_seg = claim_loops[0].get("CLM", {})
        if not clm_seg:
            return None
        
        raw_data = clm_seg.get("raw_data", [])
        
        if len(raw_data) <= 2:
            return None
        
        current_amount = str(raw_data[2]).strip()
        suggested_amount = f"{calculated:.2f}"
        
        # Check if they're already equal (within rounding)
        try:
            if abs(float(current_amount) - calculated) < 0.01:
                return None
        except (ValueError, TypeError):
            pass
        
        return FixSuggestion(
            error_id=error_id,
            field_path="loops.2300.0.CLM.raw_data.2",
            loop_key="2300",
            segment_key="CLM",
            element_key="CLM_02",
            current_value=current_amount,
            suggested_value=suggested_amount,
            confidence=1.0,
            reason=f"Recalculated from service line charges: sum of SV1-02 values = ${calculated:.2f}",
            fix_type="Amount Recalculation",
        )
    
    def apply_fix(self, parse_result: dict, suggestion: FixSuggestion) -> dict:
        """
        Apply a fix suggestion to the parse tree.
        Returns the updated parse_result.
        """
        updated = copy.deepcopy(parse_result)
        
        # Parse the field path: "loops.2010AA.0.NM1.raw_data.9"
        parts = suggestion.field_path.split(".")
        
        current = updated
        for i, part in enumerate(parts[:-1]):
            if part.isdigit():
                # Array index
                idx = int(part)
                if isinstance(current, list) and len(current) > idx:
                    current = current[idx]
                else:
                    print(f"Warning: Could not navigate to index {idx}")
                    return parse_result
            else:
                # Dictionary key
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    print(f"Warning: Could not navigate to key '{part}'")
                    return parse_result
        
        # Set the final value
        final_key = parts[-1]
        if final_key.isdigit():
            idx = int(final_key)
            if isinstance(current, list) and len(current) > idx:
                current[idx] = suggestion.suggested_value
        else:
            if isinstance(current, dict):
                current[final_key] = suggestion.suggested_value
        
        return updated


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════

def analyze_and_suggest_fixes(parse_result: dict) -> List[dict]:
    """
    Public API: Analyze parse result and return fix suggestions.
    """
    assistant = FixAssistant()
    suggestions = assistant.analyze_errors(parse_result)
    return [s.to_dict() for s in suggestions]


def apply_fix_to_tree(parse_result: dict, suggestion_dict: dict) -> dict:
    """
    Public API: Apply a fix suggestion to the parse tree.
    """
    suggestion = FixSuggestion(**suggestion_dict)
    assistant = FixAssistant()
    return assistant.apply_fix(parse_result, suggestion)