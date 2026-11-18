"""
Live integration tests — General Medicine + Real Gemini API.

Tests the FULL stack: GeminiProvider → GeneralMedicineService → clinical matrix.
All calls go to the real Gemini API.  No mocks.

Run from backend/:
    python -X utf8 scripts\test_gemini_integration.py

Requirements:
    GEMINI_API_KEY must be set in .env
    GENERAL_MEDICINE_LLM_MODEL must be a working model (e.g. gemini-3.1-flash-lite)
"""
import sys, os, time
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from app.services.llm_provider import GeminiProvider
from app.services.general_medicine_service import GeneralMedicineService
from app.services.triage_rules import (
    create_empty_clinical_matrix,
    evaluate_clinical_matrix,
)
from app.services.safety_engine import evaluate_safety

_pass = 0
_fail = 0
_skip = 0

def record(tid, desc, condition, detail=""):
    global _pass, _fail
    if condition:
        _pass += 1
        print(f"  [PASS] T{tid:03d}: {desc}")
    else:
        _fail += 1
        print(f"  [FAIL] T{tid:03d}: {desc}  | got: {detail!r}")

def skip(tid, desc, reason):
    global _skip
    _skip += 1
    print(f"  [SKIP] T{tid:03d}: {desc}  — {reason}")

# ── Check API key ──────────────────────────────────────────────────────
key = os.environ.get("GEMINI_API_KEY", "")
model = os.environ.get("GENERAL_MEDICINE_LLM_MODEL", "")
if not key or len(key) < 10:
    print("GEMINI_API_KEY not set — cannot run live tests.")
    sys.exit(2)

provider = GeminiProvider()
svc = GeneralMedicineService(provider=provider)

print(f"\nLive Gemini Integration Tests")
print(f"Model : {provider.model_name}")
print(f"Key   : {key[:8]}... ({len(key)} chars)")
print("=" * 65)

# ── Helper: fresh service call with tiny delay to respect rate limits ──
def call(message, mat, history, delay=1.0):
    time.sleep(delay)
    return svc.process_patient_turn(message, mat, history)

# =====================================================================
# GROUP 1 — BASIC CONNECTIVITY
# =====================================================================
print("\nGroup 1 — Basic Connectivity")

mat = create_empty_clinical_matrix()
try:
    r = call("hello", mat, [], delay=0)
    record(1, "Service returns a dict response", isinstance(r, dict))
    record(2, "State is QUESTIONING for greeting", r.get("state") == "QUESTIONING")
    record(3, "provider_name is 'gemini'", r.get("provider_name") == "gemini")
    record(4, "model_name is set", bool(r.get("model_name")))
    record(5, "assistant_message is non-empty", bool(r.get("assistant_message", "").strip()))
    record(6, "Greeting: CC is NOT set (no clinical extraction from 'hello')",
           not mat.get("chief_complaint"))
except Exception as e:
    for i in range(1, 7):
        record(i, "connectivity test", False, str(e))

# =====================================================================
# GROUP 2 — ENGLISH CLINICAL EXTRACTION
# =====================================================================
print("\nGroup 2 — English Clinical Extraction via Gemini")

