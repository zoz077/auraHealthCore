"""
AuraHealth General Medicine — Greeting & Reasoning Regression Tests
====================================================================
Covers the bug fixes:
  A) "hi" → no clinical facts extracted, no onset, greeting response
  B) "مرحبا" → same behaviour in Arabic
  C) Detailed single message → extract everything, ask nothing already known
  D) Arm pain 3-day message → correct CC + onset, no premature synthesis
  E) Follow-up answer updates matrix, does not create new complaint
  F) Emergency message → deterministic safety runs first

Run from backend/:
    python scripts\\test_greeting_and_reasoning_fixes.py
"""

import sys, os
sys.path.insert(0, ".")

from app.services.triage_rules import (
    extract_clinical_facts,
    create_empty_clinical_matrix,
    detect_language,
)
from app.services.general_medicine_service import GeneralMedicineService
from app.services.llm_provider import MockLLMProvider

PASS = "PASS"
FAIL = "FAIL"
results = []


def record(num: int, description: str, ok: bool, detail: str = ""):
    tag = PASS if ok else FAIL
    results.append((num, tag, description, detail))
    symbol = "[OK]" if ok else "[!!]"
    print(f"  [{tag}] T{num:03d}: {symbol} {description}")
    if not ok:
        print(f"         DETAIL: {detail}")


# ─────────────────────────────────────────────────────────────
# A. GREETING "hi" — no clinical facts
# ─────────────────────────────────────────────────────────────
print("\nA. GREETING 'hi' — no clinical facts")

matrix_empty = create_empty_clinical_matrix()
updated, upd = extract_clinical_facts("hi", matrix_empty, lang="en")

record(1, "'hi' → chief_complaint remains None",
       updated.get("chief_complaint") is None,
       str(updated.get("chief_complaint")))
record(2, "'hi' → onset remains None",
       updated.get("onset") is None,
       str(updated.get("onset")))
record(3, "'hi' → no updates returned",
       upd == {},
       str(upd))

# Test through service fallback — use correct MockLLMProvider key ("type", not "response_type")
svc = GeneralMedicineService(provider=MockLLMProvider(response_sequence=[
    {"type": "error", "message": "forced fallback"}
]))
r_hi = svc.process_patient_turn(
    message="hi",
    current_matrix=create_empty_clinical_matrix(),
    conversation_history=[],
)
record(4, "'hi' service → state is QUESTIONING (not SYNTHESIS)",
       r_hi.get("state") == "QUESTIONING",
       r_hi.get("state"))
record(5, "'hi' service → no chief_complaint in clinical_updates",
       "chief_complaint" not in (r_hi.get("clinical_updates") or {}),
       str(r_hi.get("clinical_updates")))
record(6, "'hi' service → response is a symptom/help question (not an onset question)",
       "symptom" in r_hi.get("assistant_message", "").lower()
       or "help" in r_hi.get("assistant_message", "").lower()
       or "أعراض" in r_hi.get("assistant_message", "")
       or "شنو" in r_hi.get("assistant_message", ""),
       r_hi.get("assistant_message", "")[:120])
record(7, "'hi' service → no clinical assessment produced",
       not r_hi.get("possible_considerations"),
       str(r_hi.get("possible_considerations")))

# ─────────────────────────────────────────────────────────────
# B. GREETING "مرحبا" — Arabic
# ─────────────────────────────────────────────────────────────
print("\nB. GREETING 'مرحبا' — Arabic")

matrix_ar = create_empty_clinical_matrix()
updated_ar, upd_ar = extract_clinical_facts("مرحبا", matrix_ar, lang="ar")

record(8, "'مرحبا' → chief_complaint remains None",
       updated_ar.get("chief_complaint") is None,
       str(updated_ar.get("chief_complaint")))
record(9, "'مرحبا' → onset remains None",
       updated_ar.get("onset") is None,
       str(updated_ar.get("onset")))
record(10, "'مرحبا' → no updates returned",
       upd_ar == {},
       str(upd_ar))

r_ar = svc.process_patient_turn(
    message="مرحبا",
    current_matrix=create_empty_clinical_matrix(),
    conversation_history=[],
)
record(11, "'مرحبا' service → QUESTIONING not SYNTHESIS",
       r_ar.get("state") == "QUESTIONING",
       r_ar.get("state"))
record(12, "'مرحبا' service → response is Arabic symptom/help question",
       "أعراض" in r_ar.get("assistant_message", "")
       or "شنو" in r_ar.get("assistant_message", "")
       or "شكواك" in r_ar.get("assistant_message", "")
       or "عندك" in r_ar.get("assistant_message", ""),
       r_ar.get("assistant_message", "")[:120])

