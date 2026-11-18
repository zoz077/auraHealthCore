"""
Regression tests for Bug 1 (negation handling) and Bug 2 (context-aware negative answers).
Run from backend/: python -X utf8 scripts\test_negation_and_negative_answers.py
"""
import sys
import re
sys.path.insert(0, ".")

from app.services.triage_rules import (
    extract_clinical_facts,
    create_empty_clinical_matrix,
    map_indications_to_departments,
    is_symptom_negated,
)
from app.services.general_medicine_service import GeneralMedicineService
from app.services.llm_provider import MockLLMProvider

_pass = 0
_fail = 0

def record(tid, desc, condition, detail=""):
    global _pass, _fail
    if condition:
        _pass += 1
        print(f"  [PASS] T{tid:03d}: {desc}")
    else:
        _fail += 1
        print(f"  [FAIL] T{tid:03d}: {desc} | detail: {detail!r}")


def make_svc():
    """Fresh service with forced-fallback mock per call."""
    return GeneralMedicineService(provider=MockLLMProvider(response_sequence=[
        {"type": "error", "message": "forced fallback"}
    ]))


# ─────────────────────────────────────────────────────────────────────
# TEST A: Negated cough and SOB are NOT positive symptoms
# ─────────────────────────────────────────────────────────────────────
print("\nA. Negated cough and SOB — not positive symptoms")

MSG = ("I have a fever of 38.5C that started yesterday. "
       "I have a headache and feel tired. "
       "I took paracetamol this morning. "
       "I don't have cough or shortness of breath.")

mat = create_empty_clinical_matrix()
upd, updates = extract_clinical_facts(MSG, mat, "en")

syms = upd.get("associated_symptoms") or []
neg  = upd.get("relevant_negative_findings") or []

record(1, "Cough is NOT in associated_symptoms",
       not any("cough" in s.lower() for s in syms),
       str(syms))
record(2, "Shortness of Breath is NOT in associated_symptoms",
       not any("breath" in s.lower() or "shortness" in s.lower() for s in syms),
       str(syms))
record(3, "Fatigue IS in associated_symptoms",
       any("fatigue" in s.lower() or "إرهاق" in s for s in syms),
       str(syms))
record(4, "Headache IS in associated_symptoms",
       any("headache" in s.lower() or "صداع" in s for s in syms),
       str(syms))
record(5, "Cough (denied) IS in negative_findings",
       any("cough" in n.lower() for n in neg),
       str(neg))
record(6, "Shortness of Breath (denied) IS in negative_findings",
       any("breath" in n.lower() or "shortness" in n.lower() for n in neg),
       str(neg))
record(7, "Chief complaint is Fever",
       "fever" in str(upd.get("chief_complaint", "")).lower(),
       str(upd.get("chief_complaint")))
record(8, "Paracetamol in medications",
       any("para" in str(m).lower() or "panad" in str(m).lower() for m in (upd.get("medications") or [])),
       str(upd.get("medications")))

# ─────────────────────────────────────────────────────────────────────
# TEST B: Negated respiratory symptoms do NOT trigger Pulmonology routing
# ─────────────────────────────────────────────────────────────────────
print("\nB. Negated respiratory symptoms — no Pulmonology routing")

depts = map_indications_to_departments(upd)
dept_names = [d["department_name"] for d in depts]

record(9, "Pulmonology NOT in departments when cough/SOB are denied",
       "Pulmonology" not in dept_names,
       str(dept_names))
record(10, "General Medicine IS in departments (correct fallback)",
       any("General Medicine" in n or "Neurology" in n for n in dept_names),
       str(dept_names))

# ─────────────────────────────────────────────────────────────────────
# TEST B2: SOB as positive complaint DOES trigger Pulmonology
# ─────────────────────────────────────────────────────────────────────
print("\nB2. Positive SOB — Pulmonology should be triggered")

mat_sob = create_empty_clinical_matrix()
upd_sob, _ = extract_clinical_facts(
    "I have shortness of breath and a tight chest.", mat_sob, "en"
)
depts_sob = map_indications_to_departments(upd_sob)
dept_names_sob = [d["department_name"] for d in depts_sob]

record(11, "Pulmonology IS triggered for positive SOB complaint",
       "Pulmonology" in dept_names_sob,
       str(dept_names_sob))

# ─────────────────────────────────────────────────────────────────────
# TEST C: "لا" after medication question → medications answered-negative
# ─────────────────────────────────────────────────────────────────────
print("\nC. 'لا' after medication question → medications answered-negative")

svc = make_svc()
mat = create_empty_clinical_matrix()
history = []

# T1: ankle complaint
r1 = svc.process_patient_turn(
    "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف",
    mat, history
)
history.append({"sender": "patient", "content": "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف"})
history.append({"sender": "assistant", "content": r1["assistant_message"]})

# T2: sudden onset
r2 = svc.process_patient_turn("فجأة", mat, history)
history.append({"sender": "patient", "content": "فجأة"})
history.append({"sender": "assistant", "content": r2["assistant_message"]})

# T3: "لا" to medication/history question
r3 = svc.process_patient_turn("لا", mat, history)

record(12, "T3 state is QUESTIONING (not SYNTHESIS)",
       r3.get("state") == "QUESTIONING",
       r3.get("state"))
record(13, "T3 onset is still set after 'لا'",
       bool(mat.get("onset")),
       str(mat.get("onset")))
record(14, "T3 medications OR medical_history is answered-negative",
       (mat.get("medications") or mat.get("medical_history")),
       f"meds={mat.get('medications')!r}, hist={mat.get('medical_history')!r}")
record(15, "T3 does NOT ask onset question again",
       "when" not in r3.get("assistant_message", "").lower()
       and "شوكت" not in r3.get("assistant_message", "")
       and "onset" not in r3.get("assistant_message", "").lower(),
       r3.get("assistant_message", "")[:80])
