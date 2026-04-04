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
import types
import unittest

# ── Path setup ────────────────────────────────────────────────────────────────
# Allow `from core_parser.edi_parser import EDIParser` to resolve correctly
# regardless of where pytest is invoked from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core_parser.edi_parser import EDIParser


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_parser() -> EDIParser:
    """
    Create an EDIParser instance without touching the filesystem.
    We patch file_path to a non-existent path — parse() is never called,
    only _run_domain_validations() is exercised directly.
    """
    p = EDIParser.__new__(EDIParser)
    EDIParser.__init__(p, file_path="/dev/null")  # __init__ does no file I/O
    # Ensure loop stack is empty so get_current_loop() returns None gracefully
    p.loop_stack = []
    p.current_claim = None
    p._pending_clp = None
    p._pending_svc = None
    return p


def _error_types(parser: EDIParser) -> list[str]:
    return [e["type"] for e in parser.errors]


def _error_fields(parser: EDIParser) -> list[str]:
    return [e.get("field", "") for e in parser.errors]


def _warning_types(parser: EDIParser) -> list[str]:
    return [w["type"] for w in parser.warnings]


# ═════════════════════════════════════════════════════════════════════════════
# GAP 1 — Monetary amount format validation
# ═════════════════════════════════════════════════════════════════════════════