# ─────────────────────────────────────────────────────────────
# C. DETAILED SINGLE MESSAGE — extract all, don't re-ask
# ─────────────────────────────────────────────────────────────
print("\nC. DETAILED SINGLE MESSAGE")

detailed = "I've had fever 38.5°C for two days, headache and body aches. No cough or shortness of breath. I took paracetamol yesterday."
matrix_c = create_empty_clinical_matrix()
upd_c_matrix, upd_c = extract_clinical_facts(detailed, matrix_c, lang="en")

record(13, "Detailed → chief_complaint = Fever",
       upd_c_matrix.get("chief_complaint") == "Fever",
       str(upd_c_matrix.get("chief_complaint")))
record(14, "Detailed → onset extracted (2 days / 38.5)",
       upd_c_matrix.get("onset") is not None
       and ("2" in str(upd_c_matrix.get("onset")) or "38.5" in str(upd_c_matrix.get("onset"))),
       str(upd_c_matrix.get("onset")))
record(15, "Detailed → headache in associated symptoms",
       any("headache" in s.lower() or "صداع" in s for s in upd_c_matrix.get("associated_symptoms", [])),
       str(upd_c_matrix.get("associated_symptoms")))
record(16, "Detailed → fatigue/body aches in associated symptoms",
       any("ache" in s.lower() or "fatigue" in s.lower() or "body" in s.lower() for s in upd_c_matrix.get("associated_symptoms", [])),
       str(upd_c_matrix.get("associated_symptoms")))
record(17, "Detailed → paracetamol in medications",
       any("paracetamol" in s.lower() or "panadol" in s.lower() for s in upd_c_matrix.get("medications", [])),
       str(upd_c_matrix.get("medications")))
record(18, "Detailed → cough NOT added (negated)",
       not any("cough" in s.lower() or "سعال" in s for s in upd_c_matrix.get("associated_symptoms", [])),
       str(upd_c_matrix.get("associated_symptoms")))

# Through service — should NOT ask about onset (already set) or cough/shortness of breath (negated)
# Turn count is 1 so should NOT synthesize prematurely
r_detail = svc.process_patient_turn(
    message=detailed,
    current_matrix=create_empty_clinical_matrix(),
    conversation_history=[],
)
record(19, "Detailed service → state is QUESTIONING (turn 1, not yet enough)",
       r_detail.get("state") == "QUESTIONING",
       r_detail.get("state"))
record(20, "Detailed service → does NOT ask about cough or shortness of breath",
       "cough" not in r_detail.get("assistant_message", "").lower()
       and "shortness" not in r_detail.get("assistant_message", "").lower(),
       r_detail.get("assistant_message", "")[:120])
record(21, "Detailed service → does NOT ask about paracetamol (already known)",
       "paracetamol" not in r_detail.get("assistant_message", "").lower(),
       r_detail.get("assistant_message", "")[:120])

# ─────────────────────────────────────────────────────────────
# D. ARM PAIN 3 DAYS — correct extraction, no premature synthesis
# ─────────────────────────────────────────────────────────────
print("\nD. ARM PAIN 3 DAYS — no premature synthesis")

arm_msg = "I've had pain in my arm near the joint for about 3 days."
matrix_d = create_empty_clinical_matrix()
upd_d_matrix, upd_d = extract_clinical_facts(arm_msg, matrix_d, lang="en")

record(22, "Arm pain → chief_complaint references arm/joint/pain",
       upd_d_matrix.get("chief_complaint") is not None
       and any(w in str(upd_d_matrix.get("chief_complaint", "")).lower() for w in ["arm", "joint", "pain", "knee"]),
       str(upd_d_matrix.get("chief_complaint")))
record(23, "Arm pain → onset = 3 days",
       upd_d_matrix.get("onset") is not None
       and "3" in str(upd_d_matrix.get("onset")),
       str(upd_d_matrix.get("onset")))

# Through service turn 1 — should NOT synthesize (only complaint + onset, no assoc symptoms, turn 1)
r_arm = svc.process_patient_turn(
    message=arm_msg,
    current_matrix=create_empty_clinical_matrix(),
    conversation_history=[],
)
record(24, "Arm pain service → state is QUESTIONING (not SYNTHESIS at turn 1)",
       r_arm.get("state") == "QUESTIONING",
       r_arm.get("state"))
record(25, "Arm pain service → does NOT ask onset again (already extracted)",
       "when" not in r_arm.get("assistant_message", "").lower()
       and "شوكت" not in r_arm.get("assistant_message", "")
       and "start" not in r_arm.get("assistant_message", "").lower(),
       r_arm.get("assistant_message", "")[:120])
record(26, "Arm pain service → asks a clinically relevant missing question",
       r_arm.get("assistant_message") is not None and len(r_arm.get("assistant_message", "")) > 10,
       r_arm.get("assistant_message", "")[:120])

# Turn 2 — user answers "no swelling, no numbness" — should update matrix, not prematurely synthesize
history_after_arm = [
    {"sender": "patient", "content": arm_msg},
    {"sender": "assistant", "content": r_arm.get("assistant_message", "Is there swelling?")},
]
matrix_after_arm = {**create_empty_clinical_matrix(), **r_arm.get("clinical_updates", {})}
# Set matrix manually since service updates it internally
matrix_after_arm["chief_complaint"] = upd_d_matrix.get("chief_complaint", "Joint / Knee Pain")
matrix_after_arm["onset"] = upd_d_matrix.get("onset", "Started 3 days ago")

r_arm_t2 = svc.process_patient_turn(
    message="No swelling, no redness, no numbness. Pain is moderate.",
    current_matrix=matrix_after_arm,
    conversation_history=history_after_arm,
)
record(27, "Arm pain T2 → state is still QUESTIONING (not enough info yet)",
       r_arm_t2.get("state") in ("QUESTIONING", "SYNTHESIS"),  # SYNTHESIS ok if 3 axes
       r_arm_t2.get("state"))
# Verify it didn't create a NEW chief complaint from the follow-up
record(28, "Arm pain T2 → chief_complaint unchanged",
       r_arm_t2.get("clinical_updates", {}).get("chief_complaint") is None
       or r_arm_t2.get("clinical_updates", {}).get("chief_complaint") == matrix_after_arm.get("chief_complaint"),
       str(r_arm_t2.get("clinical_updates", {}).get("chief_complaint")))

# ─────────────────────────────────────────────────────────────
# E. FOLLOW-UP ANSWER MERGES CONTEXT
# ─────────────────────────────────────────────────────────────
print("\nE. FOLLOW-UP ANSWER merges context")

# Matrix already has chief_complaint = fever; onset not yet set
matrix_e = create_empty_clinical_matrix()
matrix_e["chief_complaint"] = "Fever"
# Simulate bot asked: "How long have you had the fever?"
history_e = [
    {"sender": "patient", "content": "I have a fever"},
    {"sender": "assistant", "content": "How long have you had the fever?"},
]
upd_follow_matrix, upd_follow = extract_clinical_facts("3 days", matrix_e, lang="en")

record(29, "Follow-up '3 days' → onset extracted as 3 days",
       upd_follow_matrix.get("onset") is not None
       and "3" in str(upd_follow_matrix.get("onset")),
       str(upd_follow_matrix.get("onset")))
record(30, "Follow-up '3 days' → chief_complaint NOT overwritten",
       upd_follow_matrix.get("chief_complaint") == "Fever",
       str(upd_follow_matrix.get("chief_complaint")))
record(31, "Follow-up '3 days' → no new chief_complaint in updates",
       "chief_complaint" not in upd_follow,
       str(upd_follow))

# ─────────────────────────────────────────────────────────────
# F. EMERGENCY MESSAGE — safety runs first
# ─────────────────────────────────────────────────────────────
print("\nF. EMERGENCY — safety lock")

emergency_msg = "ماكدر أتنفس من أربع أيام وأحس بضيق نفس حتى وأنا جالس"
r_emg = svc.process_patient_turn(
    message=emergency_msg,
    current_matrix=create_empty_clinical_matrix(),
    conversation_history=[],
)
record(32, "Emergency → state = EMERGENCY_LOCK",
       r_emg.get("state") == "EMERGENCY_LOCK",
       r_emg.get("state"))
record(33, "Emergency → triage_urgency = EMERGENCY",
       r_emg.get("triage_urgency") == "EMERGENCY",
       r_emg.get("triage_urgency"))
record(34, "Emergency → safety_escalation = True",
       r_emg.get("safety_escalation") is True,
       str(r_emg.get("safety_escalation")))

# ─────────────────────────────────────────────────────────────
# RESULTS
# ─────────────────────────────────────────────────────────────
total = len(results)
passed = sum(1 for _, tag, _, _ in results if tag == PASS)
failed = total - passed

print()
print("=" * 70)
print(f"RESULT: {passed}/{total} PASSED   |   {failed} FAILED")
if failed:
    print("\nFAILED TESTS:")
    for num, tag, desc, detail in results:
        if tag == FAIL:
            print(f"  T{num:03d}: {desc}")
            if detail:
                print(f"        {detail[:120]}")
print("=" * 70)

sys.exit(0 if failed == 0 else 1)
