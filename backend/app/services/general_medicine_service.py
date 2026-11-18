"""
General Medicine Clinical Reasoning Service — LLM Provider Architecture.

Architecture (per-turn):
    1. Safety Engine   (deterministic, EMERGENCY_LOCK — cannot be overridden)
    2. LLM Provider    (multi-turn + tool-calling loop, max 5 iterations)
    3. Tool Registry   (authorized AuraHealth tools only)
    4. Pydantic Schema validation
    5. Deterministic Fallback (when LLM unavailable or all retries exhausted)

The LLM NEVER directly accesses the database, filesystem, or other patients.
The Safety Engine's emergency decision is FINAL.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ValidationError

from app.services.triage_rules import (
    detect_language,
    get_iraq_emergency_directive,
    evaluate_clinical_matrix,
    map_indications_to_departments,
    extract_clinical_facts,
    sanitize_and_validate_evidence,
)
from app.services.safety_engine import evaluate_safety
from app.services.llm_provider import LLMProvider, LLMChatResult, get_llm_provider
from app.services.tool_registry import AuraHealthToolRegistry, TOOL_DEFINITIONS

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 5   # Hard cap on LLM ↔ tool loop iterations


# =====================================================================
# PYDANTIC SCHEMA (extended from original)
# =====================================================================

class ClinicalUpdates(BaseModel):
    chief_complaint: Optional[str] = None
    onset: Optional[str] = None
    onset_pattern: Optional[str] = None          # NEW: "sudden" | "gradual" | "unknown"
    duration: Optional[str] = None
    severity: Optional[str] = None
    associated_symptoms: List[str] = Field(default_factory=list)
    triggers: List[str] = Field(default_factory=list)
    relieving_factors: List[str] = Field(default_factory=list)
    medical_history: List[str] = Field(default_factory=list)
    medications: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)               # NEW
    relevant_negative_findings: List[str] = Field(default_factory=list) # NEW


class LLMTriageResponse(BaseModel):
    assistant_message: str
    language: str
    state: str           # QUESTIONING | SYNTHESIS | EMERGENCY
    clinical_updates: ClinicalUpdates
    information_completeness: float
    needs_more_questions: bool
    next_question_axis: Optional[str] = None
    triage_urgency: str  # ROUTINE | MODERATE | URGENT_PRIORITY | EMERGENCY
    possible_considerations: List[Dict[str, str]] = Field(default_factory=list)
    recommended_investigations: List[Dict[str, str]] = Field(default_factory=list)
    recommended_departments: List[Dict[str, str]] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)  # NEW
    safety_escalation: bool = False
    disclaimer: str


# =====================================================================
# SYSTEM PROMPT BUILDER
# =====================================================================

_SYSTEM_PROMPT = """You are AuraHealth Core's General Medicine AI Clinical Assistant.
You conduct empathetic, bilingual clinical symptom intake in Arabic, Iraqi Arabic dialect, or English.

STRICT CLINICAL RULES:
1. DYNAMIC QUESTIONING: Remain in QUESTIONING state until information_completeness >= 0.75.
   Ask ONE focused follow-up question per turn.
   NEVER transition to SYNTHESIS on the first user message unless an acute emergency is present.

2. ENTITY EXTRACTION: Extract clean, concise structured facts into clinical_updates.
   Examples:
     - "قبل شهرين" → onset = "Started approximately two months ago"
     - "فجأة" → onset_pattern = "sudden"
     - "بالتدريج" → onset_pattern = "gradual"
     - "من 4 أيام" → duration = "approximately 4 days"
     - "لا" (to medications Q) → medications = ["none"]
     - "مضاد هيستامين" → medications = ["antihistamine"]
   NEVER copy full user sentences into matrix fields.
   NEVER repeat questions about information already in the clinical matrix.

3. ZERO HALLUCINATION: NEVER add symptoms the patient did not explicitly report.
   Fever alone does NOT imply cough. Only recommend chest X-ray if cough is reported.

4. FRAMING: NEVER say "You have disease X". Use: "Conditions that may be considered include…"

5. TOOL CALLS: You may request AuraHealth tools to retrieve patient context.
   When requesting a tool, return a JSON with the tool call in "tool_calls" field.
   The backend will execute authorized tools and return results for you to incorporate.

6. EMERGENCY LOCK: If you detect symptoms that may be life-threatening, set state=EMERGENCY.
   However, the backend's Safety Engine has FINAL authority — it can set EMERGENCY_LOCK
   regardless of your assessment.

7. EMERGENCY DOWNGRADE PROHIBITED: You MUST NEVER return triage_urgency="ROUTINE" or
   triage_urgency="MODERATE" when the Safety Engine has already set EMERGENCY_LOCK.

8. CONFIDENCE: General Medicine diagnostic confidence is ALWAYS null/None. Never invent it.

9. LANGUAGE: Respond in the exact conversational language of the patient.

10. OUTPUT: Your response MUST be valid JSON matching the schema exactly.

