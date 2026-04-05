"""
Test harness for the Eligibility Scrubber — uses actual EDI files
"""

import os
import sys

# Add parent directory to path to import core_parser modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core_parser.edi_parser import EDIParser
from core_parser.eligibility_scrubber import (
    build_roster_from_834_files,
    scrub_837_claims,
)


def test_eligibility_scrubber_with_real_files():
    """
    MOCK SCENARIO — Real EDI Files:
    - File 1 (Jan 1, 2026): 834 Full Audit (030). Adds Member "111222" (John Doe) with Effective Date "20260101".
    - File 2 (Feb 15, 2026): 834 Term (024). Terminates Member "111222" with Termination Date "20260228".
    - File 3 (Mar 20, 2026): 837 Claims File containing three claims for John:
       - Claim A: DOS "20260115" → CLEARED (within coverage)
       - Claim B: DOS "20260305" → FLAGGED_TERMINATED (after term date)
       - Claim C: DOS "20251220" → FLAGGED_NOT_YET_EFFECTIVE (before eff date)
    """
    
    test_dir = os.path.dirname(os.path.abspath(__file__))
    test_data_dir = os.path.join(test_dir, "test_data")
    
    # Ensure test_data directory exists
    os.makedirs(test_data_dir, exist_ok=True)
    
    # ── Parse 834 Files ─────────────────────────────────────────────────────
    file1_path = os.path.join(test_data_dir, "834_audit_20260101.edi")
    file2_path = os.path.join(test_data_dir, "834_term_20260215.edi")
    
    if not os.path.exists(file1_path):
        print(f"❌ Test file not found: {file1_path}")
        print("   Create the test EDI files in backend/tests/test_data/")
        return False
    
    if not os.path.exists(file2_path):
        print(f"❌ Test file not found: {file2_path}")
        return False
    
    parser1 = EDIParser(file1_path)
    parsed1 = parser1.parse()
    
    parser2 = EDIParser(file2_path)
    parsed2 = parser2.parse()
    
    # ── Parse 837 File ──────────────────────────────────────────────────────
    file3_path = os.path.join(test_data_dir, "837_claims_john.edi")
    
    if not os.path.exists(file3_path):
        print(f"❌ Test file not found: {file3_path}")
        return False
    
    parser3 = EDIParser(file3_path)
    parsed837 = parser3.parse()
    
    # ── Stage 1: Build Roster ───────────────────────────────────────────────
    print("\n" + "="*70)
    print("STAGE 1: BUILDING MEMBER ROSTER FROM 834 FILES")
    print("="*70)
    
    db = build_roster_from_834_files([parsed1, parsed2])
    
    print(f"\n📊 Roster Statistics:")
    stats = db.get_stats()
    for key, val in stats.items():
        print(f"   {key}: {val}")
    
    print(f"\n👤 Member '111222' Details:")
    member = db.get("111222")
    if member:
        print(f"   Name: {member.name}")
        print(f"   Effective Date: {member.effective_date}")
        print(f"   Termination Date: {member.termination_date}")
        assert member.effective_date == "20260101", "❌ Effective date mismatch"
        assert member.termination_date == "20260228", "❌ Termination date mismatch"
        print("   ✅ Member record built correctly")
    else:
        print("   ❌ Member not found in database!")
        return False
    
    # ── Stage 2: Scrub Claims ───────────────────────────────────────────────
    print("\n" + "="*70)
    print("STAGE 2: VALIDATING 837 CLAIMS AGAINST ROSTER")
    print("="*70)
    
    report = scrub_837_claims(parsed837, db)
    
    print(f"\n📋 Eligibility Report:")
    print(f"   Total Claims: {report['total_claims']}")
    print(f"   Cleared: {report['cleared_count']}")
    print(f"   Not Yet Effective: {report['flagged_not_yet_effective']}")
    print(f"   Terminated: {report['flagged_terminated']}")
    print(f"   Not Found: {report['flagged_not_found']}")
    
    # ── Validate Each Claim ─────────────────────────────────────────────────
    claims = {c["claim_id"]: c for c in report["claims"]}
    
    print("\n🔍 Detailed Claim Results:")
    
    # Claim A: DOS 2026-01-15 (within coverage: 2026-01-01 to 2026-02-28)
    if "CLAIM-A" in claims:
        claim_a = claims["CLAIM-A"]
        print(f"\n   Claim A (DOS: {claim_a['date_of_service']}):")
        print(f"      Flag: {claim_a['flag']}")
        print(f"      Message: {claim_a['message']}")
        assert claim_a["flag"] == "CLEARED", f"❌ Claim A should be CLEARED, got {claim_a['flag']}"
        print("      ✅ PASS — Within coverage period")
    
    # Claim B: DOS 2026-03-05 (after termination: 2026-02-28)
    if "CLAIM-B" in claims:
        claim_b = claims["CLAIM-B"]
        print(f"\n   Claim B (DOS: {claim_b['date_of_service']}):")
        print(f"      Flag: {claim_b['flag']}")
        print(f"      Message: {claim_b['message']}")
        assert claim_b["flag"] == "FLAGGED_TERMINATED", f"❌ Claim B should be FLAGGED_TERMINATED, got {claim_b['flag']}"
        print("      ✅ PASS — Correctly flagged as post-termination")
    
    # Claim C: DOS 2025-12-20 (before effective: 2026-01-01)
    if "CLAIM-C" in claims:
        claim_c = claims["CLAIM-C"]
        print(f"\n   Claim C (DOS: {claim_c['date_of_service']}):")
        print(f"      Flag: {claim_c['flag']}")
        print(f"      Message: {claim_c['message']}")
        assert claim_c["flag"] == "FLAGGED_NOT_YET_EFFECTIVE", f"❌ Claim C should be FLAGGED_NOT_YET_EFFECTIVE, got {claim_c['flag']}"
        print("      ✅ PASS — Correctly flagged as pre-effective")
    
    print("\n" + "="*70)
    print("✅ ALL TESTS PASSED — MOCK SCENARIO VALIDATED")
    print("="*70 + "\n")
    
    return True


if __name__ == "__main__":
    success = test_eligibility_scrubber_with_real_files()
    sys.exit(0 if success else 1)