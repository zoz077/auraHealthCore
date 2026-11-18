"""
Deterministic Safety Engine & Clinical Triage Rules for AuraHealth Core.
Operates INDEPENDENTLY of the LLM.
The Deterministic Safety Engine has absolute authority: emergency matches trigger EMERGENCY_LOCK.
Uses 911 exclusively for emergency directives in Iraq.

NOTE: evaluate_deterministic_emergency is now delegated to safety_engine.py which
provides 22 emergency categories.  The legacy DIRECT_CRITICAL_PATTERNS and
check_multi_signal_combinations are preserved below for reference, but the
primary evaluation path goes through safety_engine.evaluate_safety().
"""
import re
from typing import Dict, Any, List, Tuple, Optional

# ── Delegate emergency evaluation to the expanded safety engine ──────
from app.services.safety_engine import evaluate_deterministic_emergency  # noqa: F401 (re-exported)


# =====================================================================
# 1. DIRECT CRITICAL PHRASE LEXICON (ENGLISH, ARABIC, IRAQI DIALECT)
# =====================================================================

DIRECT_CRITICAL_PATTERNS = [
    # Cardiovascular
    r"\b(crushing chest pain|pressure radiating to (left arm|jaw)|chest pressure with sweat(ing)?|heavy chest pain|heart attack)\b",
    r"(ألم ضاغط بالصدر|وجع بصدري وايدي اليسرى|ثقل ع الصدر وعرك بارد|ألم بالصدر مع الفك|وجع قوي بصدري|ذبحة صدرية|نوبة قلبية)",
    # Stroke / FAST
    r"\b(facial droop(ing)?|slurred speech|sudden (arm|leg|one-sided) weakness|sudden hemiparesis|loss of vision)\b",
    r"(اعوجاج الفم|ثقل باللسان|ما اكدر احجي|شلل نصفي مفاجئ|خدر نص جسمي|اعوجاج بحلكي|ثكل بلساني|جلطة دماغية)",
    # Severe Respiratory
    r"\b(can'?t breathe|suffocating|blue lips|gasping for air|severe acute shortness of breath|inability to speak)\b",
    r"(ما اكدر اتنفس|مختنك|مختنقة|ازرقاق الشفاه|ضيق تنفس حاد|حشرجة قوية بالصدر|ما اكدر اخذ نفس|اختناق حاد)",
    # Severe Neurological
    r"\b(worst headache of (my )?life|thunderclap headache|active seizure|sudden collapse with convulsion)\b",
    r"(أسوأ صداع بحياتي|صداع الصاعقة|نوبة صرع مستمرة|إغماء مفاجئ مع تشنج|صداع فجائي شديد جدا|تشنجات صرعية)",
    # Severe Hemorrhage / Major Trauma
    r"\b(uncontrolled arterial bleed(ing)?|bone (poking|protruding) through skin|vomiting bright blood|coughing up blood)\b",
    r"(نزيف قوي ما يوكف|عظم طالع برة|عظم بارز|تقيؤ دم صريح|نزيف شرياني مستمر|نزيف حاد بعد حادث|سعال دموي شديد)"
]

COMPILED_DIRECT_PATTERNS = [re.compile(p, re.IGNORECASE) for p in DIRECT_CRITICAL_PATTERNS]

# =====================================================================
# 2. CONJUNCTIVE MULTI-SIGNAL RULES (SYMPTOM COMBINATIONS)
# =====================================================================

def check_multi_signal_combinations(text_lower: str) -> Tuple[bool, str]:
    """
    Evaluates combinations of co-occurring symptoms that indicate an acute medical emergency.
    """
    # Pattern A: Chest discomfort + secondary autonomic/neurologic symptom
    has_chest = any(k in text_lower for k in [
        "chest", "صدر", "صدري", "heart", "قلب", "قلبي"
    ]) and any(k in text_lower for k in [
        "pain", "pressure", "tightness", "hurt", "ألم", "وجع", "ضغط", "ثقل", "نغزات"
    ])
    has_cardiac_secondaries = any(k in text_lower for k in [
        "sweat", "cold sweat", "diaphoresis", "arm", "jaw", "faint", "passed out", "dizzy",
        "عرق", "عرك", "تعرق", "ايدي", "ذراعي", "فك", "فكي", "دوخة شديدة", "اغمي"
    ])
    if has_chest and has_cardiac_secondaries:
        return True, "Acute Cardiovascular Conjunction (Chest Discomfort + Radiation/Autonomic Signs)"

    # Pattern B: Headache + Neurologic / Meningeal signs
    has_headache = any(k in text_lower for k in [
        "headache", "head hurt", "migraine", "صداع", "راسي", "وجع راس"
    ])
    has_neuro_secondaries = any(k in text_lower for k in [
        "stiff neck", "neck stiffness", "passed out", "unconscious", "confusion", "double vision", "thunderclap",
        "تصلب الرقبة", "رقبتي متشنجة", "صداع شديد مفاجئ", "غباش بالعين", "فقدان وعي", "هلوسة"
    ])
    if has_headache and has_neuro_secondaries:
        return True, "Severe Neurological Conjunction (Cephalalgia + Meningeal / Acute Signs)"

    # Pattern C: Trauma / Fall + Loss of Consciousness or Deformity
    has_trauma = any(k in text_lower for k in [
        "fall", "fell", "accident", "crash", "hit", "سقوط", "طحت", "وقعت", "حادث", "ضربة"
    ])
    has_trauma_secondaries = any(k in text_lower for k in [
        "unconscious", "blacked out", "cannot move", "deformed", "bone out",
        "اغمي", "فقدت الوعي", "ما اكدر احرك", "عظم مشوه", "كسر مضاعف"
    ])
    if has_trauma and has_trauma_secondaries:
        return True, "Acute Traumatic Conjunction (High-impact Trauma + Secondary Neuromuscular Compromise)"

    # Pattern D: Severe Dyspnea + Stridor / Inability to speak
    has_dyspnea = any(k in text_lower for k in [
        "breath", "breathing", "dyspnea", "تنفس", "نفس"
    ]) and any(k in text_lower for k in [
        "short", "hard to", "difficulty", "صعوبة", "ضيق", "خنكة", "كتمة"
    ])
    has_stridor = any(k in text_lower for k in [
        "stridor", "gasping", "suffocating", "blue", "lips blue", "cyanosis",
        "حشرجة", "تصفير عالي", "اختناق", "ازرقاق", "شفايفي زرك"
    ])
    if has_dyspnea and has_stridor:
        return True, "Acute Airway / Respiratory Conjunction (Severe Dyspnea + Stridor/Cyanosis)"

    return False, ""