class TestAmountFormatSV1(unittest.TestCase):
    """SV1*HC:99213*<amount>*..."""

    def test_valid_amount_no_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        # SV1*HC:99213*125.00*UN*1
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "125.00", "UN", "1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))

    def test_non_numeric_amount_fires_error(self):
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "ABC", "UN", "1"], 10)
        self.assertIn("InvalidAmountFormat", _error_types(p))
        self.assertIn("SV102", _error_fields(p))

    def test_empty_amount_is_zero_no_error(self):
        """Empty string should silently default to 0.0."""
        p = _make_parser()
        p.current_claim = {"Segment_ID": "CLM", "PatientControlNumber_01": "1"}
        p._run_domain_validations("SV1", ["SV1", "HC:99213", "", "UN", "1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))


class TestAmountFormatSV2(unittest.TestCase):
    """SV2*0301*HC:82270*<amount>*UN*1"""

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
    """CLM*1234*<amount>*..."""

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
        """Empty CLM02 → claimed=None, no error."""
        p = _make_parser()
        p._run_domain_validations("CLM", ["CLM", "1234", "", "", "", "11:B:1"], 10)
        self.assertNotIn("InvalidAmountFormat", _error_types(p))


# ═════════════════════════════════════════════════════════════════════════════
# GAP 2 — CLM05 facility / frequency validation
# ═════════════════════════════════════════════════════════════════════════════

class TestCLM05Validation(unittest.TestCase):
    """CLM*PCN*AMT***<CLM05>*..."""

    def _clm(self, clm05: str) -> EDIParser:
        p = _make_parser()
        # elements: CLM*PCN*200.00***<clm05>*Y*A*Y*I
        p._run_domain_validations("CLM", ["CLM", "PCN1", "200.00", "", "", clm05, "Y", "A", "Y", "I"], 5)
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
        p = self._clm("AB:B:1")   # POS "AB" is not \d{2}
        self.assertIn("InvalidPlaceOfService", _error_types(p))

    def test_single_digit_pos_fires_error(self):
        p = self._clm("1:B:1")    # POS "1" is only 1 digit
        self.assertIn("InvalidPlaceOfService", _error_types(p))

    def test_missing_freq_code_fires_error(self):
        p = self._clm("11:B:")    # freq_code is empty
        self.assertIn("InvalidClaimFrequency", _error_types(p))

    def test_alpha_freq_code_fires_error(self):
        p = self._clm("11:B:X")   # freq "X" is not \d
        self.assertIn("InvalidClaimFrequency", _error_types(p))

    def test_valid_replacement_claim(self):
        p = self._clm("21:B:7")   # POS=21, Freq=7 (replacement)
        codes = _error_types(p)
        self.assertNotIn("InvalidPlaceOfService", codes)
        self.assertNotIn("InvalidClaimFrequency", codes)


# ═════════════════════════════════════════════════════════════════════════════
# GAP 3 — SVC procedure code format validation
# ═════════════════════════════════════════════════════════════════════════════

class TestSVCProcedureCodeFormat(unittest.TestCase):
    """SVC*<composite>*billed*paid"""

    def test_valid_hcpcs_code_no_error(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertNotIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_invalid_code_fires_format_error(self):
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:XXXXX", "125.00", "100.00"], 20)
        self.assertIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_missing_code_no_crash(self):
        """Empty composite should not crash — no code to validate."""
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "", "125.00", "100.00"], 20)
        # No format error expected since code is absent
        self.assertNotIn("InvalidCPT_HCPCS_Format", _error_types(p))

    def test_pending_svc_initialised(self):
        """After SVC, _pending_svc must be a dict with 'adjustments' key."""
        p = _make_parser()
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertIsNotNone(p._pending_svc)
        self.assertIn("adjustments", p._pending_svc)

    def test_svc_appended_to_pending_clp(self):
        """SVC should be appended to _pending_clp['services'] when one is open."""
        p = _make_parser()
        p._pending_clp = {"services": [], "adjustments": [], "claim_id": "X"}
        p._run_domain_validations("SVC", ["SVC", "HC:99213", "125.00", "100.00"], 20)
        self.assertEqual(len(p._pending_clp["services"]), 1)


# ═════════════════════════════════════════════════════════════════════════════
# GAP 4 — RARC validation via LQ segment
# ═════════════════════════════════════════════════════════════════════════════

class TestRARCValidationLQ(unittest.TestCase):
    """LQ*HE*<RARC_code>"""

    def test_non_he_qualifier_not_validated(self):
        """Qualifier other than HE should not trigger RARC validation at all."""
        p = _make_parser()
        p._run_domain_validations("LQ", ["LQ", "RX", "MA01"], 30)
        # No InvalidRARC or InvalidRARC_Unverified expected
        all_types = _error_types(p) + _warning_types(p)
        rarc_hits = [t for t in all_types if "RARC" in t]
        self.assertEqual(rarc_hits, [])

    def test_empty_lq_code_not_validated(self):
        p = _make_parser()
        p._run_domain_validations("LQ", ["LQ", "HE", ""], 30)
        all_types = _error_types(p) + _warning_types(p)
        rarc_hits = [t for t in all_types if "RARC" in t]
        self.assertEqual(rarc_hits, [])

    def test_he_qualifier_triggers_rarc_check(self):
        """
        When qualifier is HE and a code is present, validate_rarc() is called.
        With no reference file loaded the result is a warning (Unverified),
        not necessarily an error.  Either outcome confirms the method was called.
        """
        p = _make_parser()
        p._run_domain_validations("LQ", ["LQ", "HE", "MA01"], 30)
        all_types = _error_types(p) + _warning_types(p)
        rarc_hits = [t for t in all_types if "RARC" in t]
        # validate_rarc was called — at minimum we see an Unverified warning
        # OR an InvalidRARC error if reference data IS loaded with MA01 absent.
        self.assertGreater(len(rarc_hits), 0,
            "Expected at least one RARC-related error or warning when LQ01='HE' and a code is provided.")

    def test_lq_segment_short_no_crash(self):
        """LQ with only 1 element should not raise an exception."""
        p = _make_parser()
        try:
            p._run_domain_validations("LQ", ["LQ"], 30)
        except Exception as exc:
            self.fail(f"Raised unexpectedly: {exc}")


# ═════════════════════════════════════════════════════════════════════════════
# GAP 5 — 834 INS code validation
# ═════════════════════════════════════════════════════════════════════════════

class TestINSCodeValidation(unittest.TestCase):
    """INS*Y*<INS02>*<INS03>*<INS04>*..."""

    def _ins(self, ins02: str, ins03: str, ins04: str = "") -> EDIParser:
        p = _make_parser()
        elements = ["INS", "Y", ins02, ins03, ins04, "A", "C"]
        p._run_domain_validations("INS", elements, 40)
        return p

    # ── INS02 ──────────────────────────────────────────────────────────────

    def test_valid_ins02_no_error(self):
        p = self._ins("18", "021")
        self.assertNotIn("MissingINSCode",  _error_types(p))
        self.assertNotIn("InvalidINSCode",  _error_types(p))

    def test_missing_ins02_fires_missing_error(self):
        p = self._ins("", "021")
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS02", "MissingINSCode"), errors)

    def test_one_char_ins02_fires_invalid_error(self):
        p = self._ins("1", "021")      # only 1 character — should be 2
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS02", "InvalidINSCode"), errors)

    def test_three_char_ins02_fires_invalid_error(self):
        p = self._ins("181", "021")    # 3 chars — should be exactly 2
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS02", "InvalidINSCode"), errors)

    def test_alpha_ins02_valid(self):
        """2-char alphanumeric like 'AI' is valid per IG."""
        p = self._ins("AI", "021")
        fields_with_ins02_error = [
            e["field"] for e in p.errors
            if e["field"] == "INS02" and e["type"] == "InvalidINSCode"
        ]
        self.assertEqual(fields_with_ins02_error, [])

    # ── INS03 ──────────────────────────────────────────────────────────────

    def test_valid_ins03_no_error(self):
        p = self._ins("18", "021")
        self.assertNotIn("MissingINSCode",  _error_types(p))

    def test_missing_ins03_fires_missing_error(self):
        p = self._ins("18", "")
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS03", "MissingINSCode"), errors)

    def test_two_char_ins03_fires_invalid_error(self):
        p = self._ins("18", "01")      # INS03 must be 3 chars, not 2
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS03", "InvalidINSCode"), errors)

    def test_four_char_ins03_fires_invalid_error(self):
        p = self._ins("18", "0210")    # 4 chars — should be exactly 3
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS03", "InvalidINSCode"), errors)

    # ── INS04 ──────────────────────────────────────────────────────────────

    def test_absent_ins04_no_error(self):
        """INS04 is optional — absent means empty string, no error expected."""
        p = self._ins("18", "021", "")
        fields_with_ins04_error = [e["field"] for e in p.errors if e["field"] == "INS04"]
        self.assertEqual(fields_with_ins04_error, [])

    def test_valid_ins04_no_error(self):
        p = self._ins("18", "021", "25")
        fields_with_ins04_error = [e["field"] for e in p.errors if e["field"] == "INS04"]
        self.assertEqual(fields_with_ins04_error, [])

    def test_invalid_ins04_fires_error(self):
        p = self._ins("18", "021", "TOOLONG")
        errors = [(e["field"], e["type"]) for e in p.errors]
        self.assertIn(("INS04", "InvalidINSCode"), errors)

    def test_pending_ins_line_set(self):
        """After INS, _pending_ins_line must equal the line number passed."""
        p = _make_parser()
        p._run_domain_validations("INS", ["INS", "Y", "18", "021", ""], 99)
        self.assertEqual(p._pending_ins_line, 99)


# ═════════════════════════════════════════════════════════════════════════════
# REGRESSION — existing validators (ensure gaps didn't break them)
# ═════════════════════════════════════════════════════════════════════════════

class TestNPIValidationRegression(unittest.TestCase):

    def test_valid_npi_no_error(self):
        """NPI 1234567893 passes the Luhn check."""
        p = _make_parser()
        p._run_domain_validations("NM1", [
            "NM1", "85", "2", "CLINIC", "", "", "", "", "XX", "1234567893"
        ], 1)
        self.assertNotIn("InvalidNPI", _error_types(p))

    def test_invalid_npi_fires_error(self):
        p = _make_parser()
        p._run_domain_validations("NM1", [
            "NM1", "85", "2", "CLINIC", "", "", "", "", "XX", "1234567890"
        ], 1)
        self.assertIn("InvalidNPI", _error_types(p))

    def test_non_xx_qualifier_skips_npi_check(self):
        p = _make_parser()
        p._run_domain_validations("NM1", [
            "NM1", "85", "2", "CLINIC", "", "", "", "", "SY", "123456789"
        ], 1)
        self.assertNotIn("InvalidNPI", _error_types(p))


class TestDateValidationRegression(unittest.TestCase):

    def test_valid_d8_date_no_error(self):
        p = _make_parser()
        p._run_domain_validations("DTP", ["DTP", "472", "D8", "20231015"], 2)
        self.assertNotIn("InvalidDateFormat", _error_types(p))
        self.assertNotIn("InvalidDateValue", _error_types(p))

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
        # HI with ABK qualifier and bad code "123" (no leading letter)
        p._run_domain_validations("HI", ["HI", "ABK:123"], 4)
        self.assertIn("InvalidICD10Format", _error_types(p))

    def test_valid_format_no_format_error(self):
        p = _make_parser()
        p._run_domain_validations("HI", ["HI", "ABK:J45909"], 4)
        # No format error (existence check may warn if ref file missing)
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


if __name__ == "__main__":
    unittest.main(verbosity=2)