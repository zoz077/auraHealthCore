"""
Live Gemini smoke test for General Medicine service.
"""
import sys, os
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from app.services.llm_provider import GeminiProvider
from app.services.general_medicine_service import GeneralMedicineService
from app.services.triage_rules import create_empty_clinical_matrix

provider = GeminiProvider()
svc = GeneralMedicineService(provider=provider)

print("Testing General Medicine with LIVE Gemini...")
print(f"Model: {provider.model_name}")
print()

# Test 1: Greeting
mat = create_empty_clinical_matrix()
r = svc.process_patient_turn("hi", mat, [])
print("User:  hi")
print(f"State: {r['state']}")
print(f"Bot:   {r['assistant_message'][:200]}")
print()

# Test 2: Clinical English
mat2 = create_empty_clinical_matrix()
r2 = svc.process_patient_turn(
    "I have a fever of 38.5C since yesterday and a headache.",
    mat2, []
)
print("User:  I have a fever of 38.5C since yesterday and a headache.")
print(f"State: {r2['state']}")
print(f"Bot:   {r2['assistant_message'][:200]}")
print(f"CC:    {mat2.get('chief_complaint')}")
print(f"Onset: {mat2.get('onset')}")
print(f"Model: {r2.get('provider_name')}/{r2.get('model_name')}")
print()

# Test 3: Arabic
mat3 = create_empty_clinical_matrix()
r3 = svc.process_patient_turn(
    "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف",
    mat3, []
)
print("User:  احس رجلي تأذيني من يم الكاحل واكو تورم خفيف")
print(f"State: {r3['state']}")
print(f"Bot:   {r3['assistant_message'][:200]}")
print(f"CC:    {mat3.get('chief_complaint')}")
print()

print("=" * 50)
print("GENERAL MEDICINE + LIVE GEMINI: PASS")
print("=" * 50)
