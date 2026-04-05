"""
Test harness for the Eligibility Scrubber
"""

from core_parser.eligibility_scrubber import (
    MemberDatabase,
    build_roster_from_834_files,
    scrub_837_claims,
)


def test_mock_scenario():
    """
    MOCK SCENARIO:
    - File 1 (Jan 1, 2026): 834 Full File (030). Adds Member "111222" (John) with Effective Date "20260101".
    - File 2 (Feb 15, 2026): 834 Change File. Sends a Term (024) for Member "111222" with Termination Date "20260228".
    - File 3 (Mar 10, 2026): 837 Claims File containing three claims for John:
       - Claim A: DOS "20260115" (Should process as CLEARED)
       - Claim B: DOS "20260305" (Should process as FLAGGED_TERMINATED)
       - Claim C: DOS "20251220" (Should process as FLAGGED_NOT_YET_EFFECTIVE)
    """
    
    # ── File 1: 834 Full Audit ──────────────────────────────────────────────
    file1_834 = {
        "data": {
            "loops": {
                "834_2000": [
                    {
                        "INS": {"raw_data": ["INS", "Y", "18", "030"]},
                        "REF": {"raw_data": ["REF", "0F", "111222"]},
                        "DTP": {"raw_data": ["DTP", "356", "D8", "20260101"]},
                    }
                ],
                "834_2100A": [
                    {
                        "NM1": {"raw_data": ["NM1", "IL", "1", "", "John", "Doe"]},
                    }
                ],
            }
        }
    }
    
    # ── File 2: 834 Termination ─────────────────────────────────────────────
    file2_834 = {
        "data": {
            "loops": {
                "834_2000": [
                    {
                        "INS": {"raw_data": ["INS", "Y", "18", "024"]},
                        "REF": {"raw_data": ["REF", "0F", "111222"]},
                        "DTP": {"raw_data": ["DTP", "356", "D8", "20260228"]},
                    }
                ],
                "834_2100A": [
                    {
                        "NM1": {"raw_data": ["NM1", "IL", "1", "", "John", "Doe"]},
                    }
                ],
            }
        }
    }
    
    # ── File 3: 837 Claims ──────────────────────────────────────────────────
    file3_837 = {
        "data": {
            "loops": {
                "2300": [
                    {
                        "CLM": {"raw_data": ["CLM", "CLAIM-A"]},
                        "DTP": {"raw_data": ["DTP", "472", "D8", "20260115"]},
                    },
                    {
                        "CLM": {"raw_data": ["CLM", "CLAIM-B"]},
                        "DTP": {"raw_data": ["DTP", "472", "D8", "20260305"]},
                    },
                    {
                        "CLM": {"raw_data": ["CLM", "CLAIM-C"]},
                        "DTP": {"raw_data": ["DTP", "472", "D8", "20251220"]},
                    },
                ],
                "2010BA": [
                    {"NM1": {"raw_data": ["NM1", "IL", "1", "", "", "", "", "", "XX", "111222"]}},
                    {"NM1": {"raw_data": ["NM1", "IL", "1", "", "", "", "", "", "XX", "111222"]}},
                    {"NM1": {"raw_data": ["NM1", "IL", "1", "", "", "", "", "", "XX", "111222"]}},
                ],
            }
        }
    }
    
    # ── Stage 1: Build roster ───────────────────────────────────────────────
    db = build_roster_from_834_files([file1_834, file2_834])
    
    assert db.total_additions == 1
    assert db.total_terminations == 1
    assert "111222" in db.members
    
    member = db.get("111222")
    assert member is not None
    assert member.effective_date == "20260101"
    assert member.termination_date == "20260228"
    
    # ── Stage 2: Scrub claims ───────────────────────────────────────────────
    report = scrub_837_claims(file3_837, db)
    
    assert report["total_claims"] == 3
    
    claims = {c["claim_id"]: c for c in report["claims"]}
    
    # Claim A: DOS within coverage period → CLEARED
    assert claims["CLAIM-A"]["flag"] == "CLEARED"
    
    # Claim B: DOS after termination → FLAGGED_TERMINATED
    assert claims["CLAIM-B"]["flag"] == "FLAGGED_TERMINATED"
    
    # Claim C: DOS before effective → FLAGGED_NOT_YET_EFFECTIVE
    assert claims["CLAIM-C"]["flag"] == "FLAGGED_NOT_YET_EFFECTIVE"
    
    print("✅ All assertions passed!")
    print("\nReport Summary:")
    print(f"  Total Claims: {report['total_claims']}")
    print(f"  Cleared: {report['cleared_count']}")
    print(f"  Not Yet Effective: {report['flagged_not_yet_effective']}")
    print(f"  Terminated: {report['flagged_terminated']}")


if __name__ == "__main__":
    test_mock_scenario()