record(16, "T3 onset is NOT in missing axes",
       "onset" not in r3.get("clinical_updates", {}).get("_missing", [])
       and not (mat.get("onset") is None),
       str(mat.get("onset")))

# ─────────────────────────────────────────────────────────────────────
# TEST D: "لا" after chronic disease question → medical_history answered-negative
# ─────────────────────────────────────────────────────────────────────
print("\nD. 'لا' after chronic disease question → medical_history answered-negative")

svc2 = make_svc()
mat2 = create_empty_clinical_matrix()
history2 = []

r2a = svc2.process_patient_turn("I have a headache and fever for 2 days", mat2, history2)
history2.append({"sender": "patient", "content": "I have a headache and fever for 2 days"})
history2.append({"sender": "assistant", "content": r2a["assistant_message"]})

# Simulate a chronic disease question as the last assistant message
history2.append({"sender": "assistant",
    "content": "Do you have any chronic conditions or existing medical history?"})

r2b = svc2.process_patient_turn("no", mat2, history2)

record(17, "medical_history answered-negative after 'no' to chronic-disease question",
       bool(mat2.get("medical_history")),
       str(mat2.get("medical_history")))
record(18, "State is QUESTIONING (not SYNTHESIS) after single negative answer",
       r2b.get("state") == "QUESTIONING",
       r2b.get("state"))

# ─────────────────────────────────────────────────────────────────────
# TEST E: "لا" to a non-medication/history question does NOT set medication/history
# ─────────────────────────────────────────────────────────────────────
print("\nE. 'لا' to a general yes/no question → correct axis, not medication")

svc3 = make_svc()
mat3 = create_empty_clinical_matrix()
history3 = [
    {"sender": "assistant",
     "content": "Did anything specific happen before the symptoms started, like a fall or physical exertion?"}
]
mat3["chief_complaint"] = "Ankle Pain"
mat3["onset"] = "Started 3 days ago"
mat3["associated_symptoms"] = ["Localized Swelling"]

r3x = svc3.process_patient_turn("no", mat3, history3)

record(19, "trigger question 'no' → triggers answered-negative (not medications)",
       bool(mat3.get("triggers")),
       str(mat3.get("triggers")))
record(20, "medications NOT set when 'no' was to trigger question",
       not mat3.get("medications"),
       str(mat3.get("medications")))

# ─────────────────────────────────────────────────────────────────────
# TEST F: Full flow — فجأة then لا → no repeated onset Q, no premature synthesis
# ─────────────────────────────────────────────────────────────────────
print("\nF. Full flow — فجأة then لا — no repeated onset, no premature synthesis")

svc4 = make_svc()
mat4 = create_empty_clinical_matrix()
history4 = []

rf1 = svc4.process_patient_turn(
    "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل",
    mat4, history4
)
history4.append({"sender": "patient", "content": "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل"})
history4.append({"sender": "assistant", "content": rf1["assistant_message"]})

rf2 = svc4.process_patient_turn("فجأة", mat4, history4)
history4.append({"sender": "patient", "content": "فجأة"})
history4.append({"sender": "assistant", "content": rf2["assistant_message"]})

rf3 = svc4.process_patient_turn("لا", mat4, history4)
history4.append({"sender": "patient", "content": "لا"})
history4.append({"sender": "assistant", "content": rf3["assistant_message"]})

record(21, "F: onset is set after 'فجأة'",
       bool(mat4.get("onset")),
       str(mat4.get("onset")))
record(22, "F: T3 state is QUESTIONING (not SYNTHESIS)",
       rf3.get("state") == "QUESTIONING",
       rf3.get("state"))
record(23, "F: T3 does NOT repeat onset question",
       "شوكت" not in rf3.get("assistant_message", "")
       and "when did" not in rf3.get("assistant_message", "").lower(),
       rf3.get("assistant_message", "")[:80])
record(24, "F: medications or history answered-negative in mat4",
       bool(mat4.get("medications") or mat4.get("medical_history")),
       f"meds={mat4.get('medications')!r}, hist={mat4.get('medical_history')!r}")

# Check a 4th turn to confirm it doesn't jump to synthesis immediately
rf4 = svc4.process_patient_turn("لا ما عندي أمراض", mat4, history4)
record(25, "F: T4 state is QUESTIONING or SYNTHESIS (not an error)",
       rf4.get("state") in ("QUESTIONING", "SYNTHESIS"),
       rf4.get("state"))

# ─────────────────────────────────────────────────────────────────────
# ADDITIONAL: Arabic negation patterns
# ─────────────────────────────────────────────────────────────────────
print("\nG. Arabic negation patterns")

ar_msg = "احس بحمى وصداع. ما عندي كحة ولا ضيق تنفس."
mat_ar = create_empty_clinical_matrix()
upd_ar, _ = extract_clinical_facts(ar_msg, mat_ar, "ar")

syms_ar = upd_ar.get("associated_symptoms") or []
neg_ar  = upd_ar.get("relevant_negative_findings") or []

record(26, "Arabic: cough NOT in associated_symptoms",
       not any("سعال" in s or "كحة" in s for s in syms_ar),
       str(syms_ar))
record(27, "Arabic: headache IS in associated_symptoms",
       any("صداع" in s for s in syms_ar),
       str(syms_ar))
record(28, "Arabic: cough (denied) in negative_findings",
       any("سعال" in n or "كحة" in n for n in neg_ar),
       str(neg_ar))

# ─────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────
print()
print("=" * 70)
print(f"RESULT: {_pass}/{_pass + _fail} PASSED   |   {_fail} FAILED")
print("=" * 70)

if _fail > 0:
    sys.exit(1)