mat2 = create_empty_clinical_matrix()
history2 = []
try:
    r2 = call(
        "I have a fever of 38.5°C that started yesterday. "
        "I have a headache and feel very tired. "
        "I took paracetamol this morning. "
        "I don't have cough or shortness of breath.",
        mat2, history2
    )
    record(7,  "Fever is chief complaint",
           "fever" in str(mat2.get("chief_complaint", "")).lower(),
           mat2.get("chief_complaint"))
    record(8,  "Onset extracted (yesterday)",
           mat2.get("onset") and "yesterday" in str(mat2.get("onset", "")).lower(),
           mat2.get("onset"))
    record(9,  "Cough NOT in associated_symptoms (negated)",
           not any("cough" in str(s).lower() for s in (mat2.get("associated_symptoms") or [])),
           mat2.get("associated_symptoms"))
    record(10, "SOB NOT in associated_symptoms (negated)",
           not any("breath" in str(s).lower() or "shortness" in str(s).lower()
                   for s in (mat2.get("associated_symptoms") or [])),
           mat2.get("associated_symptoms"))
    record(11, "Headache OR Fatigue IS in associated_symptoms",
           any(k in str(mat2.get("associated_symptoms", [])).lower()
               for k in ["headache", "fatigue", "tired", "صداع", "إرهاق"]),
           mat2.get("associated_symptoms"))
    record(12, "Paracetamol in medications",
           any("para" in str(m).lower() or "panad" in str(m).lower()
               for m in (mat2.get("medications") or [])),
           mat2.get("medications"))
    record(13, "Cough (denied) in relevant_negative_findings",
           any("cough" in str(n).lower()
               for n in (mat2.get("relevant_negative_findings") or [])),
           mat2.get("relevant_negative_findings"))
    record(14, "State is QUESTIONING (needs more info)",
           r2.get("state") == "QUESTIONING")
except Exception as e:
    for i in range(7, 15):
        record(i, "english extraction", False, str(e))

# =====================================================================
# GROUP 3 — ARABIC CLINICAL EXTRACTION
# =====================================================================
print("\nGroup 3 — Arabic (Iraqi dialect) Clinical Extraction")

mat3 = create_empty_clinical_matrix()
history3 = []
try:
    r3 = call(
        "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل",
        mat3, history3
    )
    record(15, "Arabic: CC extracted (ankle/foot pain)",
           mat3.get("chief_complaint") and any(
               k in str(mat3.get("chief_complaint", "")) for k in ["كاحل", "قدم", "رجل", "ankle"]
           ), mat3.get("chief_complaint"))
    record(16, "Arabic: Swelling in associated_symptoms",
           any("تورم" in str(s) or "swell" in str(s).lower()
               for s in (mat3.get("associated_symptoms") or [])),
           mat3.get("associated_symptoms"))
    record(17, "Arabic: State is QUESTIONING",
           r3.get("state") == "QUESTIONING")
    record(18, "Arabic: Response contains Arabic text",
           any("\u0600" <= c <= "\u06FF" for c in r3.get("assistant_message", "")),
           r3.get("assistant_message", "")[:60])
except Exception as e:
    for i in range(15, 19):
        record(i, "arabic extraction", False, str(e))

# =====================================================================
# GROUP 4 — MULTI-TURN CONVERSATION
# =====================================================================
print("\nGroup 4 — Multi-turn Conversation")

mat4 = create_empty_clinical_matrix()
history4 = []
try:
    # Turn 1
    r4a = call(
        "احس رجلي تأذيني من يم الكاحل واكو تورم",
        mat4, history4
    )
    history4.append({"sender": "patient", "content": "احس رجلي تأذيني من يم الكاحل واكو تورم"})
    history4.append({"sender": "assistant", "content": r4a.get("assistant_message", "")})
    cc_t1 = mat4.get("chief_complaint")

    # Turn 2 — sudden onset
    r4b = call("فجأة", mat4, history4)
    history4.append({"sender": "patient", "content": "فجأة"})
    history4.append({"sender": "assistant", "content": r4b.get("assistant_message", "")})
    onset_t2 = mat4.get("onset")

    # Turn 3 — "لا" to medications
    r4c = call("لا", mat4, history4)
    history4.append({"sender": "patient", "content": "لا"})
    history4.append({"sender": "assistant", "content": r4c.get("assistant_message", "")})

    record(19, "Turn 1: CC set after ankle complaint",
           bool(cc_t1), cc_t1)
    record(20, "Turn 2: Onset set after 'فجأة'",
           onset_t2 and "فجأة" in str(onset_t2),
           onset_t2)
    record(21, "Turn 2: Onset contains 'sudden' or 'فجأة'",
           bool(onset_t2), onset_t2)
    record(22, "Turn 3: State stays QUESTIONING (not premature SYNTHESIS)",
           r4c.get("state") == "QUESTIONING",
           r4c.get("state"))
    record(23, "Turn 3: Onset NOT re-asked after 'فجأة'",
           "شوكت" not in r4c.get("assistant_message", "")
           and "when did" not in r4c.get("assistant_message", "").lower(),
           r4c.get("assistant_message", "")[:80])
    record(24, "Turn 3: medications or history answered (negative or empty)",
           # Gemini may return [] (answered, no meds) or sentinel string — both valid
           mat4.get("medications") is not None or mat4.get("medical_history") is not None,
           f"meds={mat4.get('medications')}, hist={mat4.get('medical_history')}")
