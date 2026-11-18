#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verification Script for AuraHealth General Medicine Chatbot Behavior Fixes.
Validates:
1. Dynamic questioning (turn 1 remains in QUESTIONING state; turn 2 moves to SYNTHESIS)
2. Structured clinical fact extraction (no raw sentence copying into matrix)
3. Zero symptom hallucination / anti-fabrication (fever + fatigue -> NO cough, NO chest X-ray, NO Pulmonology)
4. Full bilingual support (English, Modern Standard Arabic, Iraqi Arabic)
"""
import sys
import os
from pathlib import Path

# Ensure UTF-8 stdout encoding on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.general_medicine_service import GeneralMedicineService
from app.services.triage_rules import (
    create_empty_clinical_matrix,
    extract_clinical_facts,
    sanitize_and_validate_evidence,
    evaluate_clinical_matrix
)

passed_count = 0
failed_count = 0

def check(condition: bool, description: str):
    global passed_count, failed_count
    if condition:
        print(f"  [PASS] {description}")
        passed_count += 1
    else:
        print(f"  [FAIL] {description}")
        failed_count += 1

def main():
    print("=" * 70)
    print("RUNNING VERIFICATION: GENERAL MEDICINE CHATBOT BEHAVIOR FIXES")
    print("=" * 70)

    service = GeneralMedicineService()

    # -----------------------------------------------------------------
    # TEST SUITE 1: English Turn 1 ("I have a fever since yesterday and I feel tired")
    # -----------------------------------------------------------------
    print("\n--- TEST 1: English Turn 1 Dynamic Questioning & Extraction ---")
    matrix1 = create_empty_clinical_matrix()
    t1_msg = "I have a fever since yesterday and I feel tired"
    res1 = service.process_patient_turn(t1_msg, matrix1, [])

    check(res1["state"] == "QUESTIONING", "Turn 1 state is QUESTIONING (not premature SYNTHESIS)")
    check(res1["needs_more_questions"] is True, "Turn 1 needs_more_questions is True")
    check(res1["information_completeness"] == 0.60, f"Turn 1 completeness is 0.60 (got {res1['information_completeness']})")
    check(matrix1["chief_complaint"] == "Fever", f"Chief complaint is extracted as 'Fever' (got '{matrix1['chief_complaint']}')")
    check(matrix1["onset"] == "Started yesterday", f"Onset is extracted as 'Started yesterday' (got '{matrix1['onset']}')")
    check(matrix1["associated_symptoms"] == ["Fatigue"], f"Associated symptoms is ['Fatigue'] (got {matrix1['associated_symptoms']})")
    check(matrix1["triggers"] == [], "Triggers remains empty (not provided yet)")
    check(matrix1["medical_history"] == [], "Medical history remains empty (not provided yet)")
    check(matrix1["medications"] == [], "Medications remains empty (not provided yet)")
    check(res1["possible_considerations"] == [], "Possible considerations is empty during QUESTIONING")
    check(res1["recommended_investigations"] == [], "Recommended investigations is empty during QUESTIONING")
    check("temperature" in res1["assistant_message"].lower() or "fever" in res1["assistant_message"].lower(), 
          "Assistant asks focused follow-up question about temperature/symptoms")

    # -----------------------------------------------------------------
    # TEST SUITE 2: English Turn 2 ("My temperature is 38.5, no other symptoms, took paracetamol")
    # -----------------------------------------------------------------
    print("\n--- TEST 2: English Turn 2 Synthesis & Zero Symptom Hallucination ---")
    history_en = [
        {"sender": "patient", "content": t1_msg},
        {"sender": "assistant", "content": res1["assistant_message"]}
    ]
    t2_msg = "My temperature is 38.5, no other symptoms, took paracetamol"
    res2 = service.process_patient_turn(t2_msg, matrix1, history_en)

    check(res2["state"] == "SYNTHESIS", "Turn 2 state transitioned to SYNTHESIS")
    check(res2["needs_more_questions"] is False, "Turn 2 needs_more_questions is False")
    check("38.5" in str(matrix1["onset"]), f"Onset retained timing and incorporated measured temp: {matrix1['onset']}")
    check(matrix1["medications"] == ["Paracetamol / Panadol"], f"Medications extracted: {matrix1['medications']}")

    # Clinical considerations check (Zero cough, zero bronchitis)
    considerations = res2.get("possible_considerations", [])
    check(len(considerations) > 0, f"Generated {len(considerations)} considerations")
    all_cond_text = " ".join([c["condition"] + " " + c.get("clinical_rationale", "") for c in considerations]).lower()
    check("cough" not in all_cond_text, "ZERO mentions of cough in considerations")
    check("bronchitis" not in all_cond_text, "ZERO mentions of bronchitis in considerations")
    check("respiratory" not in all_cond_text, "ZERO mentions of respiratory tract in considerations")
    check("febrile" in all_cond_text or "fever" in all_cond_text, "Considerations appropriately focus on Acute Febrile Presentation / Viral Syndrome")

    # Investigations check (CBC + vitals, ZERO chest X-ray)
    investigations = res2.get("recommended_investigations", [])
    check(len(investigations) > 0, f"Generated {len(investigations)} investigations")
    all_inv_text = " ".join([inv["investigation"] + " " + inv.get("clinical_reason", "") for inv in investigations]).lower()
    check("chest x-ray" not in all_inv_text and "pa view" not in all_inv_text, "ZERO mentions of Chest X-Ray in investigations")
    check("cbc" in all_inv_text or "blood" in all_inv_text, "Suggested investigations include CBC with differential")
    check("temperature" in all_inv_text or "vital" in all_inv_text, "Suggested investigations include Temperature/Vital signs monitoring")

    # Department referral check (General Medicine, NOT Pulmonology)
    departments = res2.get("recommended_departments", [])
    check(len(departments) > 0, f"Generated {len(departments)} department referral(s)")
    dept_names = [d["department_name"] for d in departments]
    check("General Medicine" in dept_names, f"Department referral is General Medicine (got {dept_names})")
    check("Pulmonology" not in dept_names, "ZERO Pulmonology referral when no respiratory symptoms present")

    # -----------------------------------------------------------------
    # TEST SUITE 3: Modern Standard Arabic Turn 1 & Turn 2
    # -----------------------------------------------------------------
    print("\n--- TEST 3: Modern Standard Arabic Full Flow ---")
    matrix_ar = create_empty_clinical_matrix()
    ar_t1_msg = "عندي حرارة من البارحة وحاس بتعب"
    ar_res1 = service.process_patient_turn(ar_t1_msg, matrix_ar, [])

    check(ar_res1["state"] == "QUESTIONING", "Arabic Turn 1 state is QUESTIONING")
    check(ar_res1["language"] == "ar", "Language detected as Arabic ('ar')")
    check(matrix_ar["chief_complaint"] == "حمى / حرارة", f"Arabic CC extracted cleanly as 'حمى / حرارة' (got '{matrix_ar['chief_complaint']}')")
    check(matrix_ar["onset"] == "بدأت البارحة", f"Arabic Onset extracted as 'بدأت البارحة' (got '{matrix_ar['onset']}')")
    check(matrix_ar["associated_symptoms"] == ["إرهاق وخمول"], f"Arabic Associated symptoms extracted as ['إرهاق وخمول'] (got {matrix_ar['associated_symptoms']})")
    check(ar_res1["possible_considerations"] == [], "Arabic Turn 1 considerations empty")

    ar_history = [
        {"sender": "patient", "content": ar_t1_msg},
        {"sender": "assistant", "content": ar_res1["assistant_message"]}
    ]
    ar_t2_msg = "حرارتي 38.5 وما عندي أعراض ثانية وأخذت بنادول"
    ar_res2 = service.process_patient_turn(ar_t2_msg, matrix_ar, ar_history)

    check(ar_res2["state"] == "SYNTHESIS", "Arabic Turn 2 state transitioned to SYNTHESIS")
    check(matrix_ar["medications"] == ["باراسيتامول / بنادول"], f"Arabic medication extracted as ['باراسيتامول / بنادول'] (got {matrix_ar['medications']})")
    ar_conds_text = " ".join([c["condition"] + " " + c.get("clinical_rationale", "") for c in ar_res2["possible_considerations"]])
    check("سعال" not in ar_conds_text and "كحة" not in ar_conds_text, "ZERO Arabic mentions of cough (سعال/كحة) in considerations")
    check("حمى" in ar_conds_text or "حرارة" in ar_conds_text, "Arabic considerations focus on febrile presentation")
    ar_invs_text = " ".join([inv["investigation"] for inv in ar_res2["recommended_investigations"]])
    check("صدر" not in ar_invs_text and "أشعة" not in ar_invs_text, "ZERO chest X-ray in Arabic investigations")
    check("CBC" in ar_invs_text or "دم" in ar_invs_text, "Arabic investigations include CBC")

    # -----------------------------------------------------------------
    # TEST SUITE 4: Iraqi Arabic Turn 1 & Turn 2 (with explicit symptom denial)
    # -----------------------------------------------------------------
    print("\n--- TEST 4: Iraqi Arabic Dialect & Symptom Denial Handling ---")
    matrix_iq = create_empty_clinical_matrix()
    iq_t1_msg = "عندي سخونة من البارحة وتعبان مالي حيل"
    iq_res1 = service.process_patient_turn(iq_t1_msg, matrix_iq, [])

    check(iq_res1["state"] == "QUESTIONING", "Iraqi Arabic Turn 1 state is QUESTIONING")
    check(matrix_iq["chief_complaint"] == "حمى / حرارة", f"Iraqi dialect 'سخونة' mapped cleanly to 'حمى / حرارة'")
    check(matrix_iq["onset"] == "بدأت البارحة", "Iraqi onset 'من البارحة' mapped cleanly to 'بدأت البارحة'")
    check("إرهاق وخمول" in matrix_iq["associated_symptoms"], "Iraqi 'تعبان مالي حيل' mapped to 'إرهاق وخمول'")

    iq_history = [
        {"sender": "patient", "content": iq_t1_msg},
        {"sender": "assistant", "content": iq_res1["assistant_message"]}
    ]
    # Denies cough explicitly in Iraqi dialect: "ماكو كحة ولا ضيق نفس"
    iq_t2_msg = "حرارتي 38.5 وماكو كحة ولا ضيق نفس، شربت براسيتول"
    iq_res2 = service.process_patient_turn(iq_t2_msg, matrix_iq, iq_history)

    check(iq_res2["state"] == "SYNTHESIS", "Iraqi Arabic Turn 2 state transitioned to SYNTHESIS")
    check("سعال" not in matrix_iq["associated_symptoms"] and "كحة" not in matrix_iq["associated_symptoms"],
          "Iraqi symptom denial 'ماكو كحة' did NOT add cough to associated symptoms")
    check(matrix_iq["medications"] == ["باراسيتامول / بنادول"], "Iraqi 'براسيتول' mapped to 'باراسيتامول / بنادول'")

    # -----------------------------------------------------------------
    # TEST SUITE 5: Evidence Sanitizer Anti-Hallucination Guard
    # -----------------------------------------------------------------
    print("\n--- TEST 5: Evidence Sanitizer Guard (Purges Hallucinated Symptoms) ---")
    mock_hallucinated_assessment = {
        "assistant_message": "Reported febrile cough and respiratory symptoms",
        "state": "SYNTHESIS",
        "possible_considerations": [
            {
                "condition": "Acute Bronchitis and Febrile Cough",
                "likelihood_tier": "Primary Consideration",
                "clinical_rationale": "Patient reported persistent febrile cough and upper respiratory infection."
            }
        ],
        "recommended_investigations": [
            {
                "investigation": "Chest X-Ray (PA View)",
                "modality_type": "Radiographic Imaging",
                "clinical_reason": "To evaluate pulmonary infiltrates."
            }
        ],
        "recommended_departments": [
            {
                "department_name": "Pulmonology",
                "clinical_indication": "Evaluation of respiratory symptoms."
            }
        ]
    }
    patient_text_only_fever = "I have a fever since yesterday and I feel tired. Temperature is 38.5."
    sanitized = sanitize_and_validate_evidence(mock_hallucinated_assessment, patient_text_only_fever, matrix1, lang="en")

    sanitized_cond_str = " ".join([c["condition"] + " " + c["clinical_rationale"] for c in sanitized["possible_considerations"]]).lower()
    check("bronchitis" not in sanitized_cond_str, "Sanitizer purged hallucinated bronchitis consideration")
    check("cough" not in sanitized_cond_str, "Sanitizer purged hallucinated cough from consideration rationale")
    
    sanitized_inv_str = " ".join([inv["investigation"] for inv in sanitized["recommended_investigations"]]).lower()
    check("chest x-ray" not in sanitized_inv_str, "Sanitizer replaced ungrounded Chest X-Ray with temperature/vitals charting")
    check("cbc" in sanitized_inv_str, "Sanitizer ensured CBC with differential is present for fever workup")

    sanitized_depts = [d["department_name"] for d in sanitized["recommended_departments"]]
    check("Pulmonology" not in sanitized_depts, "Sanitizer removed ungrounded Pulmonology referral")
    check("General Medicine" in sanitized_depts, "Sanitizer redirected to General Medicine")
    check("febrile cough" not in sanitized["assistant_message"], "Sanitizer cleansed assistant message text")

    # -----------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"VERIFICATION COMPLETE: {passed_count} PASSED, {failed_count} FAILED")
    print("=" * 70)

    if failed_count > 0:
        sys.exit(1)
    else:
        print("ALL GENERAL MEDICINE CHATBOT BEHAVIOR FIXES VERIFIED SUCCESSFULLY!")
        sys.exit(0)

if __name__ == "__main__":
    main()