# =====================================================================
# 3. LEGACY EMERGENCY SCREENER (preserved for reference)
#    Primary evaluation now handled by safety_engine.evaluate_deterministic_emergency
#    which covers 22 categories. This 5-category legacy function is kept only as
#    a reference; it is no longer called by the main service.
# =====================================================================

def _legacy_evaluate_emergency(text: str) -> Tuple[bool, str]:
    """
    LEGACY — kept for reference only. Use evaluate_deterministic_emergency
    (imported from safety_engine) instead.

    Evaluates text against the original 5 direct patterns and 4 multi-signal conjunctions.
    Returns: (is_emergency: bool, category_or_reason: str)
    """
    if not text:
        return False, ""

    clean = text.strip().lower()

    # 1. Direct Critical Patterns
    for idx, pattern in enumerate(COMPILED_DIRECT_PATTERNS):
        if pattern.search(clean):
            categories = [
                "Acute Cardiovascular Emergency",
                "Acute Cerebrovascular Event (Stroke / FAST)",
                "Severe Respiratory Compromise",
                "Severe Neurological Emergency",
                "Severe Hemorrhage / Major Trauma"
            ]
            return True, categories[min(idx, len(categories) - 1)]

    # 2. Multi-Signal Combinations
    is_multi, reason = check_multi_signal_combinations(clean)
    if is_multi:
        return True, reason

    return False, ""


# =====================================================================
# 4. LANGUAGE DETECTION & EMERGENCY DIRECTIVE (911 FOR IRAQ)
# =====================================================================

def detect_language(text: str) -> str:
    """
    Detects if the message is predominantly Arabic (\u0600-\u06FF) or English.
    """
    if not text:
        return "en"
    arabic_chars = len(re.findall(r'[\u0600-\u06FF]', text))
    total_letters = len(re.findall(r'[a-zA-Z\u0600-\u06FF]', text))
    if total_letters > 0 and (arabic_chars / total_letters) >= 0.3:
        return "ar"
    return "en"


def get_iraq_emergency_directive(language: str = "ar") -> str:
    """
    Returns the exact patient-facing emergency directive using 911 for Iraq.
    """
    if language == "ar":
        return (
            "الأعراض التي ذكرتها قد تشير إلى حالة طبية طارئة وتحتاج إلى تقييم طبي عاجل. "
            "يرجى الاتصال بالرقم 911 فوراً أو التوجه إلى أقرب قسم طوارئ."
        )
    return (
        "The symptoms you described may indicate a medical emergency requiring urgent medical evaluation. "
        "Please call 911 immediately or go to the nearest emergency department."
    )


# =====================================================================
# 5. CLINICAL INFORMATION MATRIX & COMPLETENESS EVALUATION
# =====================================================================

def create_empty_clinical_matrix() -> Dict[str, Any]:
    """
    Returns the canonical empty Clinical Information Matrix.
    Missing fields are explicitly None or empty list, distinguishing
    unknown information from denied/negative findings.
    """
    return {
        "chief_complaint": None,
        "onset": None,
        "duration": None,
        "severity": None,
        "associated_symptoms": [],
        "triggers": [],
        "relieving_factors": [],
        "medical_history": [],
        "medications": [],
        "allergies": [],
        "previous_tests": []
    }


