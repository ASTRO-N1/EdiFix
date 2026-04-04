"""
test_edi_parser_validations.py
──────────────────────────────────────────────────────────────────────────────
Unit tests for EDIParser._run_domain_validations covering:
  Gap 1  — Monetary amount format (SV1, SV2, CLM)
  Gap 2  — CLM05 Place of Service / Frequency
  Gap 3  — SVC procedure code format
  Gap 4  — RARC validation via LQ
  Gap 5  — 834 INS code validation (INS02, INS03, INS04)

  Plus regression tests for existing validators that were already working:
  NPI, date, ZIP, ICD-10 format, CAS group code.

Run from the project root:
    cd backend
    python -m pytest tests/test_edi_parser_validations.py -v
"""

import sys
import os
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core_parser.edi_parser import EDIParser


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_parser() -> EDIParser:
    """
    Create an EDIParser without any filesystem access.
    Uses a cross-platform null path and resets all stateful fields
    so every test starts from a clean slate.
    """
    null_path = "NUL" if sys.platform == "win32" else "/dev/null"
    p = EDIParser.__new__(EDIParser)
    EDIParser.__init__(p, file_path=null_path)
    p.loop_stack    = []
    p.current_claim = None
    p._pending_clp  = None
    p._pending_svc  = None
    return p


def _error_types(parser: EDIParser) -> list:
    return [e["type"] for e in parser.errors]


def _error_fields(parser: EDIParser) -> list:
    return [e.get("field", "") for e in parser.errors]


def _warning_types(parser: EDIParser) -> list:
    return [w["type"] for w in parser.warnings]


# ── Reference-data stubs ──────────────────────────────────────────────────────

class _RefStubNoFiles:
    """
    Simulates an environment where NO reference JSON files are present.
    Every check() call returns "unknown" → triggers _Unverified warnings.
    """
    versions: dict = {}

    def check(self, key: str, value: str) -> str:
        return "unknown"


class _RefStubWithRarc:
    """
    Simulates a fully loaded reference set where only 'MA01' is a known
    valid RARC code. Any other code is invalid.
    """
    versions: dict = {}
    _VALID_RARC = {"MA01"}

    def check(self, key: str, value: str) -> str:
        if key == "rarc":
            return "valid" if value.strip().upper() in self._VALID_RARC else "invalid"
        return "unknown"


# ═════════════════════════════════════════════════════════════════════════════
# GAP 1 — Monetary amount format validation
# ═════════════════════════════════════════════════════════════════════════════

class TestAmountFormatSV1(unittest.TestCase):

    def test_valid_amount_no_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "125.00", "UN", "1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))

    def test_non_numeric_amount_fires_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "ABC", "UN", "1"], 10)
        self.assertIn("InvalidAmountFormat", _error_types(p))
        self.assertIn("SV102", _error_fields(p))

    def test_empty_amount_is_zero_no_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "", "UN", "1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))


class TestAmountFormatSV2(unittest.TestCase):

    def test_valid_amount_no_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV2", ["SV2", "0301", "HC:82270", "14.84", "UN", "1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))

    def test_non_numeric_amount_fires_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV2", ["SV2", "0301", "HC:82270", "INVALID", "UN", "1"], 10)
        self.assertIn("InvalidAmountFormat", _error_types(p))
        self.assertIn("SV203", _error_fields(p))


