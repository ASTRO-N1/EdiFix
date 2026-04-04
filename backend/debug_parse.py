import json, sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core_parser.edi_parser import EDIParser

EDI_837 = """\
ISA*00*          *00*          *ZZ*PROVIDER123   *ZZ*PAYER456      *250404*0800*^*00501*000000001*0*T*:~
GS*HC*PROVIDER123*PAYER456*20250404*0800*1*X*005010X222A1~
ST*837*0001~
BHT*0019*00*12345*20250404*0800*CH~
NM1*41*2*PROVIDER CLINIC*****46*123456789~
NM1*40*2*INSURANCE PAYER*****46*987654321~
HL*1**20*1~
NM1*85*2*PROVIDER CLINIC*****XX*1234567890~
HL*2*1*22*0~
SBR*P*18*******MC~
NM1*IL*1*DOE*JOHN****MI*123456789~
CLM*CLAIM123*500***11:B:1*Y*A*Y*Y~
HI*ABK:J189~
LX*1~
SV1*HC:99213*300*UN*1***1~
DTP*472*D8*20250403~
LX*2~
SV1*HC:87070*200*UN*1***1~
DTP*472*D8*20250403~
SE*20*0001~
GE*1*1~
IEA*1*000000001~"""

EDI_835 = """\
ISA*00*          *00*          *ZZ*PAYER456      *ZZ*PROVIDER123   *250405*0900*^*00501*000000002*0*T*:~
GS*HP*PAYER456*PROVIDER123*20250405*0900*2*X*005010X221A1~
ST*835*0002~
BPR*I*400*C*CHK************20250405~
TRN*1*1234567890*9876543210~
N1*PR*INSURANCE PAYER~
N1*PE*PROVIDER CLINIC~
CLP*CLAIM123*1*500*400*100*MC*123456789*11*1~
NM1*QC*1*DOE*JOHN~
SVC*HC:99213*300*250~
CAS*CO*45*50~
DTP*472*D8*20250403~
SVC*HC:87070*200*150~
CAS*CO*45*50~
DTP*472*D8*20250403~
SE*18*0002~
GE*1*2~
IEA*1*000000002~"""

def inspect(edi_str, label):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.edi', delete=False, encoding='utf-8') as f:
        f.write(edi_str)
        tmp = f.name
    try:
        parser = EDIParser(tmp)
        tree = parser.parse()
    finally:
        os.unlink(tmp)

    print(f"\n{'='*70}")
    print(f"  {label}  — loop keys: {list(tree.get('loops', {}).keys())}")
    for loop_key, instances in tree.get('loops', {}).items():
        print(f"\n  [{loop_key}]  ({len(instances)} instance[s])")
        for i, inst in enumerate(instances):
            print(f"    instance[{i}] segment keys: {list(inst.keys())}")
            for seg_key, seg_val in inst.items():
                if isinstance(seg_val, dict):
                    print(f"      {seg_key}: raw_data={seg_val.get('raw_data')}")
                elif isinstance(seg_val, list):
                    for j, sv in enumerate(seg_val):
                        if isinstance(sv, dict):
                            print(f"      {seg_key}[{j}]: raw_data={sv.get('raw_data')}")

inspect(EDI_837, "837")
inspect(EDI_835, "835")