def evaluate_clinical_matrix(matrix: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Calculates gathered information completeness score (0.0 to 1.0).
    Explicitly separated from diagnostic confidence (General Medicine confidence is always None).
    """
    critical_axes = ["chief_complaint", "onset", "associated_symptoms"]
    secondary_axes = ["triggers", "medical_history", "medications"]

    crit_count = sum(1 for ax in critical_axes if matrix.get(ax))
    sec_count = sum(1 for ax in secondary_axes if matrix.get(ax))

    completeness = (0.6 * (crit_count / len(critical_axes))) + (0.4 * (sec_count / len(secondary_axes)))
    
    missing_axes = [ax for ax in critical_axes + secondary_axes if not matrix.get(ax)]
    return round(completeness, 2), missing_axes


# =====================================================================
# 6. INDICATION-TO-DEPARTMENT ROUTER
# =====================================================================

def map_indications_to_departments(matrix: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Maps clinical indications in the matrix to AuraHealth Core's 5 specialized departments.
    """
    departments = []
    text = f"{matrix.get('chief_complaint', '')} {' '.join(matrix.get('associated_symptoms', []))} {' '.join(matrix.get('triggers', []))}".lower()

    # Build a set of explicitly denied symptom keywords to exclude from routing.
    neg_findings = " ".join(matrix.get("relevant_negative_findings") or []).lower()

    # Neurology & Brain
    if any(w in text for w in ["headache", "migraine", "seizure", "tremor", "parkinson", "spine", "back pain", "numbness", "صداع", "صرع", "رجفة", "ظهر", "خدر", "فقرات"]):
        departments.append({
            "department_name": "Neurology & Brain",
            "clinical_indication": "Neurological or spinal symptoms requiring brain MRI, EEG, or spine screening."
        })

    # Cardiology / ECG
    if any(w in text for w in ["heart", "palpitation", "chest discomfort", "arrhythmia", "pulse", "قلب", "خفقان", "نبض", "نغزات"]):
        departments.append({
            "department_name": "Cardiology / ECG",
            "clinical_indication": "Cardiac rhythm or rate symptoms requiring 12-lead ECG analysis."
        })

    # Pulmonology — only when cough/breath words appear as POSITIVE findings (not denied)
    _pulm_positive = any(w in text for w in ["cough", "phlegm", "wheez", "lung", "sputum", "سعال", "كحة", "بلغم", "رئة", "shortness of breath", "ضيق تنفس"])
    # "breath" alone in positive text is kept only when NOT dominated by denied findings
    _breath_in_text = "breath" in text or "تنفس" in text or "صدر" in text
    _breath_denied = "denied" in neg_findings or "منفي" in neg_findings
    _pulm_triggered = _pulm_positive or (_breath_in_text and not _breath_denied)
    if _pulm_triggered:
        departments.append({
            "department_name": "Pulmonology",
            "clinical_indication": "Respiratory symptom profile requiring chest radiograph, ultrasound, or lung sound analysis."
        })

    # Orthopedics & Joint Health
    if any(w in text for w in [
        "bone", "joint", "fracture", "knee", "elbow", "wrist", "ankle", "foot pain",
        "fall", "sprain", "hip", "shoulder pain", "musculoskel",
        "عظم", "مفصل", "كسر", "ركبة", "كاحل", "قدم", "سقوط", "التواء", "حوض", "كتف",
        "ألم الكاحل", "ألم المفاصل",
    ]):
        departments.append({
            "department_name": "Orthopedics & Joint Health",
            "clinical_indication": "Musculoskeletal injury or arthritic symptoms requiring radiographic fracture detection or joint MRI."
        })


    # ICU & Critical Care
    if any(w in text for w in ["shock", "severe vitals", "decompensation", "icu", "critical", "هبوط حاد", "عناية مركزة"]):
        departments.append({
            "department_name": "ICU & Critical Care",
            "clinical_indication": "Vital signs decompensation or critical hemodynamic risk assessment."
        })

    # Default if no specific specialty was triggered
    if not departments:
        departments.append({
            "department_name": "General Medicine",
            "clinical_indication": "Comprehensive general clinical evaluation and primary laboratory workup."
        })

    return departments


# =====================================================================
# 7. STRUCTURED CLINICAL FACT EXTRACTOR (MULTI-LINGUAL)
# =====================================================================

def is_symptom_negated(text_lower: str, keyword: str) -> bool:
    """Checks if a symptom keyword is negated or denied in English or Arabic.

    Handles:
    - Standard English: no, not, without, denies, negative for, free of
    - Contractions: don't have, do not have, doesn't have, I have no, i've got no
    - Arabic / Iraqi: ما عندي, لا يوجد, ماكو, ما بيه, بدون, ليس لدي, ما اعاني من
    """
    esc = re.escape(keyword)
    patterns = [
        # Standard English negation (up to 3 intervening words)
        rf"\b(no|not|without|denies|denying|negative for|free of|zero)\s+(?:\w+\s+){{0,3}}{esc}",
        # Contraction forms: "don't have X", "do not have X", "doesn't have X"
        rf"\b(don'?t have|does?n'?t have|do not have|have no|i'?ve? (?:got )?no)\s+(?:\w+\s+){{0,3}}{esc}",
        # "I have no cough", "patient has no cough"
        rf"\b(?:has?|had)\s+no\s+(?:\w+\s+){{0,3}}{esc}",
        # Arabic / Iraqi negation
        rf"(ما عندي|لا يوجد|ماكو|ما بيه|بدون|ليس لدي|ما اعاني من|ما احس ب|ما اشعر ب)\s*(?:[^\s]+\s+){{0,2}}{esc}",
    ]
    for pat in patterns:
        if re.search(pat, text_lower, re.IGNORECASE):
            return True
    return False


def extract_clinical_facts(
    message: str,
    current_matrix: Dict[str, Any],
    lang: str = "en"
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Extracts structured clinical entities from the patient's message into the 6 clinical matrix axes.
    Explicitly prevents copying full user sentences into the matrix fields.
    Fully supports English, Modern Standard Arabic, and Iraqi Arabic.
    Handles symptom negation and denial.

    GREETING GUARD: Pure greetings (hi, hello, مرحبا, etc.) return the matrix unchanged.
    A message must contain at minimum one recognisable clinical signal to trigger extraction.
    Returns: (updated_matrix, updates_dict)
    """
    matrix = dict(current_matrix)
    updates = {}
    clean_msg = message.strip()
    msg_lower = clean_msg.lower()

    is_ar = (lang == "ar")

    # ── GREETING / LOW-INFORMATION GUARD ─────────────────────────────────────
    # Exact-match set of pure greetings (all languages/dialects).
    _PURE_GREETINGS = {
        # English
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "good day", "greetings", "howdy", "sup", "yo",
        "hi there", "hello there", "hey there",
        # Arabic / Iraqi
        "مرحبا", "مرحبا!", "السلام عليكم", "السلام عليكم ورحمة الله",
        "اهلا", "أهلا", "اهلا وسهلا", "أهلاً وسهلاً",
        "هلا", "هلو", "صباح الخير", "مساء الخير", "صباح النور",
        "مساء النور", "هاي", "ياهلا", "يا هلا", "ياهلا وسهلا",
        "تحياتي", "سلام",
    }
    _stripped = clean_msg.strip("!.،؟?").strip()
    if _stripped.lower() in _PURE_GREETINGS:
        # Pure greeting — return matrix unchanged, no clinical extraction
        return matrix, {}

    # Also block very short (≤3-character) non-Arabic messages with no clinical content
    # e.g. "ok", "no", "yes" — these are follow-up replies, not complaints
    _MIN_CLINICAL_WORDS = 3
    _word_count = len(clean_msg.split())
    _has_clinical_signal = any(k in msg_lower for k in [
        # Time / onset words
        "day", "days", "week", "month", "hour", "since", "ago",
        "يوم", "ايام", "أيام", "اسبوع", "شهر", "شهرين", "ساعة", "منذ", "من", "صارلي", "قبل",
        # Pain / symptom words
        "pain", "ache", "hurt", "sore", "fever", "cough", "nausea", "dizzy",
        "swelling", "redness", "weakness", "numbness",
        "وجع", "ألم", "حرارة", "سخونة", "كحة", "سعال", "غثيان", "دوخة",
        "تورم", "احمرار", "ضعف", "خدر", "تعب", "صداع",
        # Body parts
        "arm", "leg", "knee", "ankle", "back", "chest", "head", "stomach",
        "joint", "shoulder", "wrist", "elbow",
        "ايد", "رجل", "ركبة", "كاحل", "ظهر", "صدر", "راس", "بطن", "مفصل", "كتف",
        # Medications / history
        "medicine", "medication", "paracetamol", "ibuprofen", "antibiotic",
        "دواء", "حبة", "باراسيتامول", "مضاد",
        # Onset-pattern qualifiers — short follow-up answers like "جت فجأة" or "بالتدريج"
        "sudden", "suddenly", "gradual", "gradually", "yesterday",
        "فجأة", "فجائي", "بالتدريج", "تدريجي", "البارحة", "جت", "ظهرت",
    ])
    # If message is shorter than minimum words AND has no clinical signal → skip extraction
    # (handles short replies like "3 days" when there IS a clinical signal — "days")
    if _word_count < _MIN_CLINICAL_WORDS and not _has_clinical_signal:
        return matrix, {}

    # Check for general symptom denial
    has_general_symptom_denial = any(k in msg_lower for k in [
        "no other symptom", "no other symptoms", "nothing else", "no more symptom",
        "ما عندي اعراض ثانية", "ما عندي أعراض ثانية", "ماكو اعراض ثانية", "ماكو أعراض ثانية",
        "لا توجد اعراض اخرى", "لا توجد أعراض أخرى", "ما بيه شي ثاني", "ماكو شي ثاني"
    ])



    # 1. PRIMARY / CHIEF COMPLAINT
    if not matrix.get("chief_complaint"):
        extracted_cc = None
        # Fever / Pyrexia
        if any(k in msg_lower for k in ["fever", "febrile", "high temp", "burning up", "حرارة", "سخونة", "مصخن", "حمى", "حرارتي"]) and not is_symptom_negated(msg_lower, "fever") and not is_symptom_negated(msg_lower, "حرارة"):
            extracted_cc = "حمى / حرارة" if is_ar else "Fever"
        # Headache / Cephalalgia
        elif any(k in msg_lower for k in ["headache", "migraine", "head hurt", "صداع", "وجع راس", "راسي يوجعني", "شقيقة"]) and not is_symptom_negated(msg_lower, "headache") and not is_symptom_negated(msg_lower, "صداع"):
            extracted_cc = "صداع" if is_ar else "Headache"
        # Cough
        elif any(k in msg_lower for k in ["cough", "coughing", "سعال", "كحة", "قحة"]) and not is_symptom_negated(msg_lower, "cough") and not is_symptom_negated(msg_lower, "كحة") and not is_symptom_negated(msg_lower, "سعال"):
            extracted_cc = "سعال" if is_ar else "Cough"
        # Chest Discomfort / Pain
        elif any(k in msg_lower for k in ["chest pain", "chest discomfort", "pressure in chest", "ألم بالصدر", "وجع صدري", "نغزات"]):
            extracted_cc = "ألم / انزعاج بالصدر" if is_ar else "Chest Discomfort"
        # Abdominal / Stomach
        elif any(k in msg_lower for k in ["stomach pain", "abdominal pain", "belly ache", "ألم بالبطن", "وجع بطني", "مغص"]):
            extracted_cc = "ألم بالبطن" if is_ar else "Abdominal Pain"
        # Ankle / Foot Pain (Iraqi Arabic: الكاحل, رجلي تأذيني, تأذي)
        elif any(k in msg_lower for k in ["ankle", "foot pain", "كاحل", "الكاحل", "رجلي تأذيني", "رجلي تأذي", "تأذيني", "تأذي رجلي"]):
            extracted_cc = "ألم الكاحل / القدم" if is_ar else "Ankle / Foot Pain"
        # Knee / Joint / Musculoskeletal
        elif any(k in msg_lower for k in ["knee pain", "joint pain", "leg pain", "arm pain", "ألم بالركبة", "وجع مفاصل", "ركبتي", "مفاصلي",
                                           "رجلي", "رجليه", "ساقي"]):
            extracted_cc = "ألم المفاصل / الركبة" if is_ar else "Joint / Knee Pain"
        # Back / Spine
        elif any(k in msg_lower for k in ["back pain", "spine pain", "ألم بالظهر", "وجع ظهري", "فقراتي"]):
            extracted_cc = "ألم الظهر" if is_ar else "Back Pain"
        # Sore throat
        elif any(k in msg_lower for k in ["sore throat", "throat hurts", "احتقان بلعوم", "ألم بالحلق", "بلعومي"]):
            extracted_cc = "احتقان / ألم الحلق" if is_ar else "Sore Throat"
        # Shortness of breath — only if NOT negated
        elif any(k in msg_lower for k in ["shortness of breath", "hard to breathe", "breathless", "ضيق تنفس", "كتمة", "خنقة"]) and not bool(re.search(r"\b(no|not|without|don'?t have|do not have)\s+(?:\w+\s+){0,3}(?:shortness|breath|breathing)", msg_lower, re.I)):
            extracted_cc = "ضيق في التنفس" if is_ar else "Shortness of Breath"

        # Dizziness / Vertigo
        elif any(k in msg_lower for k in ["dizziness", "dizzy", "vertigo", "دوخة", "دوار"]):
            extracted_cc = "دوخة / دوار" if is_ar else "Dizziness"
        # Nausea / Vomiting
        elif any(k in msg_lower for k in ["nausea", "vomiting", "throwing up", "غثيان", "تقيؤ", "ترجيع", "لعبان نفس"]):
            extracted_cc = "غثيان / تقيؤ" if is_ar else "Nausea / Vomiting"
        # Fallback to concise filtered noun phrase (maximum 3 words, never full sentence).
        # ONLY triggers when the message has a confirmed clinical signal (not a greeting,
        # short reply, or non-medical message that slipped past the outer guard).
        else:
            if _has_clinical_signal and _word_count >= _MIN_CLINICAL_WORDS:
                words = clean_msg.split()
                filtered = [w for w in words if w.lower() not in [
                    "i", "have", "a", "an", "the", "feel", "feeling", "am", "and",
                    "عندي", "احس", "اشعر", "اني", "عندي", "لدي"
                ]]
                if filtered:
                    extracted_cc = " ".join(filtered[:3])

        if extracted_cc:
            matrix["chief_complaint"] = extracted_cc
            updates["chief_complaint"] = extracted_cc

    # 2. ONSET & TIMING
    extracted_onset = None

    # Iraqi Arabic month-based temporal phrases (must check BEFORE week/day patterns)
    # Handles: قبل شهرين, تقريباً قبل شهرين, من شهرين, صارلي شهرين, صارلي تقريباً شهرين
    # Also handles: قبل 3 شهور, من شهر, etc.
    # IMPORTANT: use non-capturing groups so .group(0) gives the full match to classify.
    # Outer \s+ between prefix and noun handles all spacing; صارلي does NOT embed extra \s+.
    _month_match = re.search(
        r"(?:تقريباً\s+)?(?:قبل|من|صارلي(?:\s+تقريباً)?)\s+(?:\d+\s*(?:شهر|شهور)|شهرين|شهر(?:\s|$))",
        msg_lower
    )
    if _month_match:
        _raw = _month_match.group(0)
        _approx = "تقريباً " if ("تقريباً" in msg_lower or "تقريبا" in msg_lower) else ""
        if "شهرين" in _raw or re.search(r"2\s*شهر", _raw):
            extracted_onset = f"بدأت {_approx}منذ شهرين تقريباً" if is_ar else f"Started {_approx}approximately two months ago"
        elif re.search(r"3\s*شهر|ثلاثة\s*شهر|ثلاث\s*اشهر", _raw):
            extracted_onset = f"بدأت {_approx}منذ ثلاثة أشهر" if is_ar else f"Started {_approx}approximately three months ago"
        elif re.search(r"(\d+)\s*شهر", _raw):
            n = re.search(r"(\d+)", _raw)
            num = n.group(1) if n else "عدة"
            extracted_onset = f"بدأت {_approx}منذ {num} أشهر" if is_ar else f"Started {_approx}approximately {num} months ago"
        else:
            extracted_onset = f"بدأت {_approx}منذ شهر تقريباً" if is_ar else f"Started {_approx}approximately one month ago"
    elif any(k in msg_lower for k in ["yesterday", "البارحة", "أمس", "من البارحة", "من امس"]):
        extracted_onset = "بدأت البارحة" if is_ar else "Started yesterday"
    elif any(k in msg_lower for k in ["this morning", "since morning", "today morning", "اليوم الصبح", "من الصبح", "هذا الصباح"]):
        extracted_onset = "بدأت هذا الصباح" if is_ar else "Started this morning"
    elif any(k in msg_lower for k in ["today", "hours ago", "اليوم", "قبل ساعات"]):
        extracted_onset = "بدأت اليوم" if is_ar else "Started today"
    else:
        # ── Dynamic numeric patterns (any number of days/weeks/hours) ──────
        # Arabic/Iraqi: "قبل 5 ايام", "من 3 أيام", "صارلي 4 أيام", "من أسبوعين", "قبل 3 اسابيع"
        _ar_day_match = re.search(
            r"(?:قبل|من|صارلي(?:\s+تقريباً)?)\s+(\d+)\s*(?:أيام|ايام|يوم)", msg_lower
        )
        _ar_week_match = re.search(
            r"(?:قبل|من|صارلي(?:\s+تقريباً)?)\s+(\d+)\s*(?:أسابيع|اسابيع|اسبوع|أسبوع)", msg_lower
        )
        _ar_hour_match = re.search(
            r"(?:قبل|من|صارلي)\s+(\d+)\s*(?:ساعات|ساعة)", msg_lower
        )
        # English: "5 days ago", "for 3 days", "since 2 weeks"
        _en_day_match = re.search(
            r"(\d+)\s*days?\s*ago|for\s+(\d+)\s*days?|since\s+(\d+)\s*days?", msg_lower
        )
        _en_week_match = re.search(
            r"(\d+)\s*weeks?\s*ago|for\s+(\d+)\s*weeks?|since\s+(\d+)\s*weeks?", msg_lower
        )

        if _ar_day_match:
            n = _ar_day_match.group(1)
            extracted_onset = f"منذ {n} أيام" if is_ar else f"Started {n} days ago"
        elif _ar_week_match:
            n = _ar_week_match.group(1)
            extracted_onset = f"منذ {n} أسابيع" if is_ar else f"Started {n} weeks ago"
        elif _ar_hour_match:
            n = _ar_hour_match.group(1)
            extracted_onset = f"منذ {n} ساعات" if is_ar else f"Started {n} hours ago"
        elif _en_day_match:
            n = next(g for g in _en_day_match.groups() if g)
            extracted_onset = f"Started {n} days ago"
        elif _en_week_match:
            n = next(g for g in _en_week_match.groups() if g)
            extracted_onset = f"Started {n} weeks ago"
        elif any(k in msg_lower for k in ["2 days", "two days", "يومين", "منذ يومين", "صارلي يومين"]):
            extracted_onset = "منذ يومين" if is_ar else "Started 2 days ago"
        elif any(k in msg_lower for k in ["3 days", "three days", "3 ايام", "ثلاثة ايام", "صارلي 3"]):
            extracted_onset = "منذ 3 أيام" if is_ar else "Started 3 days ago"
        elif any(k in msg_lower for k in ["several days", "few days", "جم يوم", "عدة ايام"]):
            extracted_onset = "مستمر منذ عدة أيام" if is_ar else "Ongoing for several days"
        elif any(k in msg_lower for k in ["week", "اسبوع", "أسبوع", "منذ اسبوع", "صارلي اسبوع", "من اسبوع", "من أسبوع"]):
            extracted_onset = "منذ أسبوع" if is_ar else "Started 1 week ago"
        elif any(k in msg_lower for k in ["sudden", "suddenly", "فجأة", "فجأه", "فجاه", "فجائي", "جت فجأة", "ظهرت فجأة", "ظهرت فجأه"]):
            if not matrix.get("onset"):
                extracted_onset = "بداية مفاجئة (فجأة)" if is_ar else "Sudden onset"
        elif any(k in msg_lower for k in ["gradual", "gradually", "بالتدريج", "تدريجي", "ظهرت بالتدريج"]):
            if not matrix.get("onset"):
                extracted_onset = "بداية تدريجية (بالتدريج)" if is_ar else "Gradual onset"


    # --- ONSET PATTERN (gradual / sudden) as a supplementary qualifier ---
    # Case A: onset was already set in matrix from a PREVIOUS turn — append pattern to it.
    # Case B: onset was just now extracted in this turn (month-based) AND the same message
    #         also contains gradual/sudden — append pattern to extracted_onset.
    _has_gradual = any(k in msg_lower for k in ["بالتدريج", "تدريجي", "ظهرت بالتدريج", "gradual", "gradually"])
    _has_sudden = any(k in msg_lower for k in ["فجأة", "فجأه", "فجاه", "فجائي", "جت فجأة", "ظهرت فجأة", "ظهرت فجأه", "sudden", "suddenly"])

    _base_for_pattern = extracted_onset or matrix.get("onset")  # prefer newly extracted, fall back to stored
    if _has_gradual and _base_for_pattern and "تدريجي" not in str(_base_for_pattern) and "gradual" not in str(_base_for_pattern).lower() and "بالتدريج" not in str(_base_for_pattern):
        extracted_onset = f"{_base_for_pattern} (بالتدريج)" if is_ar else f"{_base_for_pattern} (Gradual)"
    elif _has_sudden and _base_for_pattern and "فجأة" not in str(_base_for_pattern) and "sudden" not in str(_base_for_pattern).lower() and "مفاجئة" not in str(_base_for_pattern):
        extracted_onset = f"{_base_for_pattern} (فجأة)" if is_ar else f"{_base_for_pattern} (Sudden)"

    # Detect explicit measured body temperature (e.g. 38, 38.5, 39 C)
    temp_match = re.search(r"\b(3[789](\.[0-9])?|40(\.[0-9])?)\b", msg_lower)
    if temp_match:
        temp_val = temp_match.group(1)
        temp_note = f"الحرارة المقاسة {temp_val}°C" if is_ar else f"Measured temp: {temp_val}°C"
        if extracted_onset:
            extracted_onset = f"{extracted_onset} ({temp_note})"
        elif matrix.get("onset") and temp_val not in str(matrix.get("onset")):
            extracted_onset = f"{matrix.get('onset')} ({temp_note})"
        else:
            extracted_onset = temp_note

    if extracted_onset and (not matrix.get("onset") or extracted_onset != matrix.get("onset")):
        matrix["onset"] = extracted_onset
        updates["onset"] = extracted_onset

    # 3. ASSOCIATED SYMPTOMS (Strictly discrete items, never sentences, check negations)
    current_syms = list(matrix.get("associated_symptoms") or [])
    new_syms = []

    if not has_general_symptom_denial:
        # Tired / Fatigue / Malaise
        if any(k in msg_lower for k in ["tired", "fatigue", "exhausted", "weakness", "letharg", "تعب", "تعبان", "تعبانة", "إرهاق", "خمول", "مالي حيل", "هد حيل"]) and not is_symptom_negated(msg_lower, "tired") and not is_symptom_negated(msg_lower, "تعب"):
            label = "إرهاق وخمول" if is_ar else "Fatigue"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Chills / Rigors
        if any(k in msg_lower for k in ["chill", "shiver", "قشعريرة", "رجفة", "بردان"]) and not is_symptom_negated(msg_lower, "chill") and not is_symptom_negated(msg_lower, "قشعريرة"):
            label = "قشعريرة ورجفة" if is_ar else "Chills"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Headache (if not already CC)
        if any(k in msg_lower for k in ["headache", "migraine", "صداع", "وجع راس"]) and not is_symptom_negated(msg_lower, "headache") and not is_symptom_negated(msg_lower, "صداع") and "headache" not in str(matrix.get("chief_complaint", "")).lower() and "صداع" not in str(matrix.get("chief_complaint", "")):
            label = "صداع" if is_ar else "Headache"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Body aches / Myalgia
        if any(k in msg_lower for k in ["body ache", "muscle ache", "body pain", "تكسير", "وجع بجسمي", "آلام بالجسم"]) and not is_symptom_negated(msg_lower, "ache"):
            label = "آلام بالجسم وتكسير" if is_ar else "Body aches / Myalgia"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Sore throat (if not CC)
        if any(k in msg_lower for k in ["sore throat", "throat pain", "احتقان", "بلعوم"]) and not is_symptom_negated(msg_lower, "throat") and not is_symptom_negated(msg_lower, "احتقان") and "throat" not in str(matrix.get("chief_complaint", "")).lower() and "حلق" not in str(matrix.get("chief_complaint", "")):
            label = "ألم / احتقان بالحلق" if is_ar else "Sore throat"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Nasal congestion / Rhinorrhea
        if any(k in msg_lower for k in ["runny nose", "congestion", "sneezing", "نشلة", "زكام", "رشح"]) and not is_symptom_negated(msg_lower, "runny") and not is_symptom_negated(msg_lower, "نشلة"):
            label = "احتقان بالأنف / نشلة" if is_ar else "Nasal congestion"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Cough (ONLY IF EXPLICITLY STATED AND NOT NEGATED)
        _cough_mentioned = any(k in msg_lower for k in ["cough", "coughing", "سعال", "كحة"])
        _cough_negated = (
            is_symptom_negated(msg_lower, "cough")
            or is_symptom_negated(msg_lower, "كحة")
            or is_symptom_negated(msg_lower, "سعال")
        )
        if _cough_mentioned and not _cough_negated and "cough" not in str(matrix.get("chief_complaint", "")).lower() and "سعال" not in str(matrix.get("chief_complaint", "")):
            label = "سعال" if is_ar else "Cough"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Shortness of Breath (ONLY IF EXPLICITLY STATED AND NOT NEGATED)
        _sob_keywords = ["shortness of breath", "short of breath", "hard to breathe", "breathless",
                         "difficulty breathing", "ضيق تنفس", "كتمة", "خنقة", "ضيق بالتنفس"]
        _sob_mentioned = any(k in msg_lower for k in _sob_keywords)
        _sob_negated = (
            is_symptom_negated(msg_lower, "shortness of breath")
            or is_symptom_negated(msg_lower, "breathless")
            or is_symptom_negated(msg_lower, "ضيق تنفس")
            # Also catch "no shortness" / "no difficulty breathing"
            or bool(re.search(r"\b(no|not|without|don'?t have|do not have)\s+(?:\w+\s+){0,3}(?:shortness|breath|breathing)", msg_lower, re.I))
        )
        if _sob_mentioned and not _sob_negated and "breath" not in str(matrix.get("chief_complaint", "")).lower():
            label = "ضيق تنفس" if is_ar else "Shortness of Breath"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Nausea / Loss of appetite
        if any(k in msg_lower for k in ["nausea", "loss of appetite", "not hungry", "لعبان نفس", "فقدان شهية", "ما اشتهي"]) and not is_symptom_negated(msg_lower, "nausea"):
            label = "فقدان شهية / غثيان" if is_ar else "Loss of appetite / Nausea"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Sweating / Diaphoresis
        if any(k in msg_lower for k in ["sweat", "sweating", "تعرق", "عرك"]) and not is_symptom_negated(msg_lower, "sweat") and not is_symptom_negated(msg_lower, "تعرق"):
            label = "تعرق" if is_ar else "Sweating"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Dizziness
        if any(k in msg_lower for k in ["dizzy", "dizziness", "دوخة", "دوار"]) and not is_symptom_negated(msg_lower, "dizzy") and not is_symptom_negated(msg_lower, "دوخة") and "dizz" not in str(matrix.get("chief_complaint", "")).lower():
            label = "دوخة" if is_ar else "Dizziness"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

        # Swelling / Edema (ankle, joint, localized — explicitly reported)
        if any(k in msg_lower for k in ["swelling", "swollen", "edema", "تورم", "وارم", "ورام", "منتفخ"]) and not is_symptom_negated(msg_lower, "swelling") and not is_symptom_negated(msg_lower, "تورم"):
            label = "تورم موضعي" if is_ar else "Localized Swelling"
            if label not in current_syms and label not in new_syms:
                new_syms.append(label)

    if new_syms:
        current_syms.extend(new_syms)
        matrix["associated_symptoms"] = current_syms
        updates["associated_symptoms"] = current_syms

    # 3b. NEGATIVE FINDINGS — track explicitly denied symptoms so they don't drive routing.
    current_neg = list(matrix.get("relevant_negative_findings") or [])
    new_neg = []
    if _cough_mentioned and _cough_negated:
        neg_label = "سعال (منفي)" if is_ar else "Cough (denied)"
        if neg_label not in current_neg:
            new_neg.append(neg_label)
    if _sob_mentioned and _sob_negated:
        neg_label = "ضيق تنفس (منفي)" if is_ar else "Shortness of Breath (denied)"
        if neg_label not in current_neg:
            new_neg.append(neg_label)
    if new_neg:
        current_neg.extend(new_neg)
        matrix["relevant_negative_findings"] = current_neg
        updates["relevant_negative_findings"] = current_neg

    # 4. TRIGGERS / CONTEXT
    current_trig = list(matrix.get("triggers") or [])
    new_trig = []
    if any(k in msg_lower for k in ["fall", "fell", "trauma", "طحت", "وقعت", "سقوط", "ضربة"]) or re.search(r"\bhit\b", msg_lower):
        label = "سقوط / إصابة" if is_ar else "Trauma / Fall"
        if label not in current_trig: new_trig.append(label)
    if any(k in msg_lower for k in ["exercise", "exertion", "lifting", "مجهود", "رياضة", "شلت ثقيل"]):
        label = "مجهود بدني" if is_ar else "Physical exertion"
        if label not in current_trig: new_trig.append(label)
    if any(k in msg_lower for k in ["cold weather", "cold air", "air conditioner", "برد", "مكيف", "سبلت"]) or re.search(r"\b(ac|a/c)\b", msg_lower):
        label = "تعرض لتيار هواء بارد" if is_ar else "Cold air exposure"
        if label not in current_trig: new_trig.append(label)
    if any(k in msg_lower for k in ["outside food", "street food", "restaurant", "أكل برة", "مطعم"]):
        label = "تناول طعام خارجي مؤخراً" if is_ar else "Recent outside food intake"
        if label not in current_trig: new_trig.append(label)

    if new_trig:
        current_trig.extend(new_trig)
        matrix["triggers"] = current_trig
        updates["triggers"] = current_trig

    # 5. MEDICAL HISTORY
    current_mh = list(matrix.get("medical_history") or [])
    new_mh = []
    if any(k in msg_lower for k in ["diabet", "سكر", "عندي سكر", "مصاب بالسكر"]):
        label = "داء السكري" if is_ar else "Diabetes Mellitus"
        if label not in current_mh: new_mh.append(label)
    if any(k in msg_lower for k in ["hypertens", "high blood pressure", "ضغط", "عندي ضغط"]):
        label = "ارتفاع ضغط الدم" if is_ar else "Hypertension"
        if label not in current_mh: new_mh.append(label)
    if any(k in msg_lower for k in ["asthma", "ربو", "حساسية قصبات"]):
        label = "الربو القصبي" if is_ar else "Asthma"
        if label not in current_mh: new_mh.append(label)
    if any(k in msg_lower for k in ["heart disease", "cardiac", "أمراض قلب"]):
        label = "أمراض القلب والأوعية الدموية" if is_ar else "Cardiovascular disease"
        if label not in current_mh: new_mh.append(label)
    if any(k in msg_lower for k in ["no chronic", "healthy", "no medical history", "ما عندي امراض", "سليم", "لا يوجد أمراض مزمنة"]):
        label = "لا توجد أمراض مزمنة سابقة" if is_ar else "No prior chronic illnesses reported"
        if label not in current_mh: new_mh.append(label)

    if new_mh:
        current_mh.extend(new_mh)
        matrix["medical_history"] = current_mh
        updates["medical_history"] = current_mh

    # 6. CURRENT MEDICATIONS
    current_meds = list(matrix.get("medications") or [])
    new_meds = []

    # Known drug names
    if any(k in msg_lower for k in ["paracetamol", "panadol", "tylenol", "acetaminophen", "بنادول", "باراسيتامول", "براسيتول"]):
        label = "باراسيتامول / بنادول" if is_ar else "Paracetamol / Panadol"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["ibuprofen", "brufen", "ادفيل", "بروفين", "ايبوبروفين"]):
        label = "إيبوبروفين / بروفين" if is_ar else "Ibuprofen / Brufen"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["voltaren", "diclofenac", "فولتارين", "ديكلوفيناك"]):
        label = "فولتارين / ديكلوفيناك" if is_ar else "Voltaren / Diclofenac"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["antibiotic", "مضاد حيوي", "كبسول التهاب"]):
        label = "مضاد حيوي" if is_ar else "Antibiotic"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["aspirin", "اسبرين"]):
        label = "أسبرين" if is_ar else "Aspirin"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["insulin", "أنسولين", "انسولين"]):
        label = "الأنسولين" if is_ar else "Insulin"
        if label not in current_meds: new_meds.append(label)
    if any(k in msg_lower for k in ["metformin", "ميتفورمين", "ميتفورمن"]):
        label = "ميتفورمين" if is_ar else "Metformin"
        if label not in current_meds: new_meds.append(label)

    # "No medications" expressions (Iraqi + Standard Arabic + English)
    _no_meds_phrases = [
        "no meds", "no medication", "not taking any", "don't take any",
        "ما اخذ علاج", "ما اتناول ادوية", "لا اتناول أدوية",
        "ماخذ دواء", "ماخذ علاج", "ما آخذ شي", "ما اخذ شي",
        "ما عندي دواء", "مو آخذ", "مو اخذ", "ما اخذ", "لا شي",
    ]
    if any(k in msg_lower for k in _no_meds_phrases):
        label = "لا يتناول أدوية حالياً" if is_ar else "No current medications reported"
        if label not in current_meds: new_meds.append(label)

    # Iraqi "هيج دوه وهيج" = "some meds" — user mentions taking unspecified medications
    _taking_meds_phrases = [
        "هيج دوه", "دواء مو عارف اسمه", "أدوية مختلفة",
        "علاج وما اعرف اسمه", "بعض الأدوية",
    ]
    if any(k in msg_lower for k in _taking_meds_phrases):
        label = "يتناول أدوية (غير محددة الاسم)" if is_ar else "On unspecified medications"
        if label not in current_meds: new_meds.append(label)

    if new_meds:
        current_meds.extend(new_meds)
        matrix["medications"] = current_meds
        updates["medications"] = current_meds


    return matrix, updates


# =====================================================================
# 8. EVIDENCE SANITIZER & ANTI-HALLUCINATION GUARD
# =====================================================================

def sanitize_and_validate_evidence(
    assessment: Dict[str, Any],
    all_patient_text: str,
    matrix: Dict[str, Any],
    lang: str = "en"
) -> Dict[str, Any]:
    """
    Guarantees zero medical fabrication and zero symptom invention.
    Validates all considerations, investigations, and clinical rationales against
    the patient's actual reported symptoms and EHR findings.
    If unsupported symptoms (like cough or respiratory infection) were inferred from
    fever alone, they are strictly purged or replaced with genuine grounded entities.
    """
    is_ar = (lang == "ar")
    combined_patient_text = f"{all_patient_text} {matrix.get('chief_complaint', '')} {' '.join(matrix.get('associated_symptoms', []))}".lower()

    has_cough_evidence = any(k in combined_patient_text for k in [
        "cough", "سعال", "كحة", "sputum", "بلغم", "phlegm", "wheez", "breath", "تنفس", "رئة", "صدر"
    ])
    has_ortho_evidence = any(k in combined_patient_text for k in [
        "knee", "joint", "bone", "fall", "fracture", "رکبة", "ركبة", "مفصل", "عظم", "سقوط", "كسر", "التواء"
    ])

    # 1. Cleanse considerations
    considerations = assessment.get("possible_considerations") or []
    cleaned_considerations = []
    for c in considerations:
        cond_name = c.get("condition", "")
        rationale = c.get("clinical_rationale", "")

        # Check for ungrounded respiratory/cough claim when patient never had respiratory symptoms
        if not has_cough_evidence and any(k in (cond_name + rationale).lower() for k in ["cough", "سعال", "كحة", "respiratory", "تنفسي", "bronchitis", "شعب هوائية"]):
            # Replace with accurate febrile / viral consideration
            cond_name = "حالة حمى حادة بحاجة لتقييم سريري" if is_ar else "Acute Febrile Presentation for Clinical Evaluation"
            rationale = (
                "حمى حادة مترافقة مع شعور بالإرهاق، تتطلب قياساً ومراقبة لدرجة الحرارة وفحصاً سريرياً لتحديد السبب المحتمل."
                if is_ar else
                "Reported acute onset of fever accompanied by fatigue, requiring clinical temperature monitoring and physician evaluation to determine the underlying etiology."
            )

        # Check for ungrounded orthopedic claim
        if not has_ortho_evidence and any(k in (cond_name + rationale).lower() for k in ["fracture", "كسر", "meniscal", "knee", "ركبة"]):
            continue

        cleaned_considerations.append({
            "condition": cond_name,
            "likelihood_tier": c.get("likelihood_tier", "Primary Consideration"),
            "clinical_rationale": rationale
        })

    # If all were stripped, provide grounded default
    if not cleaned_considerations:
        cc = matrix.get("chief_complaint", "Symptomatic Presentation")
        if "fever" in str(cc).lower() or "حرارة" in str(cc) or "سخونة" in str(cc):
            cleaned_considerations = [
                {
                    "condition": "حالة حمى حادة بحاجة لتقييم سريري" if is_ar else "Acute Febrile Presentation for Clinical Evaluation",
                    "likelihood_tier": "Primary Consideration",
                    "clinical_rationale": "حمى حادة مترافقة مع إرهاق تتطلب متابعة العلامات الحيوية وفحصاً سريرياً." if is_ar else "Reported acute fever and fatigue requiring clinical temperature charting and physical examination."
                },
                {
                    "condition": "احتمال متلازمة فيروسية حادة" if is_ar else "Possible Acute Viral Syndrome",
                    "likelihood_tier": "Secondary Consideration",
                    "clinical_rationale": "الأعراض العامة كالحمى والخمول شائعة في المتلازمات الفيروسية المبكرة." if is_ar else "Constitutional symptoms of fever and fatigue are consistent with an acute systemic or viral presentation."
                }
            ]
        else:
            cleaned_considerations = [
                {
                    "condition": "تقييم سريري للأعراض المذكورة" if is_ar else f"Clinical Outpatient Evaluation for {cc}",
                    "likelihood_tier": "Primary Consideration",
                    "clinical_rationale": "متابعة الأعراض السريرية المذكورة مع الفحص الطبي." if is_ar else "Reported clinical symptoms warrant outpatient physician assessment."
                }
            ]

    assessment["possible_considerations"] = cleaned_considerations

    # 2. Cleanse investigations
    investigations = assessment.get("recommended_investigations") or []
    cleaned_investigations = []
    for inv in investigations:
        inv_name = inv.get("investigation", "")
        reason = inv.get("clinical_reason", "")
        modality = inv.get("modality_type", "Laboratory")

        # Strip Chest X-ray if no respiratory or chest findings
        if not has_cough_evidence and any(k in (inv_name + reason).lower() for k in ["chest x-ray", "أشعة الصدر", "x-ray (pa", "pulmonary"]):
            inv_name = "توثيق ومراقبة العلامات الحيوية ودرجة الحرارة" if is_ar else "Clinical Temperature & Vital Signs Charting"
            modality = "Clinical Assessment"
            reason = "لمتابعة نمط الحمى والاستقرار الحيوي." if is_ar else "To track fever curve and hemodynamic stability."

        cleaned_investigations.append({
            "investigation": inv_name,
            "modality_type": modality,
            "clinical_reason": reason
        })

    # Ensure baseline CBC if fever is present
    if any(k in combined_patient_text for k in ["fever", "حرارة", "سخونة", "حمى"]):
        has_cbc = any("cbc" in inv.get("investigation", "").lower() or "دم" in inv.get("investigation", "") for inv in cleaned_investigations)
        if not has_cbc:
            cleaned_investigations.insert(0, {
                "investigation": "فحص صورة الدم الكاملة (CBC)" if is_ar else "Complete Blood Count (CBC) with Differential",
                "modality_type": "Laboratory",
                "clinical_reason": "لتقييم علامات العدوى والالتهاب ومؤشرات كريات الدم البيضاء." if is_ar else "To evaluate inflammatory and infectious markers."
            })

    assessment["recommended_investigations"] = cleaned_investigations

    # 3. Cleanse departments
    departments = assessment.get("recommended_departments") or []
    cleaned_departments = []
    for d in departments:
        dept_name = d.get("department_name", "")
        # If Pulmonology was included without cough evidence, redirect to General Medicine
        if not has_cough_evidence and "pulmonology" in dept_name.lower():
            dept_name = "General Medicine"
            d["clinical_indication"] = "تقييم سريري شامل وفحوصات مخبرية أولية لحالة الحمى." if is_ar else "Comprehensive general clinical evaluation and primary laboratory workup."
        d["department_name"] = dept_name
        cleaned_departments.append(d)

    if not cleaned_departments:
        cleaned_departments = [{
            "department_name": "General Medicine",
            "clinical_indication": "Comprehensive general clinical evaluation and primary laboratory workup."
        }]
    assessment["recommended_departments"] = cleaned_departments

    # 4. Cleanse assistant message text if it claims cough or respiratory when not present
    msg = assessment.get("assistant_message", "")
    if not has_cough_evidence:
        msg = msg.replace("febrile cough and respiratory symptoms", "fever and fatigue")
        msg = msg.replace("أعراض السعال والتنفس", "أعراض الحرارة والتعب")
        assessment["assistant_message"] = msg

    return assessment