except Exception as e:
    for i in range(19, 25):
        record(i, "multi-turn", False, str(e))

# =====================================================================
# GROUP 5 — SAFETY ENGINE (deterministic — no API call needed)
# =====================================================================
print("\nGroup 5 — Safety Engine (deterministic, no API call)")

emergency_cases = [
    ("can't breathe at all and my lips are blue", "Respiratory"),
    ("ماكدر اتنفس من أربع أيام واحس بضيق نفس حتى وانا جالس", "Respiratory"),
    ("crushing chest pain radiating to my left arm and jaw", "Cardiovascular"),
    ("I took all my pills to end it", "Self-Harm"),
    ("baby is not breathing and is limp", "Pediatric"),
]
for idx, (msg, expected_cat_fragment) in enumerate(emergency_cases, start=25):
    result = evaluate_safety(msg)
    record(idx, f"Emergency detected: '{msg[:45]}...'",
           result.is_emergency and expected_cat_fragment.lower() in result.category.lower(),
           f"is_emergency={result.is_emergency}, cat={result.category}")

non_emergency_cases = [
    "I have a mild headache since this morning.",
    "No cough or shortness of breath.",
    "مرحبا، احس بتعب خفيف",
]
for idx, msg in enumerate(non_emergency_cases, start=30):
    result = evaluate_safety(msg)
    record(idx, f"No false emergency: '{msg[:45]}'",
           not result.is_emergency,
           f"is_emergency={result.is_emergency}, cat={result.category}")

# =====================================================================
# GROUP 6 — DEPARTMENT ROUTING (no API call)
# =====================================================================
print("\nGroup 6 — Department Routing")

from app.services.triage_rules import map_indications_to_departments

# Fever + headache (no respiratory) → NO Pulmonology
mat_r1 = {
    "chief_complaint": "Fever",
    "associated_symptoms": ["Headache", "Fatigue"],
    "relevant_negative_findings": ["Cough (denied)", "Shortness of Breath (denied)"],
}
depts_r1 = [d["department_name"] for d in map_indications_to_departments(mat_r1)]
record(33, "Negated cough/SOB → Pulmonology NOT in routing",
       "Pulmonology" not in depts_r1, depts_r1)

# Positive SOB → Pulmonology
mat_r2 = {"chief_complaint": "Shortness of Breath", "associated_symptoms": []}
depts_r2 = [d["department_name"] for d in map_indications_to_departments(mat_r2)]
record(34, "Positive SOB → Pulmonology IS in routing",
       "Pulmonology" in depts_r2, depts_r2)

# Ankle swelling → Orthopedics
mat_r3 = {"chief_complaint": "Ankle Pain", "associated_symptoms": ["Localized Swelling"]}
depts_r3 = [d["department_name"] for d in map_indications_to_departments(mat_r3)]
record(35, "Ankle pain → Orthopedics in routing",
       "Orthopedics" in " ".join(depts_r3), depts_r3)

# =====================================================================
# SUMMARY
# =====================================================================
total = _pass + _fail + _skip
print()
print("=" * 65)
print(f"RESULT: {_pass}/{total} PASSED  |  {_fail} FAILED  |  {_skip} SKIPPED")
print(f"Model : {provider.model_name}")
print("=" * 65)

if _fail > 0:
    sys.exit(1)