class TestAmountFormatCLM(unittest.TestCase):

    def test_valid_amount_no_error(self):
        p = _make_parser()
        p._run_domain_validations("CLM", ["CLM", "1234", "500.00", "", "", "11:B:1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))

    def test_non_numeric_amount_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("CLM", ["CLM", "1234", "NOTANUMBER", "", "", "11:B:1"], 10)
        self.assertIn("InvalidAmountFormat", _error_types(p))
        self.assertIn("CLM02", _error_fields(p))

    def test_empty_amount_no_error(self):
        p = _make_parser()
        p._run_domain_validations("CLM", ["CLM", "1234", "", "", "", "11:B:1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))


# ═════════════════════════════════════════════════════════════════════════════
# GAP 2 — CLM05 facility / frequency validation
# ═════════════════════════════════════════════════════════════════════════════

class TestCLM05Validation(unittest.TestCase):

    def _clm(self, clm05: str) -> EDIParser:
        p = _make_parser()
        p._run_domain_validations(
            "CLM", ["CLM", "PCN1", "200.00", "", "", clm05, "Y", "A", "Y", "I"], 5
        )
        return p

    def test_valid_clm05_no_errors(self):
        p = self._clm("11:B:1")
        codes = _error_types(p)
        self.assertNotIn("InvalidPlaceOfService", codes)
        self.assertNotIn("InvalidClaimFrequency", codes)
        self.assertNotIn("MissingCLM05", codes)

    def test_missing_clm05_fires_missing_error(self):
        p = self._clm("")
        self.assertIn("MissingCLM05", _error_types(p))

    def test_non_numeric_pos_fires_error(self):
        p = self._clm("AB:B:1")
        self.assertIn("InvalidPlaceOfService", _error_types(p))

    def test_single_digit_pos_fires_error(self):
        p = self._clm("1:B:1")
        self.assertIn("InvalidPlaceOfService", _error_types(p))

    def test_missing_freq_code_fires_error(self):
        p = self._clm("11:B:")
        self.assertIn("InvalidClaimFrequency", _error_types(p))

    def test_alpha_freq_code_fires_error(self):
        p = self._clm("11:B:X")
        self.assertIn("InvalidClaimFrequency", _error_types(p))

    def test_valid_replacement_claim(self):
        p = self._clm("21:B:7")
        codes = _error_types(p)
        self.assertNotIn("InvalidPlaceOfService", codes)
        self.assertNotIn("InvalidClaimFrequency", codes)


# ═════════════════════════════════════════════════════════════════════════════
# GAP 3 — SVC procedure code format validation
# ═════════════════════════════════════════════════════════════════════════════

class TestSVCProcedureCodeFormat(unittest.TestCase):

    def test_valid_hcpcs_code_no_error(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertNotIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_invalid_code_fires_format_error(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:XXXXX", "125.00", "100.00"], 20)
        self.assertIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_missing_code_no_crash(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "", "125.00", "100.00"], 20)
        self.assertNotIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_pending_svc_initialised(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertIsNotNone(p._pending_svc)
        self.assertIn("adjustments", p._pending_svc)

    def test_svc_appended_to_pending_clp(self):
        p = _make_parser()
        p._pending_clp = {"services": [], "adjustments": [], "claim_id": "X"}
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertEqual(len(p._pending_clp["services"]), 1)


# ═════════════════════════════════════════════════════════════════════════════
# GAP 4 — RARC validation via LQ segment
# ═════════════════════════════════════════════════════════════════════════════

class TestRARCValidationLQ(unittest.TestCase):
    """
    All four tests inject a controlled _RefStub so results are deterministic
    regardless of whether rarc_codes.json exists on the test machine.
    """

    def test_non_he_qualifier_not_validated(self):
        """Non-HE qualifier must never trigger a RARC check."""
        p = _make_parser()
        p._ref = _RefStubNoFiles()
        p._run_domain_validations("LQ", ["LQ", "RX", "MA01"], 30)
        all_types = _error_types(p) + _warning_types(p)
        self.assertEqual([t for t in all_types if "RARC" in t], [])

    def test_empty_lq_code_not_validated(self):
        """HE qualifier with an empty code must not fire any RARC check."""
        p = _make_parser()
        p._ref = _RefStubNoFiles()
        p._run_domain_validations("LQ", ["LQ", "HE", ""], 30)
        all_types = _error_types(p) + _warning_types(p)
        self.assertEqual([t for t in all_types if "RARC" in t], [])

    def test_he_qualifier_valid_rarc_no_error(self):
        """
        HE qualifier + a code that IS in the reference set → no error or warning.
        Uses _RefStubWithRarc which recognises only 'MA01' as valid.
        """
        p = _make_parser()
        p._ref = _RefStubWithRarc()
        p._run_domain_validations("LQ", ["LQ", "HE", "MA01"], 30)
        all_types = _error_types(p) + _warning_types(p)
        self.assertEqual([t for t in all_types if "RARC" in t], [],
            "A valid RARC code should produce no errors or warnings.")

    def test_he_qualifier_invalid_rarc_fires_error(self):
        """
        HE qualifier + a code NOT in the reference set → InvalidRARC error.
        Uses _RefStubWithRarc which only knows 'MA01'.
        """
        p = _make_parser()
        p._ref = _RefStubWithRarc()
        p._run_domain_validations("LQ", ["LQ", "HE", "ZZZNOTREAL"], 30)
        self.assertIn("InvalidRARC", _error_types(p))

    def test_he_qualifier_unknown_ref_fires_warning(self):
        """
        HE qualifier + any code when reference data is absent → Unverified warning.
        Uses _RefStubNoFiles which always returns 'unknown'.
        """
        p = _make_parser()
        p._ref = _RefStubNoFiles()
        p._run_domain_validations("LQ", ["LQ", "HE", "MA01"], 30)
        self.assertIn("InvalidRARC_Unverified", _warning_types(p))

    def test_lq_segment_short_no_crash(self):
        """LQ with only the segment ID and no other elements must not raise."""
        p = _make_parser()
        p._ref = _RefStubNoFiles()
        try:
            p._run_domain_validations("LQ", ["LQ"], 30)
        except Exception as exc:
            self.fail(f"Raised unexpectedly: {exc}")


# ═════════════════════════════════════════════════════════════════════════════
# GAP 5 — 834 INS code validation
# ═════════════════════════════════════════════════════════════════════════════

class TestINSCodeValidation(unittest.TestCase):

    def _ins(self, ins02: str, ins03: str, ins04: str = "") -> EDIParser:
        p = _make_parser()
        p._run_domain_validations("INS", ["INS", "Y", ins02, ins03, ins04, "A", "C"], 40)
        return p

    def test_valid_ins_no_error(self):
        p = self._ins("18", "021")
        self.assertNotIn("MissingINSCode", _error_types(p))
        self.assertNotIn("InvalidINSCode", _error_types(p))

    def test_missing_ins02_fires_missing_error(self):
        p = self._ins("", "021")
        self.assertIn(("INS02", "MissingINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_one_char_ins02_fires_invalid_error(self):
        p = self._ins("1", "021")
        self.assertIn(("INS02", "InvalidINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_three_char_ins02_fires_invalid_error(self):
        p = self._ins("181", "021")
        self.assertIn(("INS02", "InvalidINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_alpha_ins02_valid(self):
        p = self._ins("AI", "021")
        self.assertEqual(
            [e for e in p.errors if e["field"] == "INS02" and e["type"] == "InvalidINSCode"], []
        )

    def test_missing_ins03_fires_missing_error(self):
        p = self._ins("18", "")
        self.assertIn(("INS03", "MissingINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_two_char_ins03_fires_invalid_error(self):
        p = self._ins("18", "01")
        self.assertIn(("INS03", "InvalidINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_four_char_ins03_fires_invalid_error(self):
        p = self._ins("18", "0210")
        self.assertIn(("INS03", "InvalidINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_absent_ins04_no_error(self):
        p = self._ins("18", "021", "")
        self.assertEqual([e for e in p.errors if e["field"] == "INS04"], [])

    def test_valid_ins04_no_error(self):
        p = self._ins("18", "021", "25")
        self.assertEqual([e for e in p.errors if e["field"] == "INS04"], [])

    def test_invalid_ins04_fires_error(self):
        p = self._ins("18", "021", "TOOLONG")
        self.assertIn(("INS04", "InvalidINSCode"), [(e["field"], e["type"]) for e in p.errors])

    def test_pending_ins_line_set(self):
        p = _make_parser()
        p._run_domain_validations("INS", ["INS", "Y", "18", "021", ""], 99)
        self.assertEqual(p._pending_ins_line, 99)


# ═════════════════════════════════════════════════════════════════════════════
# REGRESSION — existing validators
# ═════════════════════════════════════════════════════════════════════════════

class TestNPIValidationRegression(unittest.TestCase):

    def test_valid_npi_no_error(self):
        p = _make_parser()
        p._run_domain_validations(
            "NM1", ["NM1", "85", "2", "CLINIC", "", "", "", "", "XX", "1234567893"], 1
        )
        self.assertNotIn("InvalidNPI", _error_types(p))

    def test_invalid_npi_fires_error(self):
        p = _make_parser()
        p._run_domain_validations(
            "NM1", ["NM1", "85", "2", "CLINIC", "", "", "", "", "XX", "1234567890"], 1
        )
        self.assertIn("InvalidNPI", _error_types(p))

    def test_non_xx_qualifier_skips_npi_check(self):
        p = _make_parser()
        p._run_domain_validations(
            "NM1", ["NM1", "85", "2", "CLINIC", "", "", "", "", "SY", "123456789"], 1
        )
        self.assertNotIn("InvalidNPI", _error_types(p))


class TestDateValidationRegression(unittest.TestCase):

    def test_valid_d8_date_no_error(self):
        p = _make_parser()
        p._run_domain_validations("DTP", ["DTP", "472", "D8", "20231015"], 2)
        self.assertNotIn("InvalidDateFormat", _error_types(p))
        self.assertNotIn("InvalidDateValue",  _error_types(p))

    def test_invalid_date_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("DTP", ["DTP", "472", "D8", "20231399"], 2)
        self.assertIn("InvalidDateValue", _error_types(p))

    def test_non_d8_format_skipped(self):
        p = _make_parser()
        p._run_domain_validations("DTP", ["DTP", "472", "RD8", "20231015-20231020"], 2)
        self.assertNotIn("InvalidDateFormat", _error_types(p))


class TestZIPValidationRegression(unittest.TestCase):

    def test_valid_5digit_zip(self):
        p = _make_parser()
        p._run_domain_validations("N4", ["N4", "COLUMBUS", "OH", "43215"], 3)
        self.assertNotIn("InvalidZIP", _error_types(p))

    def test_invalid_zip_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("N4", ["N4", "COLUMBUS", "OH", "432"], 3)
        self.assertIn("InvalidZIP", _error_types(p))


class TestICD10Regression(unittest.TestCase):

    def test_invalid_format_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("HI", ["HI", "ABK:123"], 4)
        self.assertIn("InvalidICD10Format", _error_types(p))

    def test_valid_format_no_format_error(self):
        p = _make_parser()
        p._ref = _RefStubNoFiles()   # prevent existence check from interfering
        p._run_domain_validations("HI", ["HI", "ABK:J45909"], 4)
        self.assertNotIn("InvalidICD10Format", _error_types(p))


class TestCASGroupCodeRegression(unittest.TestCase):

    def test_invalid_group_code_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("CAS", ["CAS", "ZZ", "45", "100.00"], 5)
        self.assertIn("InvalidCASGroupCode", _error_types(p))

    def test_valid_group_code_no_error(self):
        p = _make_parser()
        p._run_domain_validations("CAS", ["CAS", "CO", "45", "100.00"], 5)
        self.assertNotIn("InvalidCASGroupCode", _error_types(p))


# ═════════════════════════════════════════════════════════════════════════════
# HD / LX reset behaviour
# ═════════════════════════════════════════════════════════════════════════════

class TestPendingInsLineReset(unittest.TestCase):

    def test_hd_resets_pending_ins_line(self):
        p = _make_parser()
        p._pending_ins_line = 42
        p._run_domain_validations("HD", ["HD", "021", "", "HMO"], 50)
        self.assertIsNone(p._pending_ins_line)

    def test_lx_resets_pending_ins_line(self):
        p = _make_parser()
        p._pending_ins_line = 42
        p._run_domain_validations("LX", ["LX", "1"], 51)
        self.assertIsNone(p._pending_ins_line)


# ── 834 Member Enrollment Summary ──────────────────────────────────────────────
class TestMemberEnrollmentSummary:

    def _parse_834(self, edi_content: str) -> dict:
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode='w', suffix='.edi', delete=False, encoding='utf-8') as f:
            f.write(edi_content)
            path = f.name
        try:
            from core_parser.edi_parser import EDIParser
            parser = EDIParser(path)
            return parser.parse()
        finally:
            os.unlink(path)

    def test_subscriber_is_group_root(self):
        """Subscriber (INS01=Y) must be the first member in a family group."""
        result = self._parse_834(SAMPLE_834_EDI)  # use the sample file content
        summary = result.get("member_enrollment_summary", [])
        assert len(summary) > 0, "Expected at least one family group"
        first_member = summary[0]["family_members"][0]
        assert first_member["is_subscriber"] is True

    def test_dependent_rollup(self):
        """Dependents (INS01=N) must be nested under their subscriber group."""
        result = self._parse_834(SAMPLE_834_EDI)
        summary = result.get("member_enrollment_summary", [])
        first_group = summary[0]
        assert len(first_group["family_members"]) > 1, "Expected subscriber + at least 1 dependent"
        dependents = [m for m in first_group["family_members"] if not m["is_subscriber"]]
        assert len(dependents) >= 1

    def test_maintenance_type_labels(self):
        """Maintenance type codes must be translated to human-readable labels."""
        result = self._parse_834(SAMPLE_834_EDI)
        summary = result.get("member_enrollment_summary", [])
        all_members = [m for g in summary for m in g["family_members"]]
        labels = {m["maintenance_label"] for m in all_members}
        assert "Addition" in labels  # 021

    def test_cob_captured(self):
        """COB records must be attached to the correct member."""
        result = self._parse_834(SAMPLE_834_EDI)
        summary = result.get("member_enrollment_summary", [])
        all_members = [m for g in summary for m in g["family_members"]]
        cob_members = [m for m in all_members if m["cob"]]
        assert len(cob_members) >= 1, "Expected at least one member with a COB record"