"""
AuraHealth Safety Engine — Deterministic Pre-LLM Emergency Screener.

Operates COMPLETELY INDEPENDENT of the LLM.
Emergency decisions made here CANNOT be overridden by any LLM response.
Covers 22 emergency categories in English, Standard Arabic, and Iraqi Arabic dialect.

Public API (backward-compatible with triage_rules.py):
    evaluate_safety(text) -> SafetyResult
    evaluate_deterministic_emergency(text) -> Tuple[bool, str]   # legacy alias
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass(frozen=True)
class SafetyResult:
    """Immutable result from the safety engine. Emergency is final — LLM cannot override."""
    is_emergency: bool
    category: str
    rationale: str
    confidence: str          # 'definite' | 'probable'
    matched_signals: List[str] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.is_emergency


# =====================================================================
# RED-FLAG KNOWLEDGE BASE  (22 categories)
# Each entry: category, rationale, direct_patterns, combination_signals
# All patterns: English | Standard Arabic | Iraqi Arabic dialect
# =====================================================================

RED_FLAG_CATEGORIES = [

    # ── 1. ACUTE CARDIOVASCULAR ──────────────────────────────────────
    {
        "category": "Acute Cardiovascular Emergency",
        "rationale": "Possible STEMI / ACS / acute coronary syndrome",
        "direct_patterns": [
            r"\b(crushing chest pain|pressure radiating to (left arm|jaw|back)"
            r"|chest pressure with sweat|heavy chest pain|heart attack"
            r"|myocardial infarction|cardiac arrest|heart stopped"
            r"|acute coronary syndrome)\b",
            r"(ألم ضاغط بالصدر|وجع بصدري وايدي اليسرى|ثقل ع الصدر وعرك بارد"
            r"|ألم بالصدر مع الفك|وجع قوي بصدري|ذبحة صدرية|نوبة قلبية"
            r"|توقف القلب|سكتة قلبية|ألم ينتشر للذراع|صدري يوجعني وايدي)",
        ],
        "combination_signals": [
            {
                "primary":  ["chest", "صدر", "صدري", "heart", "قلب", "قلبي"],
                "secondary_pain": ["pain", "pressure", "tightness", "hurt",
                                   "ألم", "وجع", "ضغط", "ثقل", "نغزات", "حرقة"],
                "secondary_autonomic": [
                    "sweat", "cold sweat", "diaphoresis", "arm", "jaw", "faint",
                    "passed out", "dizzy",
                    "نعرق", "عرق", "عرك بارد", "ايدي", "ذراعي", "فكي",
                    "دوخة شديدة", "اغمي", "تعرق",
                ],
                "require": ["primary", "secondary_pain", "secondary_autonomic"],
                "label": "Cardiac Chest Pain + Radiation / Autonomic Signs",
            }
        ],
    },

    # ── 2. STROKE / FAST ─────────────────────────────────────────────
    {
        "category": "Acute Cerebrovascular Event (Stroke / FAST)",
        "rationale": "Possible acute ischaemic or haemorrhagic stroke — time-critical",
        "direct_patterns": [
            r"\b(facial droop(ing)?|face drooping|slurred speech"
            r"|sudden (arm|leg|one.?sided) weakness|sudden hemiparesis"
            r"|loss of vision|sudden blindness|sudden inability to speak"
            r"|cerebrovascular accident|CVA|TIA)\b",
            r"(اعوجاج الفم|ثقل باللسان|ما اكدر احجي|شلل نصفي مفاجئ"
            r"|خدر نص جسمي|اعوجاج بحلكي|ثكل بلساني|جلطة دماغية"
            r"|تدلي الوجه|ضعف مفاجئ بنص الجسم|تعثر في الكلام"
            r"|فقدان البصر المفاجئ|شلل الوجه)",
        ],
        "combination_signals": [
            {
                "primary":  ["face", "وجه", "وجهي", "arm", "ايدي", "ذراع",
                             "leg", "رجل", "speech", "حجي", "كلام"],
                "secondary": ["droop", "numb", "weak", "sudden", "cannot move",
                              "paralyzed", "اعوجاج", "خدر", "ضعف مفاجئ",
                              "ما اكدر", "شلل", "تدلي", "مفاجئ"],
                "require": ["primary", "secondary"],
                "label": "Stroke FAST Signs",
            }
        ],
    },

    # ── 3. SEVERE RESPIRATORY / AIRWAY ───────────────────────────────
    {
        "category": "Severe Respiratory / Airway Emergency",
        "rationale": "Life-threatening airway obstruction or respiratory failure",
        "direct_patterns": [
            r"\b(can'?t breathe|cannot breathe|suffocating|blue lips"
            r"|cyanosis|gasping for air|severe acute shortness of breath"
            r"|inability to speak due to breathlessness|choking"
            r"|airway obstruction|respiratory failure)\b",
            r"(ما اكدر اتنفس|ماكدر اتنفس|ماكدر أتنفس|ماكدر آخذ نفس"
            r"|مختنك|مختنقة|ازرقاق الشفاه|ضيق تنفس حاد"
            r"|حشرجة قوية بالصدر|ما اكدر اخذ نفس|اختناق حاد"
            r"|شفايفي زرقة|ما اكدر احجي من الضيق|اختناق كامل"
            r"|ما اكدر اتنفس بتاتاً|ضيق نفس حتى وانا جالس)",
        ],
        "combination_signals": [
            {
                "primary":  ["breath", "breathing", "تنفس", "نفس", "هواء", "ضيق نفس"],
                "secondary_severity": ["short", "hard", "difficulty", "cannot",
                                       "can't", "صعوبة", "ضيق", "خنكة", "ما اكدر", "ماكدر"],
                "secondary_acute": ["stridor", "gasping", "suffocating", "blue",
                                    "cyanosis", "حشرجة", "اختناق", "ازرقاق",
                                    "شفايفي زرك", "صفير عالي", "حتى وانا جالس"],
                # Require ALL 3 groups — prevents false positive on negated phrases
                # e.g. "No cough or shortness of breath" has "breath"+"short" but no acute signal
                "require": ["primary", "secondary_severity", "secondary_acute"],
                "label": "Acute Airway / Respiratory Failure",
            },
            {
                # Arabic-only: persistent dyspnea at rest — restrict to Arabic terms only
                # to avoid matching English "two days" + fever symptoms
                "primary": ["ضيق نفس", "ماكدر اتنفس", "ما اكدر اتنفس"],
                "secondary": ["جالس", "راحة", "حتى", "وانا", "أيام", "ايام"],
                "require": ["primary", "secondary"],
                "label": "Severe Persistent Dyspnoea at Rest",
            },
        ],

    },


    # ── 4. SEVERE NEUROLOGICAL ───────────────────────────────────────
    {
        "category": "Severe Neurological Emergency",
        "rationale": "Possible subarachnoid haemorrhage, status epilepticus, or acute meningitis",
        "direct_patterns": [
            r"\b(worst headache of (my )?life|thunderclap headache"
            r"|active seizure|sudden collapse with convulsion|seizure right now"
            r"|convulsing|status epilepticus|brain bleed)\b",
            r"(أسوأ صداع بحياتي|صداع الصاعقة|نوبة صرع مستمرة"
            r"|إغماء مفاجئ مع تشنج|صداع فجائي شديد جدا|تشنجات صرعية"
            r"|نزيف دماغي|صداع انفجاري|صارله تشنج هلا|صداع ما شفت مثله)",
        ],
        "combination_signals": [
            {
                "primary":  ["headache", "head hurt", "صداع", "راسي",
                             "وجع راس", "رأسي"],
                "secondary": ["stiff neck", "neck stiffness", "passed out",
                              "unconscious", "confusion", "double vision",
                              "thunderclap", "vomiting", "photophobia",
                              "تصلب الرقبة", "رقبتي متشنجة", "صداع شديد مفاجئ",
                              "غباش بالعين", "فقدان وعي", "هلوسة",
                              "قيء مع صداع شديد", "حساسية للضوء"],
                "require": ["primary", "secondary"],
                "label": "Severe Cephalgia + Meningeal / Neurological Signs",
            }
        ],
    },

    # ── 5. SEVERE HAEMORRHAGE / MAJOR TRAUMA ─────────────────────────
    {
        "category": "Severe Haemorrhage / Major Trauma",
        "rationale": "Uncontrolled haemorrhage, penetrating injury, or high-energy mechanism",
        "direct_patterns": [
            r"\b(uncontrolled (arterial )?bleed(ing)?|bone (poking|protruding) through skin"
            r"|vomiting bright red blood|coughing up blood|gunshot|stabbing wound"
            r"|blood won'?t stop|bleeding heavily)\b",
            r"(نزيف قوي ما يوكف|عظم طالع برة|عظم بارز|تقيؤ دم صريح"
            r"|نزيف شرياني مستمر|نزيف حاد بعد حادث|سعال دموي شديد"
            r"|طلقة نارية|طعنة|دم ما يوقف|نزيف ما يوقف)",
        ],
        "combination_signals": [
            {
                "primary":  ["bleed", "blood", "نزيف", "دم", "دموي"],
                "secondary": ["heavy", "uncontrolled", "won't stop", "spurting",
                              "ما يوكف", "ما يوقف", "شديد", "كثير", "ينزل كثير"],
                "require": ["primary", "secondary"],
                "label": "Severe Haemorrhage Signals",
            },
            {
                "primary":  ["fall", "fell", "accident", "crash", "hit",
                             "سقوط", "طحت", "وقعت", "حادث", "ضربة"],
                "secondary": ["unconscious", "blacked out", "cannot move",
                              "deformed", "bone out", "اغمي", "فقدت الوعي",
                              "ما اكدر احرك", "عظم مشوه", "كسر مضاعف", "ما صحى"],
                "require": ["primary", "secondary"],
                "label": "Major Trauma + Neuromuscular Compromise",
            },
        ],
    },

    # ── 6. ANAPHYLAXIS ───────────────────────────────────────────────
    {
        "category": "Severe Allergic Reaction / Anaphylaxis",
        "rationale": "Systemic anaphylaxis — immediate epinephrine required",
        "direct_patterns": [
            r"\b(anaphylaxis|anaphylactic (shock|reaction)|throat (closing|swelling)"
            r"|tongue swelling|severe allergic reaction|epipen"
            r"|lips swelling with shortness of breath)\b",
            r"(صدمة تحسسية|تضيق الحلق|انتفاخ اللسان|رد فعل تحسسي حاد"
            r"|حلقي ينسكر|لساني منتفخ وما اكدر اتنفس|حساسية شديدة مع ضيق"
            r"|توَرم الشفاه مع ضيق التنفس|حشرة لسعت وحلقي)",
        ],
        "combination_signals": [
            {
                "primary":  ["allerg", "حساسية", "sting", "لسعة", "nut",
                             "food", "أكل"],
                "secondary": ["swelling", "throat", "tongue", "lips", "breath",
                              "hives", "rash", "حلق", "لسان", "شفاه", "تورم",
                              "ضيق", "تنفس"],
                "require": ["primary", "secondary"],
                "label": "Anaphylaxis Signals",
            }
        ],
    },

    # ── 7. GI EMERGENCY ──────────────────────────────────────────────
    {
        "category": "Acute Gastrointestinal Emergency",
        "rationale": "GI bleed, bowel obstruction, or acute visceral emergency",
        "direct_patterns": [
            r"\b(vomiting blood|haematemesis|blood in stool|black tarry stool"
            r"|melena|bowel obstruction|ruptured (bowel|intestine))\b",
            r"(قيء دموي|تقيؤ دم|براز أسود زفتي|ميلينا|دم بالبراز"
            r"|انسداد معوي|بطن منتفخ مع قيء شديد|تمزق الأمعاء"
            r"|دم من المعدة|براز أسود وزفتي الريحة)",
        ],
        "combination_signals": [],
    },

    # ── 8. SEVERE ACUTE ABDOMEN ──────────────────────────────────────
    {
        "category": "Severe Acute Abdominal Presentation",
        "rationale": "Possible peritonitis, perforated viscus, or aortic emergency",
        "direct_patterns": [
            r"\b(rigid (board|board.?like) abdomen|peritonitis"
            r"|perforated (bowel|ulcer)|ruptured appendix"
            r"|abdominal aortic aneurysm|AAA rupture)\b",
            r"(بطن صلب كالخشب|التهاب الصفاق|انثقاب الأمعاء|انفجار الزائدة"
            r"|تمزق أبهر البطن|بطن صلب مع ألم شديد|ألم بطني شديد لا يطاق)",
        ],
        "combination_signals": [],
    },

    # ── 9. SEPSIS / SEVERE INFECTION ─────────────────────────────────
    {
        "category": "Sepsis / Severe Systemic Infection",
        "rationale": "Sepsis triad — possible septic shock requiring urgent management",
        "direct_patterns": [
            r"\b(septic shock|sepsis|meningococcal rash|purpura fulminans"
            r"|petechial rash with fever|non-blanching rash|septicaemia)\b",
            r"(صدمة إنتانية|تسمم الدم|انتان حاد|طفح جلدي لا يختفي بالضغط مع حمى"
            r"|إنتان بالدم|ضربة شمس حادة|حمى شديدة مع ارتباك)",
        ],
        "combination_signals": [
            {
                "primary":  ["fever", "حرارة", "سخونة", "حمى",
                             "temperature high"],
                "secondary": ["confused", "confusion", "not responding",
                              "unconscious", "very high", "very sick",
                              "cold extremities", "mottled skin", "رعشة",
                              "ارتعاش شديد", "تشوش", "ما يستجيب",
                              "برودة الأطراف", "جلد رخامي",
                              "حمى شديدة جداً مع ارتباك"],
                "require": ["primary", "secondary"],
                "label": "Sepsis Triad Signals",
            }
        ],
    },

    # ── 10. ACUTE EYE / VISION ───────────────────────────────────────
    {
        "category": "Acute Eye / Vision Emergency",
        "rationale": "Sudden visual loss, acute glaucoma, or chemical eye injury",
        "direct_patterns": [
            r"\b(sudden (loss of|blindness in) (one|both) eye"
            r"|vision (gone|disappeared)|chemical in eye|acid in eye"
            r"|acute glaucoma attack|eye pain with vomiting"
            r"|retinal detachment|curtain over vision)\b",
            r"(فقدان البصر المفاجئ|عمى مفاجئ بعين|مادة كيميائية بالعين"
            r"|هجوم جلوكوما|ألم شديد بالعين مع غثيان"
            r"|ستارة أمام البصر|انفصال الشبكية|بصري اختفى فجأة)",
        ],
        "combination_signals": [],
    },

    # ── 11. PREGNANCY / REPRODUCTIVE ─────────────────────────────────
    {
        "category": "Pregnancy / Reproductive Emergency",
        "rationale": "Possible eclampsia, ectopic rupture, or severe obstetric complication",
        "direct_patterns": [
            r"\b(eclampsia|seizure (during|in) pregnancy|pre-eclampsia with seizure"
            r"|ectopic pregnancy rupture|heavy bleeding (during|in) pregnancy"
            r"|placental abruption|cord prolapse"
            r"|baby (not moving|stopped moving))\b",
            r"(تشنج أثناء الحمل|انفجار حمل خارج الرحم|نزيف شديد في الحمل"
            r"|مشيمة منزاحة|انفصال المشيمة|تسمم الحمل مع تشنج"
            r"|الجنين ما يتحرك من زمان|ألم بطني مع حمل)",
        ],
        "combination_signals": [],
    },

    # ── 12. MAJOR BURNS ──────────────────────────────────────────────
    {
        "category": "Major Burns Emergency",
        "rationale": "Extensive or deep burns requiring emergency burn care",
        "direct_patterns": [
            r"\b(large burn|full thickness burn|burn covering (face|hands|airway)"
            r"|chemical burn|electrical burn|inhalation injury|burned all over)\b",
            r"(حروق واسعة|حروق عميقة|حرق يغطي الوجه|حرق كيميائي"
            r"|حرق كهربائي|استنشاق دخان|حروق في كل مكان|حريق شديد)",
        ],
        "combination_signals": [],
    },

    # ── 13. METABOLIC / SYSTEMIC ─────────────────────────────────────
    {
        "category": "Metabolic / Systemic Emergency",
        "rationale": "DKA, hypoglycaemic coma, or severe electrolyte crisis",
        "direct_patterns": [
            r"\b(diabetic ketoacidosis|DKA|hypoglycaemic coma"
            r"|blood sugar (very low|dangerously low)|adrenal crisis"
            r"|thyroid storm|hypertensive emergency|hypertensive crisis)\b",
            r"(حماض السكري|غيبوبة سكر|سكر الدم منخفض جداً|أزمة الغدة الكظرية"
            r"|أزمة الغدة الدرقية|ارتفاع ضغط الدم الحرجي"
            r"|سكري وخفقان وعرق وارتعاش شديد|سكر الدم وقع كثير)",
        ],
        "combination_signals": [
            {
                "primary":  ["diabetic", "sugar", "glucose", "سكر", "سكري",
                             "سكريات"],
                "secondary": ["unconscious", "fitting", "not responding",
                              "coma", "very confused", "غيبوبة", "ما يستجيب",
                              "فقدان وعي", "تشنج", "ارتباك شديد"],
                "require": ["primary", "secondary"],
                "label": "Diabetic Emergency Signals",
            }
        ],
    },

    # ── 14. POISONING / TOXIC EXPOSURE ───────────────────────────────
    {
        "category": "Poisoning / Toxic Exposure",
        "rationale": "Suspected poisoning, overdose, or toxic inhalation",
        "direct_patterns": [
            r"\b(overdose|took too many pills|swallowed (bleach|poison|chemicals)"
            r"|carbon monoxide poisoning|intentional self-harm with medication"
            r"|pesticide poisoning|organophosphate exposure)\b",
            r"(جرعة زائدة|ابتلع مواد كيميائية|تسمم بالمبيدات"
            r"|تسمم أول أكسيد الكربون|ابتلع أدوية كثيرة|شرب مواد سامة"
            r"|إيذاء نفس بالدواء|شرب مبيد حشري|تعرض لمواد كيميائية)",
        ],
        "combination_signals": [],
    },

    # ── 15. ALTERED / LOSS OF CONSCIOUSNESS ──────────────────────────
    {
        "category": "Altered or Loss of Consciousness",
        "rationale": "Sudden LOC or unresponsiveness — multiple potential causes",
        "direct_patterns": [
            r"\b(lost consciousness|passed out|fainted and (did not|hasn'?t) wake up"
            r"|unresponsive|not waking up|suddenly collapsed|collapsed unconscious)\b",
            r"(فقد الوعي|إغماء ولم يصح|لا يستجيب|فقدان الوعي المفاجئ"
            r"|انهار فجأة|ما يصحى|مغيب|ما يرد على النداء"
            r"|طاح فجأة ما صحى|يغمى عليه ولا يفيق)",
        ],
        "combination_signals": [],
    },

    # ── 16. ACTIVE SEIZURE ───────────────────────────────────────────
    {
        "category": "Active Seizure / Status Epilepticus",
        "rationale": "Seizure lasting >5 minutes or repeated without recovery",
        "direct_patterns": [
            r"\b(active seizure|seizure right now|fitting now|convulsing now"
            r"|continuous seizure|seizure (lasted|lasting) more than (5|10|15) minutes"
            r"|status epilepticus)\b",
            r"(نوبة صرع الآن|يتشنج الآن|تشنج مستمر|لم يفق بعد النوبة"
            r"|صرع ما وكف|هلا عنده تشنجات|صارله تشنج مستمر)",
        ],
        "combination_signals": [],
    },

    # ── 17. SUDDEN NEUROLOGICAL DEFICIT ──────────────────────────────
    {
        "category": "Sudden Neurological Deficit",
        "rationale": "Abrupt focal deficit — possible TIA/stroke requiring time-critical imaging",
        "direct_patterns": [
            r"\b(sudden (weakness|numbness|paralysis|tingling) in (one side|half) of (body|face)"
            r"|sudden confusion|sudden inability to walk|acute ataxia"
            r"|sudden (double vision|diplopia)|sudden loss of balance)\b",
            r"(ضعف مفاجئ بنص الجسم|خدر مفاجئ|شلل مفاجئ|فقدان التوازن المفاجئ"
            r"|ارتباك مفاجئ|عدم القدرة على المشي فجأة|رؤية مزدوجة مفاجئة"
            r"|طاح فجأة ما يكدر يمشي|خدر نص جسمه فجأة)",
        ],
        "combination_signals": [],
    },

    # ── 18. SEVERE CHEST (NON-CARDIAC) ───────────────────────────────
    {
        "category": "Severe Acute Chest Presentation",
        "rationale": "Possible pulmonary embolism, tension pneumothorax, or aortic dissection",
        "direct_patterns": [
            r"\b(pulmonary embolism|PE|blood clot (in lung|in the lung)"
            r"|sudden sharp pleuritic chest pain with breathlessness"
            r"|tension pneumothorax|aortic dissection|tearing chest pain)\b",
            r"(جلطة رئوية|انسداد رئوي|تمزق الأبهر|ألم صدري حاد ممزق"
            r"|الاستنشاق مؤلم جداً|استرواح الصدر|دم بالرئة"
            r"|ضيق تنفس مع ألم حاد بالصدر)",
        ],
        "combination_signals": [],
    },

    # ── 19. RAPIDLY WORSENING DETERIORATION ──────────────────────────
    {
        "category": "Rapidly Worsening Clinical Deterioration",
        "rationale": "Acute rapid multi-system deterioration — immediate assessment required",
        "direct_patterns": [],
        "combination_signals": [
            {
                "primary":  ["getting worse", "rapidly worsening", "deteriorating fast",
                             "يسوء بسرعة", "يتدهور", "يزداد سوءاً"],
                "secondary": ["can't breathe", "losing consciousness", "very pale",
                              "very weak", "ما يكدر يتنفس", "فاقد الوعي",
                              "شاحب كثير", "ضعيف جداً", "رجفة شديدة"],
                "require": ["primary", "secondary"],
                "label": "Multi-system Rapid Deterioration",
            }
        ],
    },

    # ── 20. PEDIATRIC RED FLAGS ───────────────────────────────────────
    {
        "category": "Pediatric Emergency Red Flag",
        "rationale": "High-risk presentation in infant or child",
        "direct_patterns": [
            r"\b(infant (not breathing|stopped breathing|is limp|is unresponsive)"
            r"|baby (is )?(not breathing|stopped breathing|fitting|convulsing|blue|unresponsive|limp)"
            r"|fontanelle bulging|high-pitched (cry|screaming) in baby"
            r"|febrile convulsion (in child|lasting more than))\b",
            r"(طفل لا يتنفس|رضيع متوقف التنفس|طفل يتشنج|اليافوخ بارز"
            r"|رضيع أزرق|طفل لا يستجيب|بكاء حاد متون عند الرضيع"
            r"|حمى مع تشنج عند طفل صغير|الولد توقف يتنفس)",
        ],
        "combination_signals": [
            {
                "primary": ["baby", "infant", "newborn", "رضيع", "مولود"],
                "secondary": [
                    "limp", "unresponsive", "not breathing", "stopped breathing",
                    "not waking", "unconscious", "blue", "fitting", "convulsing",
                    "لا يستجيب", "متوقف", "لا يتنفس", "مغيب", "أزرق",
                ],
                "require": ["primary", "secondary"],
                "label": "Infant / Baby Emergency",
            }
        ],
    },

    # ── 21. SEVERE ACUTE PAIN PATTERN ────────────────────────────────
    {
        "category": "Severe Acute Pain Emergency Pattern",
        "rationale": "Sudden-onset maximum-severity pain — possible catastrophic event",
        "direct_patterns": [
            r"\b(10 out of 10 pain|(worst|most severe) pain (I'?ve|of my) (ever felt|life)"
            r"|excruciating (abdominal|chest|back|head) pain|pain (is|was) unbearable"
            r"|sudden onset maximum severity pain)\b",
            r"(ألم 10 من 10|أسوأ ألم في حياتي|ألم لا يُحتمل"
            r"|ألم انفجاري مفاجئ|أشد وجع بحياتي|ألم عشرة من عشرة"
            r"|وجع ما شفت مثله|وجع لا أطيقه أبداً)",
        ],
        "combination_signals": [],
    },

    # ── 22. SELF-HARM / SUICIDAL CRISIS WITH MEANS ───────────────────
    {
        "category": "Acute Self-Harm / Suicidal Crisis",
        "rationale": "Active self-harm or suicidal act — immediate psychiatric and medical emergency",
        "direct_patterns": [
            r"\b(I (cut|harmed|hurt|stabbed) myself"
            r"|(taking|took|swallowed) (all my pills|overdose)"
            r"|I want to (die|kill myself)|I am going to kill myself"
            r"|wrists bleeding|self-harm right now)\b",
            r"(جرحت نفسي|آذيت نفسي|شربت كل الأدوية|أريد أن أموت"
            r"|سأقتل نفسي|معصمي ينزف|إيذاء نفسي الآن|أذيت نفسي)",
        ],
        "combination_signals": [],
    },
]


# =====================================================================
# COMPILED PATTERN CACHE (built on first call)
# =====================================================================

_COMPILED_CACHE: list = []


def _build_cache() -> list:
    cache = []
    for cat_def in RED_FLAG_CATEGORIES:
        cache.append({
            "category": cat_def["category"],
            "rationale": cat_def["rationale"],
            "direct": [
                re.compile(p, re.IGNORECASE | re.UNICODE)
                for p in cat_def.get("direct_patterns", [])
            ],
            "combos": cat_def.get("combination_signals", []),
        })
    return cache


def _get_cache() -> list:
    global _COMPILED_CACHE
    if not _COMPILED_CACHE:
        _COMPILED_CACHE = _build_cache()
    return _COMPILED_CACHE


# =====================================================================
# COMBINATION SIGNAL EVALUATOR
# =====================================================================

def _check_combination(text_lower: str, combo: dict) -> bool:
    """Returns True if ALL required signal groups are present in text."""
    for group_name in combo.get("require", []):
        keywords = combo.get(group_name, [])
        if not any(k in text_lower for k in keywords):
            return False
    return True


# =====================================================================
# PUBLIC API
# =====================================================================

def evaluate_safety(text: str) -> SafetyResult:
    """
    Evaluates input text against the full 22-category red-flag knowledge base.

    Emergency results are FINAL.  No LLM response may downgrade them.

    Args:
        text: Raw user message in any language.

    Returns:
        SafetyResult(is_emergency=True, ...) if a red flag matched,
        otherwise SafetyResult(is_emergency=False, ...).
    """
    if not text or not text.strip():
        return SafetyResult(
            is_emergency=False,
            category="",
            rationale="Empty input",
            confidence="definite",
            matched_signals=[],
        )

    text_lower = text.strip().lower()

    for entry in _get_cache():
        category = entry["category"]
        rationale = entry["rationale"]

        # 1. Direct pattern match
        for compiled_pat in entry["direct"]:
            m = compiled_pat.search(text_lower)
            if m:
                return SafetyResult(
                    is_emergency=True,
                    category=category,
                    rationale=rationale,
                    confidence="definite",
                    matched_signals=[m.group(0)[:80]],
                )

        # 2. Combination signals
        for combo in entry["combos"]:
            if _check_combination(text_lower, combo):
                return SafetyResult(
                    is_emergency=True,
                    category=category,
                    rationale=combo.get("label", rationale),
                    confidence="probable",
                    matched_signals=[combo.get("label", "")],
                )

    return SafetyResult(
        is_emergency=False,
        category="",
        rationale="No red flags detected",
        confidence="definite",
        matched_signals=[],
    )


def evaluate_deterministic_emergency(text: str) -> Tuple[bool, str]:
    """
    Legacy backward-compatible alias used by triage_rules.py and general_medicine_service.py.
    Returns (is_emergency: bool, category: str).
    """
    result = evaluate_safety(text)
    return result.is_emergency, result.category
