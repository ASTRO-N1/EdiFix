"""
Unit test for the reconciliation engine.
Uses pre-built parsed JSON that exactly matches what the backend returns:
  - /api/v1/parse  → {"status","data":{loops:{2300,2400,...},...}}
  - /api/v1/parse-835 → {"status","data":{loops:{835_2100,835_2110,...},...},
                          "remittance_summary":[...]}
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core_parser.reconciliation import reconcile

# ── 837 parse response ─────────────────────────────────────────────────────
parsed_837 = {
    "status": "success",
    "data": {
        "metadata": {"transaction_type": "837"},
        "loops": {
            "2300": [
                {
                    "CLM": {
                        "Segment_ID": "CLM",
                        "raw_data": ["CLM", "CLAIM123", "500", "", "11:B:1", "Y", "A", "Y", "Y"],
                    },
                }
            ],
            "2400": [
                {
                    "SV1": {
                        "Segment_ID": "SV1",
                        "raw_data": ["SV1", "HC:99213", "300", "UN", "1", "", "", "1"],
                    },
                },
                {
                    "SV1": {
                        "Segment_ID": "SV1",
                        "raw_data": ["SV1", "HC:87070", "200", "UN", "1", "", "", "1"],
                    },
                },
            ],
        },
        "errors": [],
    }
}

# ── 835 parse response (includes remittance_summary from parser) ───────────
parsed_835 = {
    "status": "success",
    "file_type": "835",
    # remittance_summary is built by parser.build_remittance_summary()
    "remittance_summary": [
        {
            "claim_id":           "CLAIM123",
            "status_code":        "1",
            "billed":             500.0,
            "paid":               400.0,
            "patient_responsibility": 100.0,
            "adjustments":        [],   # claim-level CAS (none in sample)
            "services":           [{"adjustments": []}, {"adjustments": []}],
            "check_eft_number":   "1234567890",
            "supplemental":       {},
        }
    ],
    "data": {
        "metadata": {"transaction_type": "835"},
        "loops": {
            "835_2100": [
                {
                    "CLP": {
                        "Segment_ID": "CLP",
                        "raw_data": ["CLP", "CLAIM123", "1", "500", "400", "100", "MC", "123456789", "11", "1"],
                    },
                },
            ],
            "835_2110": [
                {
                    "SVC": {
                        "Segment_ID": "SVC",
                        "raw_data": ["SVC", "HC:99213", "300", "250"],
                    },
                    "CAS": {
                        "Segment_ID": "CAS",
                        "raw_data": ["CAS", "CO", "45", "50"],
                    },
                },
                {
                    "SVC": {
                        "Segment_ID": "SVC",
                        "raw_data": ["SVC", "HC:87070", "200", "150"],
                    },
                    "CAS": {
                        "Segment_ID": "CAS",
                        "raw_data": ["CAS", "CO", "45", "50"],
                    },
                },
            ],
        },
        "errors": [],
    }
}

print("Running reconciliation test...")
result = reconcile(parsed_837, parsed_835)

print("\n=== RESULT ===")
print(json.dumps(result, indent=2, ensure_ascii=False))

# Assertions
assert result.get("matched") is True, f"Expected matched=True: {result.get('error')}"
assert result["pcn"] == "CLAIM123", f"Wrong PCN: {result['pcn']}"
assert len(result["line_items"]) == 2, f"Expected 2 line items, got {len(result['line_items'])}"
li0 = result["line_items"][0]
assert li0["procedure_code"] == "99213", f"Wrong code: {li0['procedure_code']}"
assert li0["billed"] == 300.0
assert li0["paid"] == 250.0
cs = result["claim_summary"]
assert cs["total_billed"] == 500.0
assert cs["total_paid"] == 400.0
assert result["verdict"]["color"] in ("green", "yellow", "red")

print("\nAll assertions passed!")
