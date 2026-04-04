#!/usr/bin/env python3
"""
test_reference_data.py
======================
Sanity-checks that all reference_data/*.json files are loadable
by ReferenceData and that lookups return the expected results.

Usage:
    cd backend
    python scripts/test_reference_data.py
"""

import os
import sys
import re

# ── Path setup ───────────────────────────────────────────────────────────────
# SCRIPT_DIR  = backend/scripts   (absolute, always correct regardless of CWD)
# BACKEND_DIR = backend/          (one level up from scripts/)
# This means reference_data/ resolves to backend/reference_data/ ✅
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

# Make core_parser importable
sys.path.insert(0, BACKEND_DIR)
from core_parser.edi_parser import ReferenceData

# Pass the already-resolved absolute path — no ".." left unresolved
ref = ReferenceData(BACKEND_DIR)

# ── Debug: print what paths are being checked ────────────────────────────────
print(f"\nBackend dir : {BACKEND_DIR}")
print(f"Ref data dir: {ref._base}")
print(f"Dir exists  : {os.path.exists(ref._base)}")

# List files actually present
if os.path.exists(ref._base):
    found = os.listdir(ref._base)
    print(f"Files found : {found}")
else:
    print("❌  reference_data/ directory not found at the above path!")
    print("    Make sure you ran:  python scripts/build_reference_data.py")
    sys.exit(1)

print()

PASS = "✅"
FAIL = "❌"

tests = [
    # (dataset,  code,         expected,   human label)

    # CARC — real codes
    ("carc",  "1",     "valid",   "CARC 1  (Deductible Amount)"),
    ("carc",  "16",    "valid",   "CARC 16 (Billing error)"),
    ("carc",  "97",    "valid",   "CARC 97 (Bundled service)"),
    ("carc",  "253",   "valid",   "CARC 253 (Sequestration)"),
    ("carc",  "W1",    "valid",   "CARC W1 (WC jurisdictional fee)"),
    ("carc",  "FAKE",  "invalid", "CARC FAKE (should be invalid)"),
    ("carc",  "9999",  "invalid", "CARC 9999 (should be invalid)"),

    # RARC — real codes
    ("rarc",  "M1",    "valid",   "RARC M1"),
    ("rarc",  "N1",    "valid",   "RARC N1"),
    ("rarc",  "MA01",  "valid",   "RARC MA01"),
    ("rarc",  "ZZZZ",  "invalid", "RARC ZZZZ (should be invalid)"),

    # ICD-10 — real codes (stored without dots)
    ("icd10", "Z0000", "valid",   "ICD-10 Z0000 (General exam)"),
    ("icd10", "A000",  "valid",   "ICD-10 A000  (Cholera)"),
    ("icd10", "S5200", "valid",   "ICD-10 S5200 (Radius fracture)"),
    ("icd10", "ZZZ99", "invalid", "ICD-10 ZZZ99 (should be invalid)"),
    ("icd10", "FAKE",  "invalid", "ICD-10 FAKE  (should be invalid)"),

    # HCPCS — real codes
    ("hcpcs", "G0438", "valid",   "HCPCS G0438 (Annual wellness visit)"),
    ("hcpcs", "A4253", "valid",   "HCPCS A4253 (Blood glucose strips)"),
    ("hcpcs", "Z9999", "invalid", "HCPCS Z9999 (should be invalid)"),

    # CPT — always "unknown" because file is a placeholder (empty codes)
    ("cpt",   "99213", "unknown", "CPT 99213 (placeholder → unknown)"),
    ("cpt",   "00000", "unknown", "CPT 00000 (placeholder → unknown)"),
]

print("=" * 65)
print(" Reference Data — Integration Test")
print("=" * 65)
print(f"\n{'Result':<6}  {'Dataset':<8}  {'Code':<10}  {'Expected':<10}  Label")
print("-" * 65)

passed = failed = 0

for dataset, code, expected, label in tests:
    result = ref.check(dataset, code)
    ok     = result == expected

    if ok:
        icon = PASS
        passed += 1
    else:
        icon = FAIL
        failed += 1

    print(f"{icon}  {dataset:<8}  {code:<10}  {expected:<10}  {label}")
    if not ok:
        print(f"       ↳ Got '{result}' — MISMATCH")

print("\n" + "-" * 65)
print(f"\nVersions loaded:")
for k, v in ref.versions.items():
    count = len(ref._cache.get(k) or {})
    print(f"  {k:<8} {v:<30}  ({count:,} codes in memory)")

print(f"\nResult: {passed} passed, {failed} failed")
if failed == 0:
    print("✅  All checks passed — reference data is correctly wired.\n")
else:
    print("❌  Some checks failed — investigate above before using the parser.\n")

sys.exit(0 if failed == 0 else 1)