from core_parser.edi_parser import EDIParser
from core_parser.reconciler_834 import _extract_all_members
import json

edi = """ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *210101*1200*U*00401*000000001*0*P*>~
GS*BE*SENDER*RECEIVER*20210101*1200*1*X*004010X095A1~
ST*834*0001*004010X095A1~
BGN*00*123*20210101*1200~
N1*P5*SPONSOR~
INS*Y*18*021*21~
REF*0F*12345~
NM1*IL*1*SMITH*JOHN~
HD*030**HLT*PLAN*EMP~
DTP*348*D8*20210101~
SE*10*0001~
GE*1*1~
IEA*1*000000001~"""

with open('test_834.edi', 'w') as f:
    f.write(edi.replace('\n', ''))

parser = EDIParser('test_834.edi')
tree = parser.parse()

# Print loops
print("LOOPS:", list(tree.get('loops', {}).keys()))

# Extract members
parsed_obj = {"status": "success", "data": tree}
members = _extract_all_members(parsed_obj)

print("MEMBERS:", json.dumps(members, indent=2))
