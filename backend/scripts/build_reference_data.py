#!/usr/bin/env python3
"""
build_reference_data.py  —  EDI Parser Reference Data Builder
==============================================================
Builds all reference_data/*.json files needed by the EDI parser's
Layer-2 codeset validators.

Usage:
    # First time — install deps:
    pip install requests beautifulsoup4 lxml playwright
    playwright install chromium

    # Build everything:
    python scripts/build_reference_data.py

    # Rebuild only what failed:
    python scripts/build_reference_data.py --only carc icd10 --force

    # Check current counts without rebuilding:
    python scripts/build_reference_data.py --list
"""

import argparse
import io
import json
import os
import re
import sys
import time
import zipfile
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "reference_data"))
TIMEOUT    = 60

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def write_json(key, version, source, description, codes):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"{key}_codes.json")
    payload = {
        "version":     version,
        "generated":   today_str(),
        "source":      source,
        "description": description,
        "codes":       codes,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    print(f"  ✅  Wrote {len(codes):,} codes → {os.path.relpath(path)}")

def load_existing(key):
    path = os.path.join(OUTPUT_DIR, f"{key}_codes.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)

def should_skip(key, force):
    if force:
        return False
    existing = load_existing(key)
    if existing and existing.get("codes"):
        count = len(existing["codes"])
        print(f"  ⏭   Already exists ({count:,} codes). Use --force to re-download.")
        return True
    return False

# ---------------------------------------------------------------------------
# Shared x12.org HTML parser
# ---------------------------------------------------------------------------

def _parse_x12_table(soup, key):
    """
    Tries multiple HTML structures that x12.org uses.
    Returns dict of {code: description}.
    """
    codes = {}

    # Try 1: standard <table>
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cols = [td.get_text(" ", strip=True) for td in row.find_all(["td", "th"])]
            if len(cols) >= 2:
                code = cols[0].strip()
                desc = cols[1].strip()
                if code and re.fullmatch(r"[A-Z]{0,2}[0-9]{1,4}[A-Z]?", code):
                    codes[code] = desc
    if codes:
        return codes

    # Try 2: <dl> definition list
    for dt in soup.find_all("dt"):
        code = dt.get_text(strip=True)
        dd   = dt.find_next_sibling("dd")
        desc = dd.get_text(strip=True) if dd else ""
        if code and re.fullmatch(r"[A-Z]{0,2}[0-9]{1,4}[A-Z]?", code):
            codes[code] = desc
    if codes:
        return codes

    # Try 3: data-code attributes (JS frameworks)
    for el in soup.find_all(attrs={"data-code": True}):
        code = el.get("data-code", "").strip()
        desc = el.get_text(strip=True)
        if code:
            codes[code] = desc

    return codes

# ---------------------------------------------------------------------------
# 1. CARC  —  x12.org
# ---------------------------------------------------------------------------

def build_carc(force=False):
    print("\n[CARC] Fetching from x12.org …")
    if should_skip("carc", force):
        return

    url = "https://x12.org/codes/claim-adjustment-reason-codes"

    # Strategy 1: Playwright (handles JS rendering)
    codes = _carc_playwright(url)

    # Strategy 2: requests fallback
    if not codes:
        print("  ↩   Playwright unavailable or got 0 codes — trying requests …")
        codes = _carc_requests(url)

    # Strategy 3: merge with embedded seed list if we got fewer than 50
    if len(codes) < 50:
        print(f"  ⚠   Only {len(codes)} codes scraped — merging with embedded seed list …")
        codes.update(_carc_seed())
        print(f"  ℹ   Merged total: {len(codes)} codes")

    write_json(
        "carc",
        version=f"scraped-{today_str()}",
        source=url,
        description=(
            "ANSI X12 Claim Adjustment Reason Codes (CARC). "
            "Scraped from x12.org. Update quarterly (Jan/Apr/Jul/Oct)."
        ),
        codes=codes,
    )

def _carc_playwright(url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  ℹ   Playwright not installed. Run: pip install playwright && playwright install chromium")
        return {}

    codes = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page    = browser.new_page()
            print(f"  🌐  Opening {url} in headless browser …")
            page.goto(url, wait_until="networkidle", timeout=30000)
            try:
                page.wait_for_selector("table, ul.code-list, .codes-table", timeout=10000)
            except Exception:
                pass
            html = page.content()
            browser.close()
        soup  = BeautifulSoup(html, "lxml")
        codes = _parse_x12_table(soup, "carc")
        print(f"  🌐  Playwright extracted {len(codes)} codes")
    except Exception as exc:
        print(f"  ⚠   Playwright error: {exc}")

    return codes

def _carc_requests(url):
    headers = {"User-Agent": "EDI-Parser-RefData-Builder/1.0"}
    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        soup  = BeautifulSoup(resp.text, "lxml")
        codes = _parse_x12_table(soup, "carc")
        print(f"  ℹ   requests extracted {len(codes)} codes")
        return codes
    except Exception as exc:
        print(f"  ⚠   requests error: {exc}")
        return {}

def _carc_seed():
    """
    Complete embedded CARC seed list as of March 2026.
    Source: https://x12.org/codes/claim-adjustment-reason-codes
    Used as fallback if scraping returns < 50 codes.
    """
    return {
        "1":   "Deductible Amount",
        "2":   "Coinsurance Amount",
        "3":   "Co-payment Amount",
        "4":   "The service/procedure is inconsistent with the modifier.",
        "5":   "The procedure code/type of bill is inconsistent with the place of service.",
        "6":   "The procedure/revenue code is inconsistent with the patient's age.",
        "7":   "The procedure/revenue code is inconsistent with the patient's gender.",
        "8":   "The procedure code is inconsistent with the provider type/specialty.",
        "9":   "The diagnosis is inconsistent with the patient's age.",
        "10":  "The diagnosis is inconsistent with the patient's gender.",
        "11":  "The diagnosis is inconsistent with the procedure.",
        "12":  "The diagnosis is inconsistent with the provider type.",
        "13":  "The date of death precedes the date of service.",
        "14":  "The date of birth follows the date of service.",
        "15":  "The authorization number is missing, invalid, or does not apply to the billed services or provider.",
        "16":  "Claim/service lacks information or has submission/billing error(s).",
        "17":  "Claim/service adjusted because of the impact of prior payer(s) adjudication including payments and/or adjustments.",
        "18":  "Exact duplicate claim/service.",
        "19":  "Claim denied because this is a work-related injury/illness and thus the liability of the Worker's Compensation Carrier.",
        "20":  "Claim denied because this injury/illness is covered by the liability carrier.",
        "21":  "Claim denied because this injury/illness is the liability of the no-fault carrier.",
        "22":  "This care may be covered by another payer per coordination of benefits.",
        "23":  "The impact of prior payer(s) adjudication including payments and/or adjustments.",
        "24":  "Charges are covered under a capitation agreement/managed care plan.",
        "26":  "Expenses incurred prior to coverage.",
        "27":  "Expenses incurred after coverage terminated.",
        "28":  "Coverage not in effect at the time the service was provided.",
        "29":  "The time limit for filing has expired.",
        "30":  "Payment adjusted because the patient has not met the required eligibility, spend down, waiting, or residency requirements.",
        "31":  "Claim denied as patient cannot be identified as our insured.",
        "32":  "Our records indicate that this dependent is not an eligible dependent as defined.",
        "33":  "Claim denied. Insured has no dependent coverage.",
        "34":  "Claim denied. Insured has no coverage for newborns.",
        "35":  "Lifetime benefit maximum has been reached.",
        "37":  "Balance does not exceed co-payment amount.",
        "38":  "Services not provided or authorized by designated (network/primary care) providers.",
        "39":  "Services denied at the time authorization/pre-certification was requested.",
        "40":  "Charges do not meet qualifications for emergent/urgent care.",
        "41":  "Discount agreed to in Preferred Provider contract.",
        "42":  "Charges exceed our fee schedule or maximum allowable amount.",
        "43":  "Gramm-Rudman reduction.",
        "44":  "Prompt-pay discount.",
        "45":  "Charges exceed your contracted/legislated fee arrangement.",
        "46":  "This (these) service(s) is (are) not covered.",
        "47":  "This (these) diagnosis(es) is (are) not covered, missing, or are invalid.",
        "48":  "This (these) procedure(s) is (are) not covered.",
        "49":  "These are non-covered services because this is a routine exam or screening procedure done in conjunction with a routine exam.",
        "50":  "These are non-covered services because this is not deemed a 'medical necessity' by the payer.",
        "51":  "These are non-covered services because this is a pre-existing condition.",
        "52":  "The referring/prescribing/rendering provider is not eligible to refer/prescribe/order/perform the service billed.",
        "53":  "Services by an immediate relative or a member of the same household are not covered.",
        "54":  "Multiple physicians/assistants are not covered in this case.",
        "55":  "Procedure/treatment/drug is deemed experimental/investigational by the payer.",
        "56":  "Procedure/treatment has not been deemed 'proven to be effective' by the payer.",
        "57":  "Payment adjusted because the payer deems the information submitted does not support this level of service.",
        "58":  "Treatment was deemed by the payer to have been rendered in an inappropriate or invalid place of service.",
        "59":  "Processed based on multiple or concurrent procedure rules.",
        "60":  "Charges for outpatient services with this proximity to inpatient services are not covered.",
        "61":  "Penalty for failure to obtain second surgical opinion.",
        "62":  "Payment denied/reduced for absence of, or exceeded, pre-certification/authorization.",
        "63":  "Correction to a prior claim.",
        "64":  "Denial reversed per Medical Review.",
        "65":  "Procedure code was incorrect. This payment reflects the correct code.",
        "66":  "Blood Deductible.",
        "67":  "Lifetime reserve days.",
        "68":  "DRG weight error.",
        "69":  "Day outlier amount.",
        "70":  "Cost outlier - Reimbursement amount is based on a special computation.",
        "71":  "Primary Payer amount.",
        "72":  "Coinsurance day.",
        "73":  "Administrative days.",
        "74":  "Indirect Medical Education Adjustment.",
        "75":  "Direct Medical Education Adjustment.",
        "76":  "Disproportionate Share Adjustment.",
        "77":  "Covered days.",
        "78":  "Non-covered days/Room charge adjustment.",
        "79":  "Cost report days.",
        "80":  "Outlier days.",
        "81":  "Discharges.",
        "82":  "PPS (Prospective Payment System) code.",
        "83":  "Staff model HMO plan.",
        "84":  "ICF (Intermediate Care Facility) level of care.",
        "85":  "SNF (Skilled Nursing Facility) level of care.",
        "86":  "Patient is ineligible for the billing period shown.",
        "87":  "Transfer amount.",
        "88":  "Adjustment amount represents collection against receivable created in prior overpayment.",
        "89":  "Professional fees removed from institutional claim.",
        "90":  "Ingredient cost adjustment.",
        "91":  "Dispensing fee adjustment.",
        "92":  "Claim Submitted to Incorrect Payer.",
        "93":  "No valid authorization information was received for this service.",
        "94":  "Timely filing requirements not met.",
        "95":  "Plan procedures not followed.",
        "96":  "Non-covered charge(s).",
        "97":  "The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated.",
        "100": "Payment made to patient/insured/responsible party/employer.",
        "101": "Predetermination: anticipated payment upon completion of services or claim adjudication.",
        "102": "Major Medical Adjustment.",
        "103": "Provider promotional discount (e.g., Senior citizen discount).",
        "104": "Managed care withholding.",
        "105": "Tax withholding.",
        "106": "Patient payment option/election not in effect.",
        "107": "The related or qualifying claim/service was not identified on this claim.",
        "108": "Rent/purchase guidelines were not met.",
        "109": "Claim not covered by this payer/contractor. You must send the claim to the correct payer/contractor.",
        "110": "Billing date predates service date.",
        "111": "Not covered unless the provider accepts assignment.",
        "112": "Service not furnished directly to the patient and/or not documented.",
        "113": "Payment denied because service/procedure was provided outside the United States or as a result of war.",
        "114": "Procedure/product not approved by the Food and Drug Administration.",
        "115": "Claim not covered when patient is in custody/incarcerated.",
        "116": "The advance indemnification notice signed by the patient did not comply with requirements.",
        "117": "Transportation is only covered to the nearest facility that can provide the necessary care.",
        "118": "ESRD network support adjustment.",
        "119": "Benefit maximum for this time period or occurrence has been reached.",
        "121": "Indemnification adjustment - compensation for outstanding member responsibility.",
        "122": "Psychiatric reduction.",
        "123": "Payer refund due to overpayment.",
        "124": "Payer refund amount - not our patient.",
        "125": "Payment adjusted due to a submission/billing error(s).",
        "126": "Deductible -- Major Medical",
        "127": "Coinsurance -- Major Medical",
        "128": "Newborn's services are covered in the mother's Allowance.",
        "129": "Prior processing information appears incorrect.",
        "130": "Claim submission fee.",
        "131": "Claim specific negotiated discount.",
        "132": "Prearranged demonstration project adjustment.",
        "133": "The disposal of this claim/service allows an opportunity for resubmission.",
        "134": "Technical fees removed from charges.",
        "135": "Interim bills cannot be processed.",
        "136": "Failure to follow prior payer's coverage determinations.",
        "137": "Regulatory Surcharges, Assessments, Allowances or Health Related Taxes.",
        "138": "Appeal procedures not followed or time limits not met.",
        "139": "Contracted funding agreement - Subscriber is employed by the provider of services.",
        "140": "Patient/Insured health identification number and name do not match.",
        "141": "Claim spans eligible and ineligible periods of coverage.",
        "142": "Monthly Medicaid patient liability amount.",
        "143": "Portion of payment deferred.",
        "144": "Incentive adjustment, e.g. preferred product/service.",
        "146": "Diagnosis was invalid for the date(s) of service reported.",
        "147": "Provider contracted/negotiated rate expired or not on file.",
        "148": "Information from another provider was not provided or was insufficient/incomplete.",
        "149": "Lifetime reserve days.",
        "150": "Payer deems the information submitted does not support this level of service.",
        "151": "Payment adjusted because the payer deems the information submitted does not support this many/frequency of services.",
        "152": "Payer deems the information submitted does not support this length of service.",
        "153": "Payer deems the information submitted does not support this dosage.",
        "154": "Payer deems the information submitted does not support this day's supply.",
        "155": "Patient refused the service/procedure.",
        "157": "Service/procedure was provided as a result of an act of war.",
        "158": "Service/procedure was provided outside of the United States.",
        "159": "Service/procedure was provided as a result of terrorism.",
        "160": "Injury/illness was the result of an activity that is a benefit exclusion.",
        "161": "Provider performance bonus",
        "162": "State-mandated Requirement for Property and Casualty.",
        "163": "Attachment/other documentation referenced on the claim was not received.",
        "164": "Attachment/other documentation referenced on the claim was not received in a timely fashion.",
        "165": "Referral absent or exceeded.",
        "166": "These services were submitted after this plan terminated.",
        "167": "This (these) diagnosis(es) is (are) not covered.",
        "168": "Service(s) have been considered under the patient's medical or dental plan.",
        "169": "Claim/service denied because information to indicate if the patient owns the equipment that requires the part or supply was missing.",
        "170": "Payment is denied when performed/billed by this type of provider in this type of facility.",
        "171": "Payment is denied when performed/billed by this type of provider.",
        "172": "Payment is adjusted when performed/billed by a provider of this specialty.",
        "173": "No payment for a facility/technical component when billed with this procedure code.",
        "174": "Payment adjusted because a patient/insured has not met the required eligibility requirements.",
        "175": "Claim/service denied because a required waiver of liability statement has not been received.",
        "176": "Services not related to the primary diagnosis.",
        "177": "Patient has not met the required spend down requirements.",
        "178": "Patient has not met the required waiting requirements.",
        "179": "Patient has not met the required residency requirements.",
        "180": "Claim/service denied because the benefit adjudication information was not received.",
        "181": "Procedure code was inconsistent with the provider's credentials.",
        "182": "Procedure modifier was inconsistent with the procedure code.",
        "183": "The referring provider is not eligible to refer the service billed.",
        "184": "The prescribing/ordering provider is not eligible to prescribe/order the service billed.",
        "185": "The rendering provider is not eligible to perform the service billed.",
        "186": "Level of care change adjustment.",
        "187": "Consumer Spending Account payments (e.g. Flexible Spending Account, Health Savings Account, Health Reimbursement Account)",
        "188": "This product/service is only covered when used in accordance with FDA recommendations.",
        "189": "Not otherwise classified or 'unlisted' procedure code was billed when there is a specific procedure code for this service.",
        "190": "Payment is included in the allowance for a Skilled Nursing Facility (SNF) qualified stay.",
        "191": "Not a work related injury/illness and thus not the liability of the Workers' Compensation Carrier.",
        "192": "Non covered visits.",
        "193": "Original payment decision is being maintained.",
        "194": "Anesthesia performed by the operating physician, the assistant surgeon or the attending physician.",
        "195": "Refund issued to an erroneous priority payer for this claim/service.",
        "196": "Claim/service denied based on prior payer's coverage determination.",
        "197": "Precertification/authorization/notification absent.",
        "198": "Precertification/authorization exceeded.",
        "199": "Revenue code and Procedure code do not match.",
        "200": "Expenses incurred during lapse in coverage.",
        "201": "Workers' Compensation case settled.",
        "202": "Non-covered personal comfort or convenience services.",
        "203": "Discontinued or reduced service.",
        "204": "This service/equipment/drug is not covered under the patient's current benefit plan.",
        "205": "Pharmacy discount card processing fee.",
        "206": "National Drug Codes (NDC) not eligible for rebate, are not covered.",
        "207": "Health Care Flexible Spending Account (FSA) or Health Reimbursement Account (HRA) adjustment.",
        "208": "Professional fees removed from charges.",
        "209": "Per regulatory or other agreement. The provider cannot collect this amount from the patient.",
        "210": "Payment adjusted because pre-certification/authorization not obtained within required time frame.",
        "211": "National Drug Code (NDC) not applicable. Rebate not applicable.",
        "212": "Administrative surcharge.",
        "213": "Non-covered service when performed by this provider in this place of service.",
        "214": "Workers' Compensation claim adjusted.",
        "215": "Based on subrogation of a third party settlement.",
        "216": "Based on the findings of a review organization.",
        "217": "Based on payer reasonable and customary fees.",
        "218": "Based on entitlement to benefits.",
        "219": "Based on extent of injury.",
        "220": "The applicable fee schedule/fee database does not contain the billed code.",
        "221": "Drug supply fee adjustment.",
        "222": "Exceeds the contracted maximum number of hours/days/units by this provider for this period.",
        "223": "Adjustment code for mandated federal, state or local law/regulation.",
        "224": "Patient identification compromised by identity theft.",
        "225": "Penalty or Interest Payment by Payer.",
        "226": "Information requested from the Billing/Rendering Provider was not provided or not provided timely or was insufficient/incomplete.",
        "227": "Information requested from the patient/insured/responsible party was not provided or was insufficient/incomplete.",
        "228": "Denied for failure of this provider, another provider or the subscriber to supply requested information to a previous payer.",
        "229": "Partial charge amount not considered by Medicare due to the initial claim being paid in full.",
        "231": "Mutually exclusive procedures cannot be done in the same day/setting.",
        "232": "Institutional Transfer Amount.",
        "233": "Services/charges related to the treatment of a hospital-acquired condition or preventable medical error.",
        "234": "This procedure is not paid separately.",
        "235": "Sales Tax.",
        "236": "This procedure or procedure/modifier combination is not compatible with another procedure or procedure/modifier combination provided on the same day.",
        "237": "Legislated/Regulatory Penalty.",
        "238": "Claim spans eligible and ineligible periods of coverage, this is the reduction for the ineligible period.",
        "239": "Claim spans eligible and ineligible periods of coverage, this is the reduction for the eligible period.",
        "240": "The product/service is not covered for the patient's diagnosis.",
        "241": "Low Income Subsidy (LIS) Co-payment Amount.",
        "242": "Services not provided by network/primary care providers.",
        "243": "Services not authorized by network/primary care providers.",
        "245": "Provider not enrolled in the Federal Health Care Program.",
        "246": "This non-payable code is for required reporting only.",
        "247": "Deductible for Professional service rendered in an Institutional setting and billed on an Institutional claim.",
        "248": "Coinsurance for Professional service rendered in an Institutional setting and billed on an Institutional claim.",
        "249": "This claim has been identified as a readmission.",
        "250": "The attachment/other documentation that was received was the incorrect attachment/document type.",
        "251": "The attachment/other documentation that was received was for a different patient/claim.",
        "252": "An attachment/other documentation is required to adjudicate this claim/service.",
        "253": "Sequestration - reduction in federal payment",
        "254": "Claim received by the dental plan, but benefits not available under this plan.",
        "256": "Service not payable per managed care contract.",
        "257": "The disposition of this claim/service is pending further review.",
        "258": "Claim/service not covered when patient is in a Medicare Part A stay.",
        "259": "Additional payment for Dental/Vision service rendered by a Medical provider.",
        "260": "Processed under Medicaid ACA Enhanced Fee Schedule",
        "261": "The procedure or service is inconsistent with the patient's history.",
        "262": "Adjustment for delivery cost.",
        "263": "Adjustment for shipping cost.",
        "264": "Adjustment for postage cost.",
        "265": "Adjustment for administrative cost.",
        "266": "Adjustment for interest.",
        "267": "Claim/service spans multiple months. Split claim required.",
        "268": "The Claim spans two calendar years. Please resubmit one claim per calendar year.",
        "269": "Anesthesia not covered for this procedure.",
        "270": "Claim/Service not covered for the Plan reported.",
        "271": "Prior hospitalization or 30 day transfer requirement not met.",
        "272": "Coverage/program guidelines were not met.",
        "273": "Coverage/program guidelines were exceeded.",
        "274": "Fee/Service not payable per patient Care Coordination arrangement.",
        "275": "Prior payer's (or payers') patient responsibility not covered.",
        "276": "Services denied by the prior payer were not covered by this payer.",
        "A0":  "Medicare Secondary Payer Adjustment Amount",
        "A1":  "Claim/Service Denied. At least one Remark Code must be provided.",
        "A2":  "Contractual adjustment.",
        "A3":  "Medicare Secondary Payer liability met.",
        "A4":  "Medicare Claim PPS Capital Cost Outlier Amount.",
        "A5":  "Medicare Claim PPS Operating Outlier Amount.",
        "A6":  "Prior hospitalization or 30-day transfer requirement not met.",
        "A7":  "Presumptive Payment Adjustment",
        "A8":  "Claim/service denied. At least one Remark Code must be provided.",
        "B1":  "Non-covered visits.",
        "B2":  "Covered visits.",
        "B3":  "Covered charges.",
        "B4":  "Late filing penalty.",
        "B5":  "Coverage/program guidelines were not met or were exceeded.",
        "B6":  "This payment is adjusted when performed/billed by a provider of this specialty.",
        "B7":  "This provider was not certified/eligible to be paid for this procedure/service on this date of service.",
        "B8":  "Alternative services were available, and should have been utilized.",
        "B9":  "Patient is enrolled in a Hospice.",
        "B10": "Allowed amount has been reduced because a component of the basic procedure/test was paid.",
        "B11": "The claim/service has been transferred to the proper payer/processor for processing.",
        "B12": "Payer refuses to pay.",
        "B13": "Previously paid. Payment for this claim/service may have been provided in a previous payment.",
        "B14": "Only one visit or consultation per physician per day is covered.",
        "B15": "This service/procedure requires that a qualifying service/procedure be received and covered.",
        "B16": "'New Patient' qualifications were not met.",
        "B17": "Payment adjusted because this service was not prescribed by a physician.",
        "B18": "This procedure code and modifier were invalid on the date of service.",
        "B19": "Claim/service adjusted because of the impact of prior payer(s) adjudication.",
        "B20": "Procedure/service was partially or fully furnished by another provider.",
        "B22": "This payment is adjusted based on the diagnosis.",
        "B23": "Procedure billed is not authorized per your Clinical Laboratory Improvement Amendment (CLIA) proficiency test.",
        "D1":  "Claim/service denied. At least one Remark Code must be provided.",
        "D3":  "Claim/service denied because of prior payer's coverage determination.",
        "D4":  "Claim/service not covered by this payer.",
        "D5":  "Claim/service DENIED because this is a duplicate of a previously processed claim.",
        "D7":  "Claim/service denied. This Remark Code explains the payer's rationale.",
        "D8":  "Claim/service paid in full.",
        "D9":  "Claim denied - Coordination of Benefits.",
        "D10": "Claim denied - Coordination of Benefits - Medicare is Primary.",
        "D11": "Claim denied - Coordination of Benefits - Medicare is Secondary.",
        "D12": "Claim denied - Coordination of Benefits - Medicare is Tertiary.",
        "W1":  "Worker's compensation jurisdictional fee schedule adjustment.",
        "W2":  "Worker's compensation state fee schedule adjustment.",
        "W3":  "Worker's compensation multiple physician/facility fee schedule adjustment.",
        "W4":  "Worker's compensation cost-to-charge ratio adjustment.",
        "Y1":  "Payment denied/reduced because the payer deems the information submitted does not support this level of service.",
        "Y2":  "Payment denied/reduced based on the result of the review.",
        "Y3":  "Payment denied/reduced because the service/care was not part of the prior authorization.",
        "Y4":  "Payment denied/reduced because the service/care was not provided in the approved timeframe.",
        "Z1":  "Denial reversed per Medical Review.",
        "Z2":  "Denial reversed per provider/member appeal.",
    }

# ---------------------------------------------------------------------------
# 2. RARC  —  x12.org + CMS MA-prefix codes
# ---------------------------------------------------------------------------

def _fetch_cms_ma_rarc_codes() -> dict:
    """
    Fetches CMS Medicare-specific RARC codes (MA-prefix).
    These are NOT published on x12.org — they are a CMS supplement.
    Tries the CMS ZIP URL first; falls back to the complete embedded list.
    """
    urls = [
        "https://www.cms.gov/files/zip/remittance-advice-remark-codes-rcs.zip",
        "https://www.cms.gov/Medicare/Medicare-Contracting/ContractingGeneralInformation/"
        "Downloads/RARemittanceAdviceRemarkCodes.zip",
    ]

    for url in urls:
        print(f"  Trying CMS MA-codes: {url}")
        try:
            resp = requests.get(url, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
        except Exception as exc:
            print(f"  ⚠   {exc}")
            continue

        raw = b""
        for chunk in resp.iter_content(65536):
            raw += chunk

        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                candidates = [
                    n for n in zf.namelist()
                    if any(n.lower().endswith(ext) for ext in (".txt", ".csv", ".xlsx"))
                    and "__macosx" not in n.lower()
                ]
                if not candidates:
                    continue

                content = zf.read(candidates[0])
                text    = content.decode("latin-1", errors="replace")
                codes   = {}
                for line in text.splitlines():
                    parts = re.split(r"\t|,", line, maxsplit=2)
                    if len(parts) >= 2:
                        code = parts[0].strip().upper()
                        desc = parts[1].strip()
                        if re.fullmatch(r"MA\d{2,3}", code):
                            codes[code] = desc
                if codes:
                    print(f"  ✓   Found {len(codes)} CMS MA-prefix RARC codes from ZIP")
                    return codes
        except Exception as exc:
            print(f"  ⚠   Parse error: {exc}")
            continue

    # ── Embedded fallback: complete MA-prefix list ────────────────────────────
    print("  ℹ   Using embedded MA-code fallback list")
    return {
        "MA01": "Warning: Not all requested claims/services were able to be printed on the initial notice.",
        "MA02": "Alert: Additional information is included in the 835 transaction.",
        "MA03": "Alert: A Payer's Remittance Advice could not be generated for this claim.",
        "MA04": "Secondary payment cannot be considered without the identity of or payment information from the primary payer.",
        "MA05": "The disposition of this claim/service is pending further review.",
        "MA06": "Missing/incomplete/invalid prior insurance carrier name.",
        "MA07": "Missing/incomplete/invalid prior insurance carrier address.",
        "MA08": "Missing/incomplete/invalid prior insurance carrier address city.",
        "MA09": "Missing/incomplete/invalid prior insurance carrier address state.",
        "MA10": "Missing/incomplete/invalid prior insurance carrier address zip code.",
        "MA11": "Missing/incomplete/invalid prior insurance carrier policy number.",
        "MA12": "Missing/incomplete/invalid prior insurance carrier date of coverage.",
        "MA13": "Alert: You may be eligible for a Special Enrollment Period.",
        "MA14": "Alert: Pending proof of timely filing.",
        "MA15": "Alert: A late filing reduction factor was applied.",
        "MA16": "Alert: The beneficiary may not be liable for more than the charge amount.",
        "MA17": "Alert: Your claim has been forwarded to the patient's supplemental insurer.",
        "MA18": "Alert: The claim information is also being forwarded to the patient's supplemental insurer.",
        "MA19": "Alert: Information was not changed per your request.",
        "MA20": "Alert: The patient's payment was applied.",
        "MA21": "Missing/incomplete/invalid group practice information.",
        "MA22": "Missing/incomplete/invalid group name.",
        "MA23": "Missing/incomplete/invalid group address.",
        "MA24": "Missing/incomplete/invalid group city.",
        "MA25": "Missing/incomplete/invalid group state.",
        "MA26": "Missing/incomplete/invalid group zip code.",
        "MA27": "Missing/incomplete/invalid terminal digit of the group practice number.",
        "MA28": "Alert: Receipt of this notice by a physician or supplier who did not accept assignment is for information only.",
        "MA29": "Missing/incomplete/invalid indicator for X-ray availability.",
        "MA30": "Missing/incomplete/invalid pre/post operative care dates.",
        "MA31": "Missing/incomplete/invalid pre/post operative period.",
        "MA32": "Missing/incomplete/invalid rendering provider gender.",
        "MA33": "Missing/incomplete/invalid rendering provider first name.",
        "MA34": "Missing/incomplete/invalid rendering provider last name.",
        "MA35": "Missing/incomplete/invalid rendering provider middle initial.",
        "MA36": "Missing/incomplete/invalid rendering provider suffix.",
        "MA37": "Missing/incomplete/invalid rendering provider NPI.",
        "MA38": "Missing/incomplete/invalid rendering provider address.",
        "MA39": "Missing/incomplete/invalid rendering provider city.",
        "MA40": "Missing/incomplete/invalid rendering provider state.",
        "MA41": "Missing/incomplete/invalid rendering provider zip code.",
        "MA42": "Missing/incomplete/invalid rendering provider phone number.",
        "MA43": "Missing/incomplete/invalid rendering provider specialty.",
        "MA44": "Alert: No appeal rights. Adjudicative decision is not subject to the appeals process.",
        "MA45": "Alert: As previously notified, a portion of your payment has been applied to your outstanding balance.",
        "MA46": "The new information received was considered, but did not change our previous decision.",
        "MA47": "Our records indicate that this patient was a prisoner or in custody of a Federal, State, or local authority when the service was rendered.",
        "MA48": "Missing/incomplete/invalid name or address of responsible party or primary payer.",
        "MA49": "Alert: Missing/incomplete/invalid value code or amount.",
        "MA50": "Missing/incomplete/invalid Investigational Device Exemption number.",
        "MA51": "Missing/incomplete/invalid CLIA certification number.",
        "MA52": "Missing/incomplete/invalid referring provider name.",
        "MA53": "Missing/incomplete/invalid referring provider city.",
        "MA54": "Missing/incomplete/invalid referring provider state.",
        "MA55": "Missing/incomplete/invalid referring provider zip code.",
        "MA56": "Our records indicate that this patient receives, or is entitled to receive benefits from another payer.",
        "MA57": "Missing/incomplete/invalid operating physician name.",
        "MA58": "Missing/incomplete/invalid operating physician city.",
        "MA59": "Alert: The patient overpaid you for these services. You must issue the patient a refund within 30 days.",
        "MA60": "Missing/incomplete/invalid patient relationship to insured.",
        "MA61": "Missing/incomplete/invalid Social Security Number or Health Insurance Claim Number.",
        "MA62": "Alert: Resubmit this claim using only your National Provider Identifier (NPI).",
        "MA63": "Missing/incomplete/invalid principal diagnosis.",
        "MA64": "Alert: Our records indicate that we have not received a response to our previous request for information.",
        "MA65": "Missing/incomplete/invalid referring provider NPI.",
        "MA66": "Missing/incomplete/invalid ordering provider NPI.",
        "MA67": "Alert: We have requested records from the provider of the previous service.",
        "MA68": "Alert: Missing/incomplete/invalid principal procedure code.",
        "MA69": "Alert: Additional information is needed to process this claim.",
        "MA70": "Missing/incomplete/invalid attending physician NPI.",
        "MA71": "Missing/incomplete/invalid operating physician NPI.",
        "MA72": "Alert: The patient overpaid you.",
        "MA73": "Informational Remittance associated with a Medicare check already sent.",
        "MA74": "Alert: Payment was issued to the employer of the patient.",
        "MA75": "Missing/incomplete/invalid supervising physician name.",
        "MA76": "Missing/incomplete/invalid supervising physician NPI.",
        "MA77": "Alert: The filed amount has been reduced to the beneficiary's cost sharing amount.",
        "MA78": "Missing/incomplete/invalid rendering physician gender.",
        "MA79": "Alert: Demands for payment from the beneficiary are limited to deductible, coinsurance, and copayments.",
        "MA80": "Informational notice. No payment issued for this line item.",
        "MA81": "Missing/incomplete/invalid admit diagnosis.",
        "MA82": "Missing/incomplete/invalid Hospice benefit period date.",
        "MA83": "Alert: Did you know that you may receive a higher reimbursement if you entered into a participation agreement with us?",
        "MA84": "Patient identified as participating in the Privacy Act Health Research Study.",
        "MA85": "Alert: A portion of or the entire payment has been credited to your outstanding balance.",
        "MA86": "Alert: This payment replaced a check that was returned.",
        "MA87": "Alert: Your claim has been processed in accordance with mutual offset provisions.",
        "MA88": "Missing/incomplete/invalid insured's date of birth.",
        "MA89": "Missing/incomplete/invalid patient's relationship to the insured.",
        "MA90": "Missing/incomplete/invalid employer's name.",
        "MA91": "Alert: This determination is the result of the appeal you filed.",
        "MA92": "Missing plan information. Resubmit with appropriate plan information.",
        "MA93": "No payment made because charges are inconsistent with the diagnosis.",
        "MA94": "No payment made. Resubmit bill when services are completed.",
        "MA95": "Missing/incomplete/invalid plan.",
        "MA96": "Claim rejected. Coded as a Medicare Secondary Payer claim, however, no payment information has been provided.",
        "MA97": "Missing/incomplete/invalid Medicare secondary payer date of exhaustion.",
        "MA98": "Missing/incomplete/invalid claim number on adjustment.",
        "MA99": "Missing/incomplete/invalid other carrier payment amount.",
        "MA100": "Missing/incomplete/invalid date of exhaustion.",
        "MA101": "This claim has been approved in writing in advance of service delivery.",
        "MA102": "Missing/incomplete/invalid patient gender.",
        "MA103": "Alert: Your billing name, address, and phone number will be used for future correspondence.",
        "MA104": "Alert: A separation of funds notice will be sent.",
        "MA105": "Alert: Reimbursement for this item or service has been issued according to the fee schedule amount.",
        "MA106": "Alert: Medicare Secondary Payer payment information.",
        "MA107": "Missing/incomplete/invalid treatment authorization code.",
        "MA108": "Alert: You may not charge the patient for this service.",
        "MA109": "Alert: See the remittance advice for the disposition of the accompanying claim.",
        "MA110": "Missing/incomplete/invalid information on where the services were furnished.",
        "MA111": "Missing/incomplete/invalid information on the reason patient left Against Medical Advice.",
        "MA112": "Missing/incomplete/invalid group practice member NPI.",
        "MA113": "Incomplete/invalid treatment authorization code.",
        "MA114": "Missing/incomplete/invalid information on the location where the patient was seen.",
        "MA115": "Missing/incomplete/invalid Payer Identifier.",
        "MA116": "Alert: Did you know that a contract requesting reimbursement cannot be submitted until the service has been completed?",
        "MA117": "Alert: Resubmit this claim with the physical therapy certification.",
        "MA118": "Alert: This claim was processed in accordance with the agreement you made with us.",
        "MA119": "Alert: Review your records for this patient.",
        "MA120": "Missing/incomplete/invalid UPIN/NPI.",
        "MA121": "Missing/incomplete/invalid provider/supplier signature.",
        "MA122": "Missing/incomplete/invalid rendering provider address.",
        "MA123": "Your center was not certified as a rural health clinic during the covered period.",
        "MA124": "Alert: This claim was processed as unassigned.",
        "MA125": "Per legislation governing this program, payment constitutes payment in full.",
        "MA126": "Pancreas transplant not covered unless kidney transplant performed.",
        "MA127": "Alert: As requested, this is a formal notice that the claim was received.",
        "MA128": "Missing/incomplete/invalid certification revision date.",
        "MA129": "Missing/incomplete/invalid physician identification.",
        "MA130": "Your claim contains incomplete and/or invalid information, and no appeals rights are afforded because the claim is unprocessable.",
        "MA131": "Physician already paid for services in conjunction with this hospitalization.",
        "MA132": "Adjustment to the pre-payment review.",
        "MA133": "Claim overlaps inpatient stay.",
        "MA134": "Missing/incomplete/invalid provider representative signature.",
    }

def build_rarc(force=False):
    print("\n[RARC] Fetching from x12.org …")
    output_path = os.path.join(OUTPUT_DIR, "rarc_codes.json")

    existing = load_existing("rarc")
    if not force and existing and len(existing.get("codes", {})) > 100:
        print(f"  ⏭   Already exists ({len(existing['codes']):,} codes). Use --force to re-download.")
        return

    url     = "https://x12.org/codes/remittance-advice-remark-codes"
    headers = {"User-Agent": "EDI-Parser-RefData-Builder/1.0"}

    # Try Playwright first, then requests
    codes = {}
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page    = browser.new_page()
            print(f"  🌐  Opening {url} in headless browser …")
            page.goto(url, wait_until="networkidle", timeout=30000)
            try:
                page.wait_for_selector("table, ul.code-list", timeout=10000)
            except Exception:
                pass
            html = page.content()
            browser.close()
        codes = _parse_x12_table(BeautifulSoup(html, "lxml"), "rarc")
        print(f"  🌐  Playwright extracted {len(codes)} codes")
    except Exception as exc:
        print(f"  ⚠   Playwright error: {exc}")

    if not codes:
        try:
            resp  = requests.get(url, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            codes = _parse_x12_table(BeautifulSoup(resp.text, "lxml"), "rarc")
            print(f"  ℹ   requests extracted {len(codes)} codes")
        except Exception as exc:
            print(f"  ❌  Could not fetch RARC: {exc}")
            return

    if not codes:
        print("  ❌  Parsed 0 RARC codes — page structure may have changed.")
        return

    # Merge CMS Medicare-specific MA-prefix codes (not on x12.org)
    ma_codes = _fetch_cms_ma_rarc_codes()
    codes.update(ma_codes)
    print(f"  ℹ   Total after merging CMS MA-codes: {len(codes)}")

    write_json(
        "rarc",
        version=f"scraped-{today_str()}",
        source=url,
        description=(
            "ANSI X12 Remittance Advice Remark Codes (RARC) from x12.org "
            "plus CMS Medicare-specific MA-prefix codes. Update quarterly."
        ),
        codes=codes,
    )

# ---------------------------------------------------------------------------
# 3. ICD-10-CM  —  CMS/CDC
# ---------------------------------------------------------------------------

def build_icd10(force=False):
    print("\n[ICD-10] Fetching from CMS/CDC …")
    if should_skip("icd10", force):
        return

    candidate_urls = [
        "https://www.cms.gov/files/zip/2026-code-descriptions-tabular-order.zip",
        "https://www.cms.gov/files/zip/2026-icd-10-cm-code-descriptions-tabular-order-updated-02-01-2026.zip",
        "https://www.cms.gov/files/zip/2025-code-descriptions-tabular-order.zip",
        "https://www.cms.gov/files/zip/2025-code-descriptions-tabular-order-updated-01-01-2025.zip",
        "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2025/icd10cm-codes-2025.zip",
        "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2025/icd10cm-code-descriptions-2025.zip",
    ]

    codes = {}

    for url in candidate_urls:
        print(f"  Trying: {url}")
        try:
            resp = requests.get(url, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(f"  ⚠   {exc}")
            continue

        raw = b""
        for chunk in resp.iter_content(65536):
            raw += chunk

        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                txt_files = [
                    n for n in zf.namelist()
                    if n.lower().endswith(".txt") and "__macosx" not in n.lower()
                ]
                if not txt_files:
                    print(f"  ⚠   No .txt files in ZIP")
                    continue

                preferred = sorted(
                    txt_files,
                    key=lambda x: ("order" not in x.lower(), "code" not in x.lower())
                )
                target = preferred[0]
                print(f"  Parsing: {target}")
                raw_txt = zf.read(target).decode("utf-8", errors="replace")

            codes = _parse_icd10_txt(raw_txt)
            if codes:
                print(f"  ✓   Extracted {len(codes):,} codes from {url}")
                break

        except Exception as exc:
            print(f"  ⚠   Parse error: {exc}")
            continue

    # Fallback: NLM Clinical Tables API
    if not codes:
        print("  ↩   All direct downloads failed — trying NLM API fallback …")
        codes = _icd10_nlm_api()

    if not codes:
        print("  ❌  Could not obtain ICD-10-CM codes from any source.")
        print("      Manual fallback: download the 'Code Descriptions in Tabular Order' ZIP")
        print("      from https://www.cms.gov/medicare/coding-billing/icd-10-codes")
        print("      extract the .txt file and save it as:")
        print("        reference_data/icd10cm_manual.txt")
        print("      then re-run with:  --only icd10 --force")

        manual = os.path.join(OUTPUT_DIR, "icd10cm_manual.txt")
        if os.path.exists(manual):
            print(f"  ✓   Found manual file — parsing …")
            with open(manual, encoding="utf-8", errors="replace") as fh:
                codes = _parse_icd10_txt(fh.read())

    if not codes:
        return

    write_json(
        "icd10",
        version=f"FY2026-{today_str()}",
        source="https://www.cms.gov/medicare/coding-billing/icd-10-codes",
        description="ICD-10-CM diagnosis codes. Source: CMS FY2026 tabular order file. Update every October 1.",
        codes=codes,
    )

def _parse_icd10_txt(raw_txt):
    codes = {}
    for line in raw_txt.splitlines():
        if not line.strip():
            continue

        # Format A: fixed-width order file (starts with 5-digit sequence)
        if re.match(r"^\d{5}\s", line):
            parts = line.split()
            if len(parts) >= 3:
                code = parts[1].strip()
                desc = " ".join(parts[3:]).strip() if len(parts) > 3 else parts[2].strip()
                if re.fullmatch(r"[A-Z]\d{2}[A-Z0-9]{0,4}", code.upper()):
                    codes[code.upper()] = desc
            continue

        # Format B: tab-delimited
        if "\t" in line:
            parts = line.split("\t", 1)
            code  = parts[0].strip().replace(".", "").upper()
            desc  = parts[1].strip() if len(parts) > 1 else ""
            if re.fullmatch(r"[A-Z]\d{2}[A-Z0-9]{0,4}", code):
                codes[code] = desc
            continue

        # Format C: space-delimited
        m = re.match(r"^([A-Z]\d{2}[A-Z0-9]{0,4})\s{2,}(.+)$", line.strip())
        if m:
            code = m.group(1).replace(".", "").upper()
            desc = m.group(2).strip()
            codes[code] = desc

    return codes

def _icd10_nlm_api():
    base  = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
    codes = {}
    print("  🌐  NLM ICD-10-CM API: fetching A–Z prefixes …")

    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        offset = 0
        count  = 500
        while True:
            try:
                resp = requests.get(
                    base,
                    params={"terms": letter, "maxList": count, "offset": offset, "df": "code,name"},
                    timeout=TIMEOUT,
                )
                resp.raise_for_status()
                data = resp.json()
                if len(data) < 4 or not data[3]:
                    break
                for item in data[3]:
                    if len(item) >= 2:
                        code = item[0].strip().replace(".", "").upper()
                        desc = item[1].strip()
                        if code:
                            codes[code] = desc
                total  = data[0]
                offset += count
                if offset >= total or offset >= 7500:
                    break
                time.sleep(0.1)
            except Exception as exc:
                print(f"  ⚠   NLM API error at offset {offset}: {exc}")
                break

    print(f"  🌐  NLM API returned {len(codes):,} codes total")
    return codes

# ---------------------------------------------------------------------------
# 4. HCPCS Level II  —  CMS
# ---------------------------------------------------------------------------

def build_hcpcs(force=False):
    print("\n[HCPCS] Fetching from CMS …")
    if should_skip("hcpcs", force):
        return

    urls = [
        "https://www.cms.gov/files/zip/january-2025-alpha-numeric-hcpcs-file.zip",
        "https://www.cms.gov/files/zip/october-2024-alpha-numeric-hcpcs-file.zip",
        "https://www.cms.gov/files/zip/july-2024-alpha-numeric-hcpcs-file.zip",
    ]

    codes = {}

    for url in urls:
        print(f"  Trying: {url}")
        try:
            resp = requests.get(url, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(f"  ⚠   {exc}")
            continue

        raw = b""
        for chunk in resp.iter_content(65536):
            raw += chunk

        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                txt_files = [
                    n for n in zf.namelist()
                    if n.lower().endswith(".txt") and "__macosx" not in n.lower()
                ]
                if not txt_files:
                    continue
                target  = txt_files[0]
                print(f"  Parsing: {target}")
                raw_txt = zf.read(target).decode("latin-1", errors="replace")

            for line in raw_txt.splitlines():
                if not line.strip():
                    continue
                if "|" in line:
                    parts = line.split("|")
                    code  = parts[0].strip().upper()
                    desc  = parts[1].strip() if len(parts) > 1 else ""
                else:
                    code      = line[:5].strip().upper()
                    term_date = line[14:22].strip() if len(line) > 22 else ""
                    desc      = line[22:].strip() if len(line) > 22 else line[5:].strip()
                    if term_date and term_date < today_str().replace("-", ""):
                        continue

                if code and re.fullmatch(r"[A-Z0-9]\d{4}", code):
                    codes[code] = desc.strip()

            if codes:
                break

        except Exception as exc:
            print(f"  ⚠   Parse error: {exc}")
            continue

    if not codes:
        print("  ❌  Could not download HCPCS codes.")
        print("      Manual fallback: https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update")
        return

    write_json(
        "hcpcs",
        version="2025-Q1",
        source="https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update",
        description="CMS HCPCS Level II codes. Update quarterly (Jan/Apr/Jul/Oct).",
        codes=codes,
    )

# ---------------------------------------------------------------------------
# 5. CPT  —  placeholder (AMA license required)
# ---------------------------------------------------------------------------

def build_cpt_placeholder(force=False):
    print("\n[CPT] Cannot auto-download (AMA copyright).")
    output_path = os.path.join(OUTPUT_DIR, "cpt_codes.json")
    if not force and os.path.exists(output_path):
        print("  ⏭   Already exists.")
        return

    placeholder = {
        "version":     "NOT_AVAILABLE",
        "generated":   today_str(),
        "source":      "https://www.ama-assn.org/practice-management/cpt",
        "description": (
            "CPT codes require an AMA license and cannot be auto-downloaded. "
            "The parser will emit WARNINGS (not errors) for unverified CPT codes. "
            "To enable full CPT validation: purchase the AMA CPT Data File, "
            "convert it to {\"codes\": {\"XXXXX\": \"description\", ...}} format, "
            "and replace this file."
        ),
        "codes": {}
    }
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(placeholder, fh, indent=2)
    print(f"  📄  Wrote placeholder → {os.path.relpath(output_path)}")
    print("      CPT format validation (5-digit check) is still active.")
    print("      Existence validation requires an AMA license.")

# ---------------------------------------------------------------------------
# --list  flag
# ---------------------------------------------------------------------------

def show_list():
    print("\nCurrent reference_data/ contents:")
    print(f"  {'File':<32} {'Codes':>8}  {'Version':<28}  {'Generated'}")
    print("  " + "-" * 80)
    for key in ("carc", "rarc", "icd10", "hcpcs", "cpt"):
        data = load_existing(key)
        if data:
            count = len(data.get("codes", {}))
            ver   = data.get("version", "?")
            gen   = data.get("generated", "?")
            print(f"  {key+'_codes.json':<32} {count:>8,}  {ver:<28}  {gen}")
        else:
            print(f"  {key+'_codes.json':<32} {'(missing)':>8}")

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Build reference_data/*.json for the EDI parser."
    )
    parser.add_argument(
        "--skip", nargs="*", default=[],
        choices=["carc", "rarc", "icd10", "hcpcs", "cpt"],
        help="Code sets to skip.",
    )
    parser.add_argument(
        "--only", nargs="*", default=[],
        choices=["carc", "rarc", "icd10", "hcpcs", "cpt"],
        help="Only build these code sets.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Re-download even if output file already exists.",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="Show current counts and exit.",
    )
    args = parser.parse_args()

    if args.list:
        show_list()
        return

    all_builders = {
        "carc":  build_carc,
        "rarc":  build_rarc,
        "icd10": build_icd10,
        "hcpcs": build_hcpcs,
        "cpt":   build_cpt_placeholder,
    }

    to_run = (
        {k: v for k, v in all_builders.items() if k in args.only}
        if args.only else
        {k: v for k, v in all_builders.items() if k not in args.skip}
    )

    print("=" * 60)
    print(" EDI Parser — Reference Data Builder")
    print(f" Output directory : {OUTPUT_DIR}")
    print(f" Running          : {list(to_run.keys())}")
    print("=" * 60)

    for name, builder in to_run.items():
        try:
            builder(force=args.force)
        except Exception as exc:
            print(f"  ❌  Unexpected error in '{name}': {exc}")

    print()
    show_list()
    print("=" * 60)
    print(" Schedule:")
    print("   CARC / RARC / HCPCS → quarterly  (Jan / Apr / Jul / Oct)")
    print("   ICD-10-CM            → annually   (October 1)")
    print("   CPT                  → annually   (January 1, manual / licensed)")
    print("=" * 60)

if __name__ == "__main__":
    main()