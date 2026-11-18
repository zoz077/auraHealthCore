#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FOCUSED TEST: Arabic temporal phrase extraction → Clinical Information Matrix.

Tests the deterministic triage_rules.py layer ONLY (no httpx / Gemini dependency).

Reproduces the exact bug scenario:
  Turn 1: user reports ankle pain + swelling
  Turn 2: user answers onset question with "تقريباً قبل شهرين"
  
Expected: matrix["onset"] is set, bot does NOT repeat onset question.

Also tests all required Iraqi Arabic temporal phrases:
  - قبل شهرين
  - تقريباً قبل شهرين
  - من شهرين
  - صارلي شهرين
  - صارلي تقريباً شهرين
  - من البارحة
  - من أسبوع
  - ظهرت بالتدريج
  - جت فجأة
  - ظهرت فجأة
"""
import sys
import os
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.triage_rules import (
    create_empty_clinical_matrix,
    extract_clinical_facts,
    evaluate_clinical_matrix,
    detect_language,
)

passed = 0
failed = 0

def check(condition: bool, description: str, extra: str = ""):
    global passed, failed
    if condition:
        print(f"  [PASS] {description}")
        passed += 1
    else:
        print(f"  [FAIL] {description}" + (f" | detail: {extra}" if extra else ""))
        failed += 1


def test_onset(msg: str, expect_set: bool = True, expect_contains: str = None, label: str = None):
    """Helper: run extract_clinical_facts on a single message and check onset."""
    label = label or f"'{msg[:40]}'"
    mat = create_empty_clinical_matrix()
    lang = detect_language(msg)
    updated, updates = extract_clinical_facts(msg, mat, lang)
    onset = updated.get("onset")
    if expect_set:
        check(onset is not None, f"{label} → onset is set", f"Got: {onset}")
        if expect_contains:
            check(
                expect_contains in str(onset or "") or expect_contains.lower() in str(onset or "").lower(),
                f"{label} → onset contains '{expect_contains}'",
                f"Got: {onset}"
            )
    else:
        check(onset is None, f"{label} → onset remains None (expected not set)", f"Got: {onset}")
    return updated


# ---------------------------------------------------------------
# TEST GROUP 1: Iraqi Arabic month-based temporal phrases
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 1: Iraqi Arabic month-based temporal phrases")
print("=" * 65)

test_onset("تقريباً قبل شهرين",        True, "شهرين", "تقريباً قبل شهرين")
test_onset("قبل شهرين",                True, "شهرين", "قبل شهرين")
test_onset("من شهرين",                 True, "شهرين", "من شهرين")
test_onset("صارلي شهرين",              True, "شهرين", "صارلي شهرين")
test_onset("صارلي تقريباً شهرين",      True, "شهرين", "صارلي تقريباً شهرين")
test_onset("قبل 3 شهور",               True, None,    "قبل 3 شهور")
test_onset("من شهر",                   True, "شهر",   "من شهر (one month)")


# ---------------------------------------------------------------
# TEST GROUP 2: Week / day phrases
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 2: Week / day phrases")
print("=" * 65)

test_onset("من البارحة",               True, "البارحة", "من البارحة")
test_onset("من أسبوع",                 True, "أسبوع",   "من أسبوع")
test_onset("من اسبوع",                 True, "أسبوع",   "من اسبوع")
test_onset("صارلي اسبوع",              True, "أسبوع",   "صارلي اسبوع")


# ---------------------------------------------------------------
# TEST GROUP 3: Onset pattern phrases (gradual / sudden)
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 3: Onset pattern phrases")
print("=" * 65)

test_onset("ظهرت بالتدريج",   True,  None, "ظهرت بالتدريج → gradual")
test_onset("جت فجأة",          True, "فجأة", "جت فجأة → sudden")
test_onset("ظهرت فجأة",        True, "فجأة", "ظهرت فجأة → sudden")

print("\n  [Testing onset-pattern appended to existing onset]")
mat_g = create_empty_clinical_matrix()
mat_g["onset"] = "بدأت منذ شهرين تقريباً"
msg_g = "ظهرت بالتدريج"
lang_g = detect_language(msg_g)
updated_g, _ = extract_clinical_facts(msg_g, mat_g, lang_g)
onset_g = updated_g.get("onset", "")
check(
    "تدريجي" in onset_g or "بالتدريج" in onset_g or "gradual" in onset_g.lower(),
    "Gradual pattern appended to existing onset",
    f"Got: '{onset_g}'"
)

print("\n  [Testing sudden pattern appended to existing onset]")
mat_s = create_empty_clinical_matrix()
mat_s["onset"] = "بدأت منذ شهر"
msg_s = "جت فجأة"
lang_s = detect_language(msg_s)
updated_s, _ = extract_clinical_facts(msg_s, mat_s, lang_s)
onset_s = updated_s.get("onset", "")
check(
    "فجأة" in onset_s or "sudden" in onset_s.lower(),
    "Sudden pattern appended to existing onset",
    f"Got: '{onset_s}'"
)


# ---------------------------------------------------------------
# TEST GROUP 4: Combined temporal + pattern in one message
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 4: Combined 'قبل شهرين ظهرت بالتدريج' in one message")
print("=" * 65)

mat_c = create_empty_clinical_matrix()
msg_c = "قبل شهرين ظهرت بالتدريج"
lang_c = detect_language(msg_c)
updated_c, _ = extract_clinical_facts(msg_c, mat_c, lang_c)
onset_c = str(updated_c.get("onset", ""))

check(
    "شهرين" in onset_c or "two months" in onset_c.lower(),
    "Combined message: onset contains 'شهرين'",
    f"Got: '{onset_c}'"
)
check(
    "تدريجي" in onset_c or "بالتدريج" in onset_c or "gradual" in onset_c.lower(),
    "Combined message: onset contains gradual pattern",
    f"Got: '{onset_c}'"
)


# ---------------------------------------------------------------
# TEST GROUP 5: Chief complaint extraction for ankle pain scenario
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 5: Chief complaint — ankle pain (Iraqi Arabic)")
print("=" * 65)

mat_a = create_empty_clinical_matrix()
msg_a = "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل"
lang_a = detect_language(msg_a)
updated_a, _ = extract_clinical_facts(msg_a, mat_a, lang_a)

cc = updated_a.get("chief_complaint", "")
syms = updated_a.get("associated_symptoms", [])

check(cc is not None and cc != "",
      "Ankle pain message → chief complaint is NOT None/empty",
      f"Got: '{cc}'")
check(
    "كاحل" in str(cc) or "ankle" in str(cc).lower() or "قدم" in str(cc) or "ألم" in str(cc) or "رجل" in str(cc),
    "Chief complaint references ankle/foot/leg/pain",
    f"Got: '{cc}'"
)
check(
    any("تورم" in s or "swelling" in s.lower() or "Swelling" in s for s in syms),
    "Swelling (تورم) extracted as associated symptom",
    f"Got symptoms: {syms}"
)


# ---------------------------------------------------------------
# TEST GROUP 6: Full 2-turn conversation — bot stops repeating onset Q
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print("GROUP 6: Full 2-turn flow — onset extracted, no re-question")
print("=" * 65)

# Simulate what the service does for each turn
# (Without importing GeneralMedicineService to avoid httpx dependency)

# ---- Turn 1 ----
mat_flow = create_empty_clinical_matrix()
t1 = "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل"
lang1 = detect_language(t1)
mat_flow, upd1 = extract_clinical_facts(t1, mat_flow, lang1)

compl1, missing1 = evaluate_clinical_matrix(mat_flow)
check(mat_flow.get("chief_complaint") is not None,
      "Turn 1: chief_complaint extracted",
      f"Got: {mat_flow.get('chief_complaint')}")
check(mat_flow.get("onset") is None,
      "Turn 1: onset is None (not yet provided)",
      f"Got: {mat_flow.get('onset')}")
check("onset" in missing1,
      "Turn 1: onset is in missing axes → bot asks about it",
      f"Missing: {missing1}")

# ---- Turn 2: user provides onset ----
t2 = "تقريباً قبل شهرين"
lang2 = detect_language(t2)
mat_flow, upd2 = extract_clinical_facts(t2, mat_flow, lang2)

compl2, missing2 = evaluate_clinical_matrix(mat_flow)
onset_after_t2 = mat_flow.get("onset")
check(onset_after_t2 is not None,
      "Turn 2: onset extracted from 'تقريباً قبل شهرين'",
      f"Got: {onset_after_t2}")
check("شهرين" in str(onset_after_t2 or "") or "two months" in str(onset_after_t2 or "").lower(),
      "Turn 2: onset contains 'شهرين'",
      f"Got: {onset_after_t2}")
check("onset" not in missing2,
      "Turn 2: onset is NO LONGER in missing axes",
      f"Still missing: {missing2}")

# After onset is set, the bot should NOT ask onset question again
# The fallback logic checks `onset_is_missing = not matrix.get("onset")`
# So onset_is_missing = False → onset question is skipped
onset_is_missing_after_t2 = not mat_flow.get("onset")
check(not onset_is_missing_after_t2,
      "Fallback logic: onset_is_missing = False (onset question will be skipped)",
      f"onset value: {mat_flow.get('onset')}")


# ---- Turn 3: user provides combined onset+pattern ----
print("\n  [Turn 3: combined 'قبل شهرين ظهرت بالتدريج']")
mat_flow3 = create_empty_clinical_matrix()
t1_v2 = "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل"
mat_flow3, _ = extract_clinical_facts(t1_v2, mat_flow3, detect_language(t1_v2))

t2_v2 = "قبل شهرين ظهرت بالتدريج"
mat_flow3, _ = extract_clinical_facts(t2_v2, mat_flow3, detect_language(t2_v2))

onset3 = mat_flow3.get("onset", "")
check(
    "شهرين" in str(onset3) or "two months" in str(onset3).lower(),
    "Turn 3 (combined): onset contains 'شهرين'",
    f"Got: '{onset3}'"
)
check(
    "تدريجي" in str(onset3) or "بالتدريج" in str(onset3) or "gradual" in str(onset3).lower(),
    "Turn 3 (combined): onset contains gradual pattern",
    f"Got: '{onset3}'"
)
_, missing3 = evaluate_clinical_matrix(mat_flow3)
check("onset" not in missing3,
      "Turn 3: onset not in missing (won't ask onset again)",
      f"Still missing: {missing3}")


# ---------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------
print("\n" + "=" * 65)
print(f"FOCUSED TEST COMPLETE: {passed} PASSED, {failed} FAILED")
print("=" * 65)
if failed > 0:
    sys.exit(1)
else:
    print("ALL FOCUSED ARABIC ONSET EXTRACTION TESTS PASSED!")
    sys.exit(0)