JSON SCHEMA:
{
  "assistant_message": "string",
  "language": "ar|en",
  "state": "QUESTIONING|SYNTHESIS|EMERGENCY",
  "clinical_updates": {
    "chief_complaint": "string|null",
    "onset": "string|null",
    "onset_pattern": "sudden|gradual|unknown|null",
    "duration": "string|null",
    "severity": "string|null",
    "associated_symptoms": [],
    "triggers": [],
    "relieving_factors": [],
    "medical_history": [],
    "medications": [],
    "risk_factors": [],
    "relevant_negative_findings": []
  },
  "information_completeness": 0.0,
  "needs_more_questions": true,
  "next_question_axis": "string|null",
  "triage_urgency": "ROUTINE|MODERATE|URGENT_PRIORITY|EMERGENCY",
  "possible_considerations": [],
  "recommended_investigations": [],
  "recommended_departments": [],
  "tool_calls": [],
  "safety_escalation": false,
  "disclaimer": "string"
}"""


def _build_system_prompt(safety_is_emergency: bool = False) -> str:
    if not safety_is_emergency:
        return _SYSTEM_PROMPT
    return (
        _SYSTEM_PROMPT
        + "\n\nCRITICAL: The Safety Engine has confirmed an EMERGENCY. "
        "Your triage_urgency MUST be 'EMERGENCY'. "
        "You may write a compassionate emergency response message, "
        "but you CANNOT downgrade the emergency status."
    )


# =====================================================================
# GENERAL MEDICINE SERVICE
# =====================================================================

class GeneralMedicineService:
    """
    Entry point for all General Medicine clinical reasoning.

    Provider injection via constructor supports both production (Gemini)
    and automated tests (MockLLMProvider).
    """

    def __init__(
        self,
        provider: Optional[LLMProvider] = None,
        tool_registry: Optional[AuraHealthToolRegistry] = None,
    ):
        self._provider = provider or get_llm_provider()
        self._registry = tool_registry or AuraHealthToolRegistry()

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name

    @property
    def model_name(self) -> str:
        return self._provider.model_name

    # ── PRIMARY PUBLIC ENTRY POINT ────────────────────────────────────

    def process_patient_turn(
        self,
        message: str,
        current_matrix: Dict[str, Any],
        conversation_history: List[Dict[str, Any]],
        grounded_ehr: Optional[Dict[str, Any]] = None,
        # Tool execution context (required for tool calling in router)
        db=None,
        current_user_id: Optional[int] = None,
        current_user_role: str = "patient",
        session_patient_id: Optional[int] = None,
        session_uuid: Optional[str] = None,
        verify_doctor_fn=None,
    ) -> Dict[str, Any]:
        """
        Executes the full turn pipeline:
          Layer 1: Deterministic Safety Engine (EMERGENCY_LOCK — final authority)
          Layer 2: LLM Provider with tool-calling loop (up to MAX_TOOL_ITERATIONS)
          Layer 3: Deterministic Fallback (when LLM unavailable)

        Args:
            message:              Latest user message.
            current_matrix:       Clinical Information Matrix (modified in-place).
            conversation_history: Recent messages for context.
            grounded_ehr:         Pre-fetched EHR records from router.
            db:                   SQLAlchemy session (needed for tool execution).
            current_user_id:      Authenticated user ID.
            current_user_role:    'patient' | 'doctor' | 'admin'
            session_patient_id:   Patient ID bound to session (trusted).
            session_uuid:         Current session UUID (trusted).
            verify_doctor_fn:     Callable(db, doctor_id, patient_id) -> bool.

        Returns:
            Dict response matching LLMTriageResponse structure, plus
            'provider_name' and 'model_name' metadata.
        """
        detected_lang = detect_language(message)

        # ── LAYER 1: SAFETY ENGINE (absolute authority) ───────────────
        safety_result = evaluate_safety(message)
        if safety_result.is_emergency:
            directive = get_iraq_emergency_directive(detected_lang)
            return self._emergency_response(directive, detected_lang, safety_result.category)

        # ── Pre-extract structured facts from the new message ─────────
        user_turn_count = sum(
            1 for m in conversation_history
            if m.get("sender") in ("patient", "user", "doctor")
        ) + 1

        updated_matrix, pre_updates = extract_clinical_facts(
            message, current_matrix, detected_lang
        )
        current_matrix.clear()
        current_matrix.update(updated_matrix)

        # ── LAYER 2: LLM PROVIDER WITH TOOL-CALLING LOOP ─────────────
        llm_result = None
        if self._provider:
            try:
                llm_result = self._run_llm_with_tools(
                    message=message,
                    matrix=current_matrix,
                    history=conversation_history,
                    ehr=grounded_ehr or {},
                    lang=detected_lang,
                    user_turn_count=user_turn_count,
                    db=db,
                    current_user_id=current_user_id,
                    current_user_role=current_user_role,
                    session_patient_id=session_patient_id,
                    session_uuid=session_uuid,
                    verify_doctor_fn=verify_doctor_fn,
                )
            except Exception as exc:
                logger.error("LLM provider error in process_patient_turn: %s", exc)
                llm_result = None

        if llm_result:
            # Safety upgrade guard: LLM cannot downgrade safety engine's decision
            if safety_result.is_emergency and llm_result.get("triage_urgency") != "EMERGENCY":
                llm_result["triage_urgency"] = "EMERGENCY"
                llm_result["state"] = "EMERGENCY_LOCK"
            # Semantic safety escalation from LLM
            if llm_result.get("safety_escalation") and llm_result.get("triage_urgency") not in ("EMERGENCY", "URGENT_PRIORITY"):
                llm_result["triage_urgency"] = "URGENT_PRIORITY"
            llm_result["provider_name"] = self.provider_name
            llm_result["model_name"] = self.model_name
            return llm_result

        # ── LAYER 3: DETERMINISTIC FALLBACK ──────────────────────────
        result = self._safe_deterministic_fallback(
            message=message,
            matrix=current_matrix,
            lang=detected_lang,
            ehr=grounded_ehr,
            user_turn_count=user_turn_count,
            pre_extracted_updates=pre_updates,
            conversation_history=conversation_history,
        )
        result["provider_name"] = "fallback"
        result["model_name"] = "deterministic"
        return result

    # ── TOOL-CALLING LOOP ─────────────────────────────────────────────

    def _run_llm_with_tools(
        self,
        message: str,
        matrix: Dict[str, Any],
        history: List[Dict[str, Any]],
        ehr: Dict[str, Any],
        lang: str,
        user_turn_count: int,
        db,
        current_user_id: Optional[int],
        current_user_role: str,
        session_patient_id: Optional[int],
        session_uuid: Optional[str],
        verify_doctor_fn,
    ) -> Optional[Dict[str, Any]]:
        """
        Runs the LLM ↔ tool loop with a hard maximum of MAX_TOOL_ITERATIONS.

        Loop:
          1. Call LLM with conversation + tool_definitions
          2. If response_type == "tool_calls": execute authorized tools → append results → loop
          3. If response_type == "text": parse, validate, return
          4. If response_type == "error": return None (triggers fallback)
          5. If MAX_TOOL_ITERATIONS reached: call LLM once more without tools for final answer
        """
        system_prompt = _build_system_prompt(safety_is_emergency=False)

        # Build initial messages from conversation history
        messages = self._build_messages(message, matrix, history, ehr, user_turn_count, lang)

        # Determine whether tool execution is possible
        tools_available = (
            db is not None
            and session_patient_id is not None
        )
        tool_defs = TOOL_DEFINITIONS if tools_available else None

        tool_iterations = 0
        executed_tool_calls = []

        while tool_iterations < MAX_TOOL_ITERATIONS:
            result: LLMChatResult = self._provider.chat(
                system_prompt=system_prompt,
                messages=messages,
                tool_definitions=tool_defs,
            )

            if result.response_type == "error":
                logger.warning("LLM provider error: %s", result.error_message)
                return None

            if result.response_type == "text":
                return self._parse_and_validate_response(
                    result.text, matrix, history, message, lang, user_turn_count,
                    executed_tool_calls=executed_tool_calls,
                )

            if result.response_type == "tool_calls":
                tool_iterations += 1
                # Record the model's tool-call turn in messages
                for tc in result.tool_calls:
                    messages.append({
                        "role": "model",
                        "tool_call": {"name": tc.name, "args": tc.args},
                    })

                    # Execute each tool with authorization
                    if tools_available:
                        tool_result = self._registry.execute(
                            tool_name=tc.name,
                            args=tc.args,
                            db=db,
                            current_user_id=current_user_id or 0,
                            current_user_role=current_user_role,
                            session_patient_id=session_patient_id,
                            session_uuid=session_uuid or "",
                            confirmed=False,          # LLM cannot auto-confirm writes
                            _verify_doctor_fn=verify_doctor_fn,
                        )
                    else:
                        tool_result = {
                            "status": "denied",
                            "error": "Tool execution unavailable in this context.",
                        }

                    executed_tool_calls.append({"name": tc.name, "result": tool_result})

                    # Append tool result to messages for next LLM turn
                    messages.append({
                        "role": "tool",
                        "tool_name": tc.name,
                        "tool_result": tool_result,
                    })

        # Max iterations reached — final call without tools
        logger.warning("LLM tool-calling loop hit MAX_TOOL_ITERATIONS=%d", MAX_TOOL_ITERATIONS)
        final_result: LLMChatResult = self._provider.chat(
            system_prompt=system_prompt
            + "\n\nPRODUCE FINAL STRUCTURED JSON RESPONSE NOW. No more tool calls.",
            messages=messages,
            tool_definitions=None,  # No more tools
        )
        if final_result.response_type == "text" and final_result.text:
            return self._parse_and_validate_response(
                final_result.text, matrix, history, message, lang, user_turn_count,
                executed_tool_calls=executed_tool_calls,
            )

        logger.warning("LLM failed to produce final response after tool loop — using fallback")
        return None

    # ── MESSAGE BUILDER ───────────────────────────────────────────────

    def _build_messages(
        self,
        message: str,
        matrix: Dict[str, Any],
        history: List[Dict[str, Any]],
        ehr: Dict[str, Any],
        user_turn_count: int,
        lang: str,
    ) -> List[Dict[str, Any]]:
        """
        Converts AuraHealth conversation history to provider-agnostic messages.

        The session DB (ChatSessionDB) is the source of truth for clinical state.
        The LLM receives recent history + current message as context.
        """
        messages: List[Dict[str, Any]] = []

        # Build recent history (last 6 turns, interleaved user/model)
        for hist_msg in history[-6:]:
            sender = hist_msg.get("sender", "")
            content = hist_msg.get("content", "")
            if not content:
                continue
            if sender in ("patient", "user", "doctor"):
                messages.append({"role": "user", "content": content})
            elif sender == "assistant":
                messages.append({"role": "model", "content": content})

        # Build the current user message with clinical context
        context_payload = {
            "current_clinical_matrix": matrix,
            "patient_ehr_summary": ehr,
            "user_turn_count": user_turn_count,
            "detected_language": lang,
        }
        current_user_content = (
            f"[CLINICAL CONTEXT]\n{json.dumps(context_payload, ensure_ascii=False)}\n\n"
            f"[PATIENT MESSAGE]\n{message}\n\n"
            f"Generate the next clinical turn as JSON per the schema."
        )
        messages.append({"role": "user", "content": current_user_content})
        return messages

    # ── RESPONSE PARSER & VALIDATOR ───────────────────────────────────

    def _parse_and_validate_response(
        self,
        text: str,
        matrix: Dict[str, Any],
        history: List[Dict[str, Any]],
        message: str,
        lang: str,
        user_turn_count: int,
        executed_tool_calls: Optional[List] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Parses LLM text as JSON and validates through LLMTriageResponse Pydantic schema.
        Applies premature-synthesis guard and evidence sanitizer.
        Returns None if parsing fails (triggers fallback).
        """
        # Strip markdown code fences if present
        raw = text.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
            raw = raw.rstrip("`").strip()

        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("LLM JSON parse error: %s | raw=%s", e, raw[:300])
            return None

        try:
            # Coerce recommended_departments strings → dicts before Pydantic validation
            # (LLM sometimes returns ["General Medicine"] instead of [{"department_name": ...}])
            raw_depts = parsed.get("recommended_departments", [])
            if raw_depts and isinstance(raw_depts[0], str):
                parsed["recommended_departments"] = [
                    {"department_name": d, "clinical_indication": "LLM-suggested department"}
                    for d in raw_depts
                ]

            validated = LLMTriageResponse(**parsed)
            res_dict = validated.model_dump()
        except (ValidationError, Exception) as e:
            logger.error("Pydantic validation error: %s", e)
            return None

        # Premature synthesis guard: do not synthesize on turn 1 with < 80% completeness
        completeness, missing = evaluate_clinical_matrix(matrix)
        if user_turn_count <= 1 and completeness < 0.80 and res_dict.get("state") == "SYNTHESIS":
            res_dict["state"] = "QUESTIONING"
            res_dict["needs_more_questions"] = True
            res_dict["possible_considerations"] = []
            res_dict["recommended_investigations"] = []
            res_dict["recommended_departments"] = []
            if not res_dict.get("next_question_axis"):
                res_dict["next_question_axis"] = missing[0] if missing else "associated_symptoms"

        # Prevent repeated questions (check if LLM's question is the same as last assistant Q)
        last_q = ""
        for m in reversed(history or []):
            if isinstance(m, dict) and m.get("sender") == "assistant":
                last_q = m.get("content", "")
                break
        if (
            res_dict.get("state") == "QUESTIONING"
            and last_q
            and res_dict.get("assistant_message", "").strip() == last_q.strip()
        ):
            # Rotate to the next missing axis question
            if missing:
                res_dict["next_question_axis"] = missing[0]
                if lang == "ar":
                    res_dict["assistant_message"] = (
                        "هل يمكنك إخباري بأي تفاصيل إضافية عن حالتك؟"
                    )
                else:
                    res_dict["assistant_message"] = (
                        "Can you share any additional details about your condition?"
                    )

        # Attach executed tool call metadata (for audit/transparency)
        if executed_tool_calls:
            res_dict["tool_calls"] = [
                {"name": tc["name"], "status": tc["result"].get("status", "unknown")}
                for tc in executed_tool_calls
            ]

        # Sanitize against hallucinated symptoms
        all_user_text = " ".join(
            m.get("content", "")
            for m in (history or [])
            if m.get("sender") in ("patient", "user", "doctor")
        ) + " " + message

        return sanitize_and_validate_evidence(res_dict, all_user_text, matrix, lang=lang)

    # ── EMERGENCY RESPONSE BUILDER ────────────────────────────────────

    def _emergency_response(
        self,
        directive: str,
        lang: str,
        category: str,
    ) -> Dict[str, Any]:
        return {
            "assistant_message": directive,
            "language": lang,
            "state": "EMERGENCY_LOCK",
            "clinical_updates": {},
            "information_completeness": 0.0,
            "needs_more_questions": False,
            "next_question_axis": None,
            "triage_urgency": "EMERGENCY",
            "possible_considerations": [],
            "recommended_investigations": [],
            "recommended_departments": [
                {"department_name": "Emergency Department",
                 "clinical_indication": category}
            ],
            "tool_calls": [],
            "safety_escalation": True,
            "disclaimer": directive,
            "provider_name": "safety_engine",
            "model_name": "deterministic",
        }

    # ── DETERMINISTIC FALLBACK (preserved exactly from prior session) ─

    def _safe_deterministic_fallback(
        self,
        message: str,
        matrix: Dict[str, Any],
        lang: str,
        ehr: Optional[Dict[str, Any]] = None,
        user_turn_count: int = 1,
        pre_extracted_updates: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic, safe reasoning fallback when LLM is unavailable.
        Never fabricates diagnoses, confidence, or unmentioned symptoms.
        Preserved exactly from the prior working implementation.
        """
        if pre_extracted_updates is not None:
            updates = pre_extracted_updates
        else:
            updated_matrix, updates = extract_clinical_facts(message, matrix, lang)
            matrix.clear()
            matrix.update(updated_matrix)

        # ── CONTEXT-AWARE NEGATIVE REPLY ──────────────────────────────
        # Detect a standalone negative answer ("لا", "no", "لا شي", "ماكو", "nothing") and
        # map it to the axis the previous assistant question was asking about.
        # This marks that axis as answered-negative (sentinel "none reported") so it is no
        # longer treated as missing — preventing both repeated questions and premature synthesis.
        _SIMPLE_NEGATIVES = {
            # English
            "no", "none", "nothing", "nope", "not really", "no i don't", "no i don't",
            "i don't", "i don't have any", "i have none", "i have no",
            # Arabic / Iraqi
            "لا", "لا شي", "لا شيء", "ماكو", "ما عندي", "لا يوجد", "لا أحمل", "لا آخذ",
            "ما اخذ", "ما عندي شي", "ما عندي أمراض", "لا ما عندي",
        }
        _msg_norm = message.strip("!.،؟?").strip().lower()
        _is_negative_reply = _msg_norm in _SIMPLE_NEGATIVES or (
            len(_msg_norm.split()) <= 4
            and any(_msg_norm.startswith(neg) for neg in ["no ", "لا ", "ماكو", "ما "])
            and not any(clinical in _msg_norm for clinical in [
                "pain", "ache", "fever", "cough", "وجع", "ألم", "حرارة", "سعال"
            ])
        )

        if _is_negative_reply and (conversation_history or []):
            # Find the last assistant message and its next_question_axis
            _last_axis = None
            _last_q_content = ""
            for _m in reversed(conversation_history or []):
                if isinstance(_m, dict) and _m.get("sender") == "assistant":
                    _last_q_content = _m.get("content", "").lower()
                    break

            # Determine which axis the last question was about from its content
            if any(k in _last_q_content for k in [
                "medication", "أدوية", "علاج", "دواء", "خافضات", "علاجات"
            ]):
                _last_axis = "medications"
            elif any(k in _last_q_content for k in [
                "chronic", "أمراض", "مزمن", "history", "سابق", "تاريخ"
            ]):
                _last_axis = "medical_history"
            elif any(k in _last_q_content for k in [
                "trigger", "cause", "happen before", "قبل", "سبب", "مجهود", "سقوط", "محفز"
            ]):
                _last_axis = "triggers"

            # Mark the identified axis as answered-negative if it was missing
            if _last_axis and not matrix.get(_last_axis):
                _sentinel = "لا شيء مذكور" if lang == "ar" else "none reported"
                matrix[_last_axis] = _sentinel
                updates[_last_axis] = _sentinel

        completeness, missing = evaluate_clinical_matrix(matrix)

        should_synthesize = (
            completeness >= 0.80
        ) or (
            completeness >= 0.60
            and matrix.get("chief_complaint")
            and matrix.get("onset")
            and (matrix.get("associated_symptoms") or matrix.get("medical_history") or matrix.get("medications"))
            and user_turn_count >= 3
            and not (_is_negative_reply and len(missing) >= 2)
        ) or (
            user_turn_count >= 5
            and matrix.get("chief_complaint")
        )


        # ── SYNTHESIS STATE ───────────────────────────────────────────
        if should_synthesize:
            depts = map_indications_to_departments(matrix)

            complaint_text = str(matrix.get("chief_complaint", "")).lower()
            syms_text = " ".join(matrix.get("associated_symptoms", [])).lower()
            all_symptoms_text = f"{complaint_text} {syms_text}"

            has_cough = any(w in all_symptoms_text for w in [
                "cough", "سعال", "كحة", "sputum", "بلغم", "phlegm", "breath", "تنفس"
            ])
            has_fever = any(w in all_symptoms_text for w in [
                "fever", "حرارة", "سخونة", "حمى"
            ])
            has_joint = any(w in all_symptoms_text for w in [
                "knee", "joint", "fall", "fracture", "رکبة", "ركبة", "مفصل",
                "سقوط", "عظم", "التواء", "كاحل", "قدم", "رجل"
            ])
            has_headache = any(w in all_symptoms_text for w in [
                "headache", "migraine", "صداع", "وجع راس"
            ])

            considerations = []
            investigations = []

            if has_fever and not has_cough:
                considerations = [
                    {
                        "condition": "حالة حمى حادة بحاجة لتقييم سريري" if lang == "ar" else "Acute Febrile Presentation for Clinical Evaluation",
                        "likelihood_tier": "Primary Consideration",
                        "clinical_rationale": (
                            "حمى حادة مترافقة مع شعور بالإرهاق، تتطلب قياساً ومراقبة لدرجة الحرارة وترطيباً كافياً وفحصاً سريرياً لتحديد السبب المحتمل."
                            if lang == "ar" else
                            "Reported acute onset of fever accompanied by fatigue, requiring clinical temperature monitoring, hydration, and physician evaluation to determine the underlying etiology."
                        )
                    },
                ]
                investigations = [
                    {
                        "investigation": "فحص صورة الدم الكاملة (CBC)" if lang == "ar" else "Complete Blood Count (CBC) with Differential",
                        "modality_type": "Laboratory",
                        "clinical_reason": "لتقييم علامات العدوى والالتهاب." if lang == "ar" else "To evaluate inflammatory and infectious markers."
                    },
                ]
            elif has_cough:
                considerations = [
                    {
                        "condition": "حالة أعراض تنفسية حادة بحاجة لتقييم" if lang == "ar" else "Acute Lower Respiratory Tract Presentation",
                        "likelihood_tier": "Primary Consideration",
                        "clinical_rationale": (
                            "وجود سعال مع أعراض مصاحبة يتطلب فحصاً سريرياً وسماع أصوات الصدر بالسماعة الطبية."
                            if lang == "ar" else
                            "Reported cough and accompanying symptoms warrant clinical auscultation and evaluation."
                        )
                    },
                ]
                investigations = [
                    {
                        "investigation": "أشعة الصدر السينية (PA View)" if lang == "ar" else "Chest X-Ray (PA View)",
                        "modality_type": "Radiographic Imaging",
                        "clinical_reason": "لتقييم سلامة الرئتين ونفي الارتشاح الرئوي." if lang == "ar" else "To rule out pulmonary infiltrates or consolidation."
                    },
                ]
            elif has_joint:
                considerations = [
                    {
                        "condition": "إصابة رضية حادة في الجهاز العضلي الهيكلي" if lang == "ar" else "Acute Traumatic Musculoskeletal / Ligamentous Strain",
                        "likelihood_tier": "Primary Consideration",
                        "clinical_rationale": "وجود ألم بالمفصل يتطلب فحصاً إشعاعياً لنفي الكسور." if lang == "ar" else "Reported joint discomfort warrants plain radiographic rule-out."
                    }
                ]
                investigations = [
                    {
                        "investigation": "أشعة سينية للمفصل" if lang == "ar" else "Plain Radiograph (Joint AP & Lateral)",
                        "modality_type": "Radiographic Imaging",
                        "clinical_reason": "لتقييم سلامة العظام والمفصل." if lang == "ar" else "To evaluate bony alignment and cortical integrity."
                    }
                ]
            elif has_headache:
                considerations = [
                    {
                        "condition": "صداع حاد بحاجة لمتابعة سريرية" if lang == "ar" else "Acute Cephalalgia for Clinical Evaluation",
                        "likelihood_tier": "Primary Consideration",
                        "clinical_rationale": "صداع حاد يستدعي قياس الضغط وتقييماً عصبياً أولياً." if lang == "ar" else "Reported headache warrants blood pressure and neurological vital signs verification."
                    }
                ]
                investigations = [
                    {
                        "investigation": "قياس ضغط الدم والفحص العصبي السريري" if lang == "ar" else "Blood Pressure & Neurological Physical Exam",
                        "modality_type": "Clinical Assessment",
                        "clinical_reason": "لتقييم المؤشرات الحيوية والعصبية." if lang == "ar" else "Baseline neurological and vital signs check."
                    }
                ]
            else:
                considerations = [
                    {
                        "condition": "تقييم سريري للأعراض المذكورة" if lang == "ar" else "Acute Symptomatic Presentation for Outpatient Workup",
                        "likelihood_tier": "Primary Consideration",
                        "clinical_rationale": "الأعراض المذكورة تتطلب تقييماً وفحصاً سريرياً مباشراً." if lang == "ar" else "Reported symptoms warrant clinical correlation with physical examination."
                    }
                ]
                investigations = [
                    {
                        "investigation": "فحص سريري واستقصائي عام" if lang == "ar" else "Comprehensive Clinical Outpatient Evaluation",
                        "modality_type": "Clinical Assessment",
                        "clinical_reason": "فحص العلامات الحيوية والفحص السريري العام." if lang == "ar" else "Baseline physical exam and vital signs verification."
                    }
                ]

            if lang == "ar":
                msg = (
                    "شكراً لتقديم هذه التفاصيل السريرية. قمت بتوثيق الأعراض وتحديد التخصص المناسب. "
                    "يرجى مراجعة التقييم المبدئي والفحوصات المقترحة أدناه لمناقشتها مع الطبيب."
                )
            else:
                msg = (
                    "Thank you for providing these clinical details. I have summarized your symptoms and matched them with the appropriate department. "
                    "Please review the preliminary considerations and suggested investigations below to discuss with your doctor."
                )

            res = {
                "assistant_message": msg,
                "language": lang,
                "state": "SYNTHESIS",
                "clinical_updates": updates,
                "information_completeness": completeness,
                "needs_more_questions": False,
                "next_question_axis": None,
                "triage_urgency": "MODERATE",
                "possible_considerations": considerations,
                "recommended_investigations": investigations,
                "recommended_departments": depts,
                "tool_calls": [],
                "safety_escalation": False,
                "disclaimer": (
                    "This assessment is for clinical decision support and triage guidance only. "
                    "It does not constitute a confirmed medical diagnosis. "
                    "Clinical correlation by a licensed physician is required."
                )
            }
            return sanitize_and_validate_evidence(res, message, matrix, lang=lang)

        # ── QUESTIONING STATE ─────────────────────────────────────────
        complaint_text = str(matrix.get("chief_complaint", "")).lower()
        has_fever = any(w in complaint_text for w in ["fever", "حرارة", "سخونة", "حمى"])

        _last_assistant_q = ""
        for _m in reversed(conversation_history or []):
            if isinstance(_m, dict) and _m.get("sender") == "assistant":
                _last_assistant_q = _m.get("content", "")
                break

        onset_is_missing = not matrix.get("onset")
        has_temp_recorded = any(
            k in str(matrix.get("onset", "")).lower()
            for k in ["temperature", "temp", "°c", "c", "حرارة", "المقاسة"]
        )

        q_text = None
        next_axis = None

        # ── GREETING RESPONSE (no clinical complaint yet) ─────────────────────
        # If the user hasn't provided any complaint yet and the current message is
        # a greeting or very short non-clinical input, respond warmly and ask what
        # symptoms they have — do NOT ask about onset.
        _GREETING_TOKENS = {
            "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
            "good day", "greetings", "howdy", "sup", "yo", "hi there", "hello there",
            "مرحبا", "السلام عليكم", "اهلا", "أهلا", "هلا", "هلو",
            "صباح الخير", "مساء الخير", "صباح النور", "مساء النور",
            "هاي", "ياهلا", "يا هلا", "تحياتي", "سلام",
        }
        _msg_stripped_lower = message.strip("!.،؟?").strip().lower()
        _is_greeting_msg = _msg_stripped_lower in _GREETING_TOKENS

        if not matrix.get("chief_complaint") and _is_greeting_msg:
            if lang == "ar":
                q_text = "أهلاً! شنو الأعراض اللي عندك، أو شنو الشي اللي تريد نحلله؟"
            else:
                q_text = "Hello! What symptoms are you experiencing, or what would you like us to help with?"
            next_axis = "chief_complaint"
            q_text = q_text if q_text not in _last_assistant_q else (
                "يرجى وصف شكواك الرئيسية — الأعراض، المنطقة المتأثرة، والمدة." if lang == "ar"
                else "Please describe your main concern — the symptoms, affected area, and how long they've been present."
            )
            return {
                "assistant_message": q_text,
                "language": lang,
                "state": "QUESTIONING",
                "clinical_updates": updates,
                "information_completeness": completeness,
                "needs_more_questions": True,
                "next_question_axis": next_axis,
                "triage_urgency": "ROUTINE",
                "possible_considerations": [],
                "recommended_investigations": [],
                "recommended_departments": [],
                "tool_calls": [],
                "safety_escalation": False,
                "disclaimer": None,
                "provider_name": "fallback",
                "model_name": "deterministic-fallback-v1",
            }

        if onset_is_missing and matrix.get("chief_complaint"):
            # Only ask about onset when we actually have a chief complaint to reference
            if has_fever:
                if lang == "ar":
                    q_text = "منذ متى بدأت الحرارة بالتحديد وهل قمت بقياسها؟ وهل تعاني من أي أعراض مرافقة مثل ألم الحلق، الصداع، القشعريرة، أو آلام بالجسم؟"
                else:
                    q_text = "When did the fever start exactly, and what is your temperature right now? Also, are you experiencing any other symptoms such as cough, sore throat, headache, or chills?"
            else:
                if lang == "ar":
                    q_text = "من شوكت تقريباً بدأت هذه الأعراض، وهل ظهرت فجأة لو بالتدريج؟"
                else:
                    q_text = "Approximately when did these symptoms start, and did they begin suddenly or gradually?"
            next_axis = "onset"
        elif onset_is_missing and not matrix.get("chief_complaint"):
            # No complaint yet and not caught as a greeting above — ask for complaint first
            if lang == "ar":
                q_text = "يرجى وصف الأعراض التي تعاني منها — ما هي وأين تشعر بها؟"
            else:
                q_text = "Please describe the symptoms you're experiencing — what are they and where do you feel them?"
            next_axis = "chief_complaint"


        elif has_fever and not has_temp_recorded:
            if lang == "ar":
                q_text = "هل قمت بقياس درجة حرارتك؟ وهل تعاني من أي أعراض مرافقة مثل ألم الحلق، الصداع، القشعريرة، أو آلام بالجسم؟"
            else:
                q_text = "Have you measured your temperature? Also, are you experiencing any other symptoms such as sore throat, headache, or chills?"
            next_axis = "associated_symptoms"
        elif "medical_history" in missing or "medications" in missing:
            if lang == "ar":
                q_text = "هل تتناول أي أدوية حالياً (مثل خافضات الحرارة أو علاجات منتظمة)، وهل تعاني من أي أمراض مزمنة سابقة؟"
            else:
                q_text = "Are you currently taking any prescription medications or treatments regularly, and do you have any existing chronic medical conditions?"
            next_axis = "medications" if "medications" in missing else "medical_history"
        elif "triggers" in missing:
            if lang == "ar":
                q_text = "هل حدث أي أمر أو نشاط معين قبل أن تبدأ الأعراض مباشرة (مثل مجهود بدني، تعرض لبرد، أو سقوط)؟"
            else:
                q_text = "Did anything specific trigger or happen right before these symptoms started (such as physical exertion or cold exposure)?"
            next_axis = "triggers"
        else:
            next_axis = missing[0] if missing else "associated_symptoms"
            if lang == "ar":
                q_text = "هل هناك أي تفاصيل أو أعراض إضافية أخرى تود ذكرها للطبيب؟"
            else:
                q_text = "Are there any other accompanying symptoms or details you would like to mention for the clinician?"

        # Prevent exact repetition of last assistant question
        if q_text and _last_assistant_q and q_text.strip() == _last_assistant_q.strip():
            if "medical_history" in missing or "medications" in missing:
                if lang == "ar":
                    q_text = "هل تتناول أي أدوية حالياً وهل عندك أمراض مزمنة؟"
                else:
                    q_text = "Are you taking any medications regularly, and do you have any chronic conditions?"
                next_axis = "medications"
            else:
                if lang == "ar":
                    q_text = "هل هناك أي تفاصيل أو أعراض إضافية أخرى تود ذكرها للطبيب؟"
                else:
                    q_text = "Are there any other symptoms or details you'd like to add?"
                next_axis = missing[0] if missing else "associated_symptoms"

        return {
            "assistant_message": q_text,
            "language": lang,
            "state": "QUESTIONING",
            "clinical_updates": updates,
            "information_completeness": completeness,
            "needs_more_questions": True,
            "next_question_axis": next_axis,
            "triage_urgency": "ROUTINE",
            "possible_considerations": [],
            "recommended_investigations": [],
            "recommended_departments": [],
            "tool_calls": [],
            "safety_escalation": False,
            "disclaimer": (
                "Clinical intake in progress. A complete clinical assessment requires licensed physician evaluation."
            )
        }

    # ── SPECIALIZED FINDING INGESTION (unchanged) ─────────────────────

    def re_evaluate_with_specialized_finding(
        self,
        session_matrix: Dict[str, Any],
        record: Any,
        lang: str,
    ) -> Dict[str, Any]:
        """
        Re-synthesizes the case after ingesting an objective AI finding.
        Preserves original model confidence; never invents confidence.
        """
        model_name = getattr(record, "model_name", "Specialized Diagnostic Model")
        confidence = getattr(record, "confidence", None)
        dept = getattr(record, "department", "Specialized Department")
        status_level = getattr(record, "status_level", "EVALUATED")
        record_type = getattr(record, "record_type", "Diagnostic Assessment")

        if confidence is not None:
            if confidence <= 1.0:
                conf_str = f" (Model confidence: {confidence * 100:.1f}%)"
            else:
                conf_str = f" (Model confidence: {confidence:.1f}%)"
        else:
            conf_str = ""

        if lang == "ar":
            msg = (
                f"تم استلام نتيجة تحليل الذكاء الاصطناعي الموضوعية من قسم {dept} "
                f"(النموذج: {model_name}{conf_str}). تم دمج النتيجة السريرية ({record_type} - {status_level}) "
                f"ضمن التقييم السريري الشامل. يُنصح بمطابقة النتيجة سريرياً بواسطة الطبيب المختص."
            )
        else:
            msg = (
                f"Objective AI finding received from {dept} "
                f"(Model: {model_name}{conf_str}). The finding ({record_type} - {status_level}) "
                f"has been incorporated into the overall assessment. "
                f"Clinical correlation by the treating physician is recommended."
            )

        return {
            "assistant_message": msg,
            "language": lang,
            "state": "SYNTHESIS",
            "model_confidence": confidence,
            "triage_urgency": "MODERATE",
            "re_evaluated": True,
            "provider_name": self.provider_name,
            "model_name": self.model_name,
            "disclaimer": (
                "Specialized AI analysis provides clinical decision support. "
                "Final diagnostic interpretation rests with the physician."
            ),
        }
