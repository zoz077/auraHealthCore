#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
End-to-end scenario verification for the exact bug report.
Runs the 3-turn conversation and the bonus fever scenario.
"""
import sys
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.triage_rules import (
    create_empty_clinical_matrix, extract_clinical_facts,
    evaluate_clinical_matrix, detect_language
)

def show_matrix(m):
    print(f"    chief_complaint : {m.get('chief_complaint')}")
    print(f"    onset           : {m.get('onset')}")
    print(f"    associated_syms : {m.get('associated_symptoms')}")
    print(f"    triggers        : {m.get('triggers')}")
    print(f"    medical_history : {m.get('medical_history')}")
    print(f"    medications     : {m.get('medications')}")

def pick_next_question(matrix, lang, missing, last_q=""):
    """Mirrors the _safe_deterministic_fallback question-picking logic."""
    cc = str(matrix.get("chief_complaint", "")).lower()
    has_fever = any(w in cc for w in ["fever", "حرارة", "سخونة", "حمى"])
    onset_missing = not matrix.get("onset")
    has_temp = any(k in str(matrix.get("onset", "")).lower() for k in ["temp", "°c", "حرارة", "مقاسة"])

    if onset_missing:
        if has_fever:
            q = ("منذ متى بدأت الحرارة بالتحديد وهل قمت بقياسها؟ وهل تعاني من أي أعراض مرافقة؟"
                 if lang == "ar" else "When did the fever start exactly, and what is your temperature?")
            ax = "onset"
        else:
            q = ("من شوكت تقريباً بدأت هذه الأعراض، وهل ظهرت فجأة لو بالتدريج؟"
                 if lang == "ar" else "Approximately when did these symptoms start, and suddenly or gradually?")
            ax = "onset"
    elif has_fever and not has_temp:
        q = ("هل قمت بقياس درجة حرارتك؟ وهل تعاني من أي أعراض مرافقة؟"
             if lang == "ar" else "Have you measured your temperature?")
        ax = "associated_symptoms"
    elif "medical_history" in missing or "medications" in missing:
        q = ("هل تتناول أي أدوية حالياً وهل عندك أمراض مزمنة؟"
             if lang == "ar" else "Any current medications or chronic conditions?")
        ax = "medications"
    elif "triggers" in missing:
        q = ("هل حدث أي شيء قبل الأعراض مباشرة؟"
             if lang == "ar" else "Did anything trigger these symptoms?")
        ax = "triggers"
    else:
        q = ("هل هناك أي تفاصيل إضافية أخرى؟"
             if lang == "ar" else "Any other details to add?")
        ax = missing[0] if missing else "associated_symptoms"

    # Prevent exact repeat
    if q.strip() == last_q.strip() and ("medical_history" in missing or "medications" in missing):
        q = ("هل تتناول أي أدوية حالياً وهل عندك أمراض مزمنة؟"
             if lang == "ar" else "Any medications or chronic conditions?")
        ax = "medications"

    return q, ax


passed = 0
failed = 0

def check(cond, desc, extra=""):
    global passed, failed
    if cond:
        print(f"  [PASS] {desc}")
        passed += 1
    else:
        print(f"  [FAIL] {desc}" + (f" | {extra}" if extra else ""))
        failed += 1


# ======================================================================
print()
print("=" * 65)
print("SCENARIO 1: Ankle pain → onset question → 'تقريباً قبل شهرين'")
print("=" * 65)

matrix = create_empty_clinical_matrix()
last_q = ""

# Turn 1
t1 = "احس رجلي تأذيني من يم الكاحل واكو تورم خفيف بيها يم عظمة الكاحل"
lang = detect_language(t1)
matrix, _ = extract_clinical_facts(t1, matrix, lang)
compl1, missing1 = evaluate_clinical_matrix(matrix)
q1, ax1 = pick_next_question(matrix, lang, missing1, last_q)
last_q = q1

print(f"\nTurn 1 USER: {t1}")
print("Matrix after T1:")
show_matrix(matrix)
print(f"Completeness: {compl1} | Missing: {missing1}")
print(f"BOT ASKS [{ax1}]: {q1}")

check(matrix.get("chief_complaint") is not None, "T1: chief_complaint extracted", str(matrix.get("chief_complaint")))
check("كاحل" in str(matrix.get("chief_complaint","")) or "ألم" in str(matrix.get("chief_complaint","")),
      "T1: chief_complaint mentions ankle/pain", str(matrix.get("chief_complaint")))
check(any("تورم" in s or "swelling" in s.lower() or "Swelling" in s for s in matrix.get("associated_symptoms", [])),
      "T1: swelling extracted as associated symptom", str(matrix.get("associated_symptoms")))
check(matrix.get("onset") is None, "T1: onset is None (not yet provided)")
check("onset" in missing1, "T1: onset in missing axes → bot asks about it")
check(ax1 == "onset", f"T1: bot targets 'onset' axis", f"got {ax1}")

# Turn 2
print()
t2 = "تقريباً قبل شهرين"
lang2 = detect_language(t2)
matrix, _ = extract_clinical_facts(t2, matrix, lang2)
compl2, missing2 = evaluate_clinical_matrix(matrix)
q2, ax2 = pick_next_question(matrix, lang2, missing2, last_q)

print(f"Turn 2 USER: {t2}")
print("Matrix after T2:")
show_matrix(matrix)
print(f"Completeness: {compl2} | Missing: {missing2}")
print(f"BOT ASKS [{ax2}]: {q2}")

onset2 = matrix.get("onset")
check(onset2 is not None, "T2: onset extracted from 'تقريباً قبل شهرين'", str(onset2))
check("شهرين" in str(onset2 or "") or "two months" in str(onset2 or "").lower(),
      "T2: onset contains 'شهرين' (two months)", str(onset2))
check("onset" not in missing2, "T2: onset no longer in missing axes", str(missing2))
check(q2.strip() != q1.strip(), "T2: bot asks DIFFERENT question (not the same onset Q again)",
      f"T1 Q='{q1[:50]}' T2 Q='{q2[:50]}'")
check("شوكت" not in q2 and "when did" not in q2.lower(),
      "T2: bot does NOT repeat the onset question", f"Got: '{q2[:60]}'")

last_q = q2

# Turn 3
print()
t3 = "قبل شهرين ظهرت بالتدريج"
lang3 = detect_language(t3)
matrix, _ = extract_clinical_facts(t3, matrix, lang3)
compl3, missing3 = evaluate_clinical_matrix(matrix)
q3, ax3 = pick_next_question(matrix, lang3, missing3, last_q)

print(f"Turn 3 USER: {t3}")
print("Matrix after T3:")
show_matrix(matrix)
print(f"Completeness: {compl3} | Missing: {missing3}")
print(f"BOT ASKS [{ax3}]: {q3}")

onset3 = matrix.get("onset")
check("شهرين" in str(onset3 or "") or "two months" in str(onset3 or "").lower(),
      "T3: onset still contains 'شهرين'", str(onset3))
check("تدريجي" in str(onset3 or "") or "بالتدريج" in str(onset3 or "") or "gradual" in str(onset3 or "").lower(),
      "T3: onset now also contains gradual pattern", str(onset3))
check("onset" not in missing3, "T3: onset not in missing → onset Q never asked again", str(missing3))
check("شوكت" not in q3 and "when did" not in q3.lower(),
      "T3: bot does NOT ask onset question again", f"Got: '{q3[:60]}'")


# ======================================================================
print()
print("=" * 65)
print("SCENARIO 2: Bonus — عندي حرارة من البارحة وحاس بتعب")
print("=" * 65)

matrix_b = create_empty_clinical_matrix()
tb = "عندي حرارة من البارحة وحاس بتعب"
lang_b = detect_language(tb)
matrix_b, _ = extract_clinical_facts(tb, matrix_b, lang_b)
compl_b, missing_b = evaluate_clinical_matrix(matrix_b)
q_b, ax_b = pick_next_question(matrix_b, lang_b, missing_b)

print(f"\nUSER: {tb}")
print("Matrix:")
show_matrix(matrix_b)
print(f"Completeness: {compl_b} | Missing: {missing_b}")
print(f"BOT ASKS [{ax_b}]: {q_b}")

check(matrix_b.get("chief_complaint") == "حمى / حرارة",
      "Fever: CC = 'حمى / حرارة'", str(matrix_b.get("chief_complaint")))
check(matrix_b.get("onset") == "بدأت البارحة",
      "Fever: onset = 'بدأت البارحة'", str(matrix_b.get("onset")))
check("إرهاق وخمول" in matrix_b.get("associated_symptoms", []),
      "Fever: fatigue extracted", str(matrix_b.get("associated_symptoms")))
check("onset" not in missing_b, "Fever: onset already set → not missing")

# ======================================================================
print()
print("=" * 65)
print(f"SCENARIO VERIFICATION COMPLETE: {passed} PASSED, {failed} FAILED")
print("=" * 65)
if failed > 0:
    sys.exit(1)
else:
    print("ALL SCENARIO CHECKS PASSED!")
    sys.exit(0)
