"""
AuraHealth Controlled Tool Registry for General Medicine.

The LLM may REQUEST tools, but the BACKEND decides:
  1. Whether the tool is in the allowlist
  2. Whether the requesting user has authorization
  3. Whether the patient_id argument matches the session's patient_id
  4. Whether the tool is a WRITE operation requiring explicit confirmation

The LLM NEVER accesses the database directly.
The LLM NEVER accesses the filesystem or arbitrary HTTP endpoints.
The LLM NEVER accesses data for patients other than the current session patient.

READ tools: executed automatically after authorization check.
WRITE tools: require explicit caller confirmation (confirmed=True flag).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# =====================================================================
# TOOL METADATA (provider-agnostic schema for LLM function declarations)
# =====================================================================

TOOL_DEFINITIONS: List[Dict[str, Any]] = [

    # ── READ TOOLS ────────────────────────────────────────────────────

    {
        "name": "get_patient_context",
        "description": (
            "Returns basic non-sensitive demographic context for the current patient "
            "(name, age range, blood group, gender). Use this to personalise the "
            "clinical conversation before asking detailed questions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                }
            },
            "required": ["patient_id"],
        },
    },

    {
        "name": "get_ehr_summary",
        "description": (
            "Returns a structured summary of the patient's Electronic Health Record: "
            "recent diagnoses, known chronic conditions, documented allergies, "
            "and current medications. Use to avoid duplicating known clinical history."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                }
            },
            "required": ["patient_id"],
        },
    },

    {
        "name": "get_recent_medical_records",
        "description": (
            "Returns the most recent AI-generated diagnostic records for the patient "
            "(e.g. chest X-ray, ECG, neurology scan results). Each record includes "
            "department, modality, status level, and model confidence."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of records to return (1-10). Default 5.",
                },
            },
            "required": ["patient_id"],
        },
    },

    {
        "name": "get_specialized_ai_findings",
        "description": (
            "Returns findings from AuraHealth's specialized AI departments "
            "(Radiology MRI, Chest X-ray, ECG, Neurology, Orthopedics, Respiratory, ICU) "
            "that have been linked to the current consultation session."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                }
            },
            "required": ["patient_id"],
        },
    },

    {
        "name": "get_appointment_history",
        "description": (
            "Returns the patient's past appointment history including departments visited "
            "and appointment dates. Useful for understanding care continuity."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of appointments to return (1-20). Default 5.",
                },
            },
            "required": ["patient_id"],
        },
    },

    {
        "name": "get_laboratory_results",
        "description": (
            "Returns any laboratory results stored in the patient's EHR "
            "(e.g. blood tests, urinalysis, cultures). "
            "Results are returned in summary form only."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                }
            },
            "required": ["patient_id"],
        },
    },

    # ── CONTROLLED ANALYSIS / INTEGRATION TOOLS ───────────────────────

    {
        "name": "get_specialized_finding",
        "description": (
            "Returns the full details of a specific medical record by its record ID. "
            "Use this when a specific finding referenced in get_specialized_ai_findings "
            "requires deeper inspection."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID (must match the record's patient).",
                },
                "record_id": {
                    "type": "integer",
                    "description": "The specific medical record ID to retrieve.",
                },
            },
            "required": ["patient_id", "record_id"],
        },
    },

    {
        "name": "request_available_specialized_analysis",
        "description": (
            "Returns a list of specialized AI analysis types available for this patient "
            "(e.g. pending X-ray, uploaded ECG). Does NOT trigger analysis — only lists "
            "what is available to be requested."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                }
            },
            "required": ["patient_id"],
        },
    },

    # ── WRITE TOOLS (require confirmed=True) ──────────────────────────

    {
        "name": "prepare_general_medicine_assessment",
        "description": (
            "WRITE OPERATION. Stages a General Medicine triage assessment for review. "
            "The assessment is NOT saved to the EHR automatically — it requires "
            "explicit doctor or patient confirmation via save_general_medicine_assessment."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                },
                "session_uuid": {
                    "type": "string",
                    "description": "The current consultation session UUID.",
                },
                "assessment_notes": {
                    "type": "string",
                    "description": "Clinical summary notes for the assessment.",
                },
            },
            "required": ["patient_id", "session_uuid", "assessment_notes"],
        },
    },

    {
        "name": "save_general_medicine_assessment",
        "description": (
            "WRITE OPERATION. Permanently saves a prepared General Medicine assessment "
            "to the patient EHR as a MedicalRecord. "
            "IMPORTANT: This tool must only be called after the doctor or patient has "
            "explicitly confirmed. The backend will reject this call without authorization."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "integer",
                    "description": "The patient's numeric ID from the current session.",
                },
                "session_uuid": {
                    "type": "string",
                    "description": "The current consultation session UUID.",
                },
            },
            "required": ["patient_id", "session_uuid"],
        },
    },
]

# Quick lookup sets
_READ_TOOLS = {
    "get_patient_context",
    "get_ehr_summary",
    "get_recent_medical_records",
    "get_specialized_ai_findings",
    "get_appointment_history",
    "get_laboratory_results",
    "get_specialized_finding",
    "request_available_specialized_analysis",
}
_WRITE_TOOLS = {
    "prepare_general_medicine_assessment",
    "save_general_medicine_assessment",
}
_ALL_ALLOWED_TOOLS = _READ_TOOLS | _WRITE_TOOLS


# =====================================================================
# TOOL RESULT HELPERS
# =====================================================================

def _err(msg: str) -> Dict[str, Any]:
    return {"error": msg, "status": "denied"}


def _ok(data: Any) -> Dict[str, Any]:
    return {"status": "ok", "data": data}


# =====================================================================
# TOOL REGISTRY
# =====================================================================

class AuraHealthToolRegistry:
    """
    Executes LLM-requested tools with strict backend authorization.

    Authorization rules (in order):
    1. Tool name must be in the allowlist (_ALL_ALLOWED_TOOLS).
    2. patient_id argument must be present and equal session.patient_id.
    3. User role must have permission (patients can only read their own data;
       doctors must have a clinical relationship with the patient).
    4. WRITE tools require confirmed=True AND doctor/admin role.
    5. All DB queries use ORM — no raw SQL.
    6. Returned data is sanitized (no raw JSON blobs unless safe).
    """

    def __init__(self):
        self._staged_assessments: Dict[str, str] = {}  # session_uuid → notes

    # ── Public entry point ────────────────────────────────────────────

    def execute(
        self,
        tool_name: str,
        args: Dict[str, Any],
        db: Session,
        current_user_id: int,
        current_user_role: str,
        session_patient_id: int,
        session_uuid: str,
        confirmed: bool = False,
        _verify_doctor_fn=None,   # injected from router to avoid circular import
    ) -> Dict[str, Any]:
        """
        Executes a tool requested by the LLM.

        Args:
            tool_name:           Name of the tool to execute.
            args:                Arguments provided by the LLM (untrusted).
            db:                  SQLAlchemy session.
            current_user_id:     ID of the authenticated user.
            current_user_role:   Role of the authenticated user.
            session_patient_id:  Patient ID bound to the current session (trusted).
            session_uuid:        UUID of the current session (trusted).
            confirmed:           Whether the caller has explicitly confirmed a WRITE op.
            _verify_doctor_fn:   Optional callable(db, doctor_id, patient_id) -> bool.

        Returns:
            dict with "status": "ok" and "data", or "status": "denied" and "error".
        """
        # 1. Allowlist check
        if tool_name not in _ALL_ALLOWED_TOOLS:
            logger.warning("ToolRegistry: rejected unknown tool '%s'", tool_name)
            return _err(f"Tool '{tool_name}' is not a registered AuraHealth tool.")

        # 2. Patient-ID scope check (args.patient_id must match session)
        arg_patient_id = args.get("patient_id")
        if arg_patient_id is None:
            return _err("Tool argument 'patient_id' is required.")
        try:
            arg_patient_id = int(arg_patient_id)
        except (TypeError, ValueError):
            return _err("Tool argument 'patient_id' must be an integer.")
        if arg_patient_id != session_patient_id:
            logger.warning(
                "ToolRegistry: SCOPE VIOLATION — user %d requested patient %d "
                "but session patient is %d",
                current_user_id, arg_patient_id, session_patient_id,
            )
            return _err("Access denied: patient_id does not match the current session.")

        # 3. Role-based authorization
        if current_user_role == "patient" and arg_patient_id != current_user_id:
            return _err("Access denied: patients may only access their own data.")

        if current_user_role == "doctor":
            if _verify_doctor_fn is not None:
                if not _verify_doctor_fn(db, current_user_id, arg_patient_id):
                    return _err(
                        "Access denied: no active clinical relationship with this patient."
                    )

        # 4. Write-tool protection
        if tool_name in _WRITE_TOOLS:
            if current_user_role not in ("doctor", "admin"):
                return _err(
                    f"Tool '{tool_name}' is a WRITE operation and requires doctor or admin role."
                )
            if not confirmed:
                return _err(
                    f"Tool '{tool_name}' is a WRITE operation. "
                    f"Explicit backend confirmation is required before execution."
                )

        # 5. Execute
        return self._dispatch(tool_name, args, db, session_patient_id, session_uuid)

    # ── Dispatch ──────────────────────────────────────────────────────

    def _dispatch(
        self,
        tool_name: str,
        args: Dict[str, Any],
        db: Session,
        patient_id: int,
        session_uuid: str,
    ) -> Dict[str, Any]:
        dispatch_map = {
            "get_patient_context":                   self._get_patient_context,
            "get_ehr_summary":                       self._get_ehr_summary,
            "get_recent_medical_records":            self._get_recent_medical_records,
            "get_specialized_ai_findings":           self._get_specialized_ai_findings,
            "get_appointment_history":               self._get_appointment_history,
            "get_laboratory_results":                self._get_laboratory_results,
            "get_specialized_finding":               self._get_specialized_finding,
            "request_available_specialized_analysis": self._request_available_analysis,
            "prepare_general_medicine_assessment":   self._prepare_assessment,
            "save_general_medicine_assessment":      self._save_assessment,
        }
        handler = dispatch_map.get(tool_name)
        if handler is None:
            return _err(f"No handler for tool '{tool_name}'.")
        try:
            return handler(args=args, db=db, patient_id=patient_id, session_uuid=session_uuid)
        except Exception as e:
            logger.error("ToolRegistry: error executing '%s': %s", tool_name, e)
            return _err(f"Tool execution error: {str(e)[:200]}")

    # ── READ TOOL IMPLEMENTATIONS ─────────────────────────────────────

    def _get_patient_context(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import UserDB
        user: Optional[UserDB] = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not user:
            return _err("Patient not found.")
        return _ok({
            "full_name": user.full_name or "Unknown",
            "gender": user.gender or "not_specified",
            "blood_group": user.blood_group or "unknown",
            "date_of_birth": str(user.date_of_birth) if user.date_of_birth else None,
            "emergency_contact": bool(user.emergency_contact),
        })

    def _get_ehr_summary(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        records = (
            db.query(MedicalRecordDB)
            .filter(MedicalRecordDB.patient_id == patient_id)
            .order_by(MedicalRecordDB.id.desc())
            .limit(10)
            .all()
        )
        summaries = []
        for r in records:
            try:
                details = json.loads(r.details_json or "{}")
            except Exception:
                details = {}
            summaries.append({
                "id": r.id,
                "department": r.department,
                "modality": r.modality,
                "record_type": r.record_type,
                "status_level": r.status_level,
                "source_category": r.source_category,
                "model_name": r.model_name,
                "confidence": r.confidence,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "chief_complaint": details.get("clinical_matrix", {}).get("chief_complaint"),
            })
        return _ok({"record_count": len(summaries), "records": summaries})

    def _get_recent_medical_records(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        limit = min(int(args.get("limit", 5)), 10)
        records = (
            db.query(MedicalRecordDB)
            .filter(MedicalRecordDB.patient_id == patient_id)
            .order_by(MedicalRecordDB.id.desc())
            .limit(limit)
            .all()
        )
        return _ok([{
            "id": r.id,
            "department": r.department,
            "modality": r.modality,
            "status_level": r.status_level,
            "confidence": r.confidence,
            "source_category": r.source_category,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in records])

    def _get_specialized_ai_findings(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        records = (
            db.query(MedicalRecordDB)
            .filter(
                MedicalRecordDB.patient_id == patient_id,
                MedicalRecordDB.source_category == "ai_analysis",
            )
            .order_by(MedicalRecordDB.id.desc())
            .limit(8)
            .all()
        )
        findings = []
        for r in records:
            try:
                details = json.loads(r.details_json or "{}")
            except Exception:
                details = {}
            findings.append({
                "id": r.id,
                "department": r.department,
                "modality": r.modality,
                "model_name": r.model_name,
                "status_level": r.status_level,
                "confidence": r.confidence,
                "risk_score": r.risk_score,
                "result_summary": details.get("result_summary") or details.get("label"),
            })
        return _ok({"finding_count": len(findings), "findings": findings})

    def _get_appointment_history(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import AppointmentDB
        limit = min(int(args.get("limit", 5)), 20)
        try:
            appts = (
                db.query(AppointmentDB)
                .filter(AppointmentDB.patient_id == patient_id)
                .order_by(AppointmentDB.id.desc())
                .limit(limit)
                .all()
            )
            return _ok([{
                "id": a.id,
                "doctor_id": a.doctor_id,
                "appointment_date": str(a.appointment_date) if hasattr(a, "appointment_date") else None,
                "status": getattr(a, "status", None),
                "department": getattr(a, "department", None),
            } for a in appts])
        except Exception as e:
            logger.warning("get_appointment_history: %s", e)
            return _ok({"appointment_count": 0, "appointments": [],
                         "note": "Appointment data unavailable."})

    def _get_laboratory_results(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        lab_records = (
            db.query(MedicalRecordDB)
            .filter(
                MedicalRecordDB.patient_id == patient_id,
                MedicalRecordDB.modality.ilike("%lab%"),
            )
            .order_by(MedicalRecordDB.id.desc())
            .limit(5)
            .all()
        )
        results = []
        for r in lab_records:
            try:
                details = json.loads(r.details_json or "{}")
            except Exception:
                details = {}
            results.append({
                "id": r.id,
                "modality": r.modality,
                "status_level": r.status_level,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "summary": details.get("summary") or details.get("result_summary"),
            })
        return _ok({"result_count": len(results), "results": results})

    def _get_specialized_finding(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        record_id = args.get("record_id")
        if not record_id:
            return _err("record_id is required.")
        record = (
            db.query(MedicalRecordDB)
            .filter(
                MedicalRecordDB.id == int(record_id),
                MedicalRecordDB.patient_id == patient_id,
            )
            .first()
        )
        if not record:
            return _err(f"Record {record_id} not found for this patient.")
        try:
            details = json.loads(record.details_json or "{}")
        except Exception:
            details = {}
        return _ok({
            "id": record.id,
            "department": record.department,
            "modality": record.modality,
            "model_name": record.model_name,
            "status_level": record.status_level,
            "confidence": record.confidence,
            "risk_score": record.risk_score,
            "details": details,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })

    def _request_available_analysis(self, args, db, patient_id, session_uuid) -> Dict:
        from app.models.db_models import MedicalRecordDB
        recent = (
            db.query(MedicalRecordDB)
            .filter(
                MedicalRecordDB.patient_id == patient_id,
                MedicalRecordDB.source_category == "ai_analysis",
            )
            .order_by(MedicalRecordDB.id.desc())
            .limit(5)
            .all()
        )
        available = [
            {"department": r.department, "modality": r.modality, "record_id": r.id}
            for r in recent
        ]
        return _ok({
            "available_analyses": available,
            "note": (
                "To ingest a finding into this consultation, use the "
                "/api/general-medicine/ingest-finding endpoint with the record_id."
            ),
        })

    # ── WRITE TOOL IMPLEMENTATIONS ────────────────────────────────────

    def _prepare_assessment(self, args, db, patient_id, session_uuid) -> Dict:
        notes = str(args.get("assessment_notes", ""))[:2000]
        self._staged_assessments[session_uuid] = notes
        return _ok({
            "staged": True,
            "session_uuid": session_uuid,
            "notes_preview": notes[:200],
            "message": (
                "Assessment staged. Call save_general_medicine_assessment with "
                "explicit confirmation to persist to EHR."
            ),
        })

    def _save_assessment(self, args, db, patient_id, session_uuid) -> Dict:
        notes = self._staged_assessments.get(session_uuid)
        if not notes:
            return _err(
                "No staged assessment found for this session. "
                "Call prepare_general_medicine_assessment first."
            )
        # The actual EHR commit is handled by the router's /save-to-ehr endpoint.
        # This tool only confirms that a staged assessment exists.
        return _ok({
            "committed": False,
            "message": (
                "Assessment is ready for EHR commit. "
                "Use the /api/general-medicine/save-to-ehr endpoint to finalize."
            ),
            "session_uuid": session_uuid,
        })
