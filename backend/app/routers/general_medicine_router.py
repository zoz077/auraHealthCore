"""
FastAPI Router for General Medicine & Medical Chatbot.
Endpoints:
1. POST /api/general-medicine/session
2. POST /api/general-medicine/chat
3. POST /api/general-medicine/ingest-finding (Strict same-patient verification)
4. POST /api/general-medicine/doctor-consult (Authorized doctor relationship check)
5. POST /api/general-medicine/save-to-ehr (Non-destructive MedicalRecordDB commit)
6. GET  /api/general-medicine/sessions/{patient_id}
7. GET  /api/general-medicine/session/{session_uuid}
8. GET  /api/general-medicine/active-session/{patient_id}
"""
import uuid
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.db_models import (
    UserDB,
    ChatSessionDB,
    ChatMessageDB,
    MedicalRecordDB,
    AuditLogDB,
    AppointmentDB
)
from app.services.general_medicine_service import GeneralMedicineService
from app.services.triage_rules import create_empty_clinical_matrix

router = APIRouter(prefix="/api/general-medicine", tags=["General Medicine"])
gm_service = GeneralMedicineService()

# Direct Authentication Dependency: invokes the real get_current_user from app.main
def get_current_user(request: Request, db: Session = Depends(get_db)) -> UserDB:
    from app.main import get_current_user as real_auth
    return real_auth(request, db)

# Helper: verify clinical relationship between doctor and patient
def verify_doctor_patient_relationship(db: Session, doctor_id: int, patient_id: int) -> bool:
    has_rel = db.query(AppointmentDB).filter(
        AppointmentDB.doctor_id == doctor_id,
        AppointmentDB.patient_id == patient_id
    ).first() or db.query(MedicalRecordDB).filter(
        MedicalRecordDB.doctor_id == doctor_id,
        MedicalRecordDB.patient_id == patient_id
    ).first()
    return bool(has_rel)


# Request Payloads
class SessionCreatePayload(BaseModel):
    patient_id: Optional[int] = None
    language: Optional[str] = "en"

class ChatMessagePayload(BaseModel):
    session_uuid: str
    message: str

class IngestFindingPayload(BaseModel):
    session_uuid: str
    record_id: int

class DoctorConsultPayload(BaseModel):
    patient_id: int
    query: str

class SaveToEhrPayload(BaseModel):
    session_uuid: str


# =====================================================================
# 1. CREATE OR GET SESSION
# =====================================================================
@router.post("/session")
def create_or_get_session(
    payload: SessionCreatePayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if current_user.role == "patient":
        target_patient_id = current_user.id
        doc_id = None
    elif current_user.role in ["doctor", "admin"]:
        if not payload.patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required for clinical consultation.")
        target_patient_id = payload.patient_id
        doc_id = current_user.id
        if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, target_patient_id):
            raise HTTPException(status_code=403, detail="Unauthorized: No active clinical relationship with this patient.")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role.")

    session_uuid = f"gm_{uuid.uuid4().hex[:12]}"
    new_session = ChatSessionDB(
        session_uuid=session_uuid,
        patient_id=target_patient_id,
        doctor_id=doc_id,
        language=payload.language or "en",
        current_state="INIT",
        triage_urgency="ROUTINE",
        information_completeness=0.0,
        clinical_matrix_json=json.dumps(create_empty_clinical_matrix()),
        assessment_json="{}",
        linked_record_ids_json="[]"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    welcome_text = (
        "شنو الأعراض اللي تشعر بيها، أو شنو الشي اللي تريد نحلله؟"
        if new_session.language == "ar"
        else "What symptoms do you have or what would you like us to analyze?"
    )
    welcome_msg = ChatMessageDB(
        session_id=new_session.id,
        sender="assistant",
        language=new_session.language,
        content=welcome_text,
        data_provenance="DOCTOR_PROVIDED" if doc_id else "PATIENT_REPORTED"
    )
    db.add(welcome_msg)
    db.commit()

    return {
        "session_uuid": new_session.session_uuid,
        "patient_id": new_session.patient_id,
        "doctor_id": new_session.doctor_id,
        "language": new_session.language,
        "current_state": new_session.current_state,
        "welcome_message": welcome_text
    }


# =====================================================================
# 2. CHAT MESSAGE INTERACTION
# =====================================================================
@router.post("/chat")
def process_chat_message(
    payload: ChatMessagePayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    session = db.query(ChatSessionDB).filter(ChatSessionDB.session_uuid == payload.session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Consultation session not found.")

    # Patient isolation
    if current_user.role == "patient" and session.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot access another patient's consultation.")

    # Doctor authorization check
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, session.patient_id):
        raise HTTPException(status_code=403, detail="Forbidden: Unassigned doctor cannot access this patient.")

    # If already in EMERGENCY_LOCK, enforce safety lock
    if session.current_state == "EMERGENCY_LOCK":
        from app.services.triage_rules import get_iraq_emergency_directive
        directive = get_iraq_emergency_directive(session.language)
        return {
            "session_uuid": session.session_uuid,
            "assistant_message": directive,
            "language": session.language,
            "state": "EMERGENCY_LOCK",
            "triage_urgency": "EMERGENCY",
            "information_completeness": session.information_completeness,
            "needs_more_questions": False,
            "clinical_matrix": json.loads(session.clinical_matrix_json or "{}"),
            "disclaimer": directive
        }

    # Save user message
    user_msg = ChatMessageDB(
        session_id=session.id,
        sender=current_user.role,
        language=session.language,
        content=payload.message,
        data_provenance="PATIENT_REPORTED" if current_user.role == "patient" else "DOCTOR_PROVIDED"
    )
    db.add(user_msg)
    db.commit()

    # Load matrix and history
    matrix = json.loads(session.clinical_matrix_json or "{}")
    session_msgs = db.query(ChatMessageDB).filter(ChatMessageDB.session_id == session.id).order_by(ChatMessageDB.timestamp.asc()).all()
    history = [
        {"sender": m.sender, "content": m.content}
        for m in session_msgs[-6:]
    ]

    # Gather grounded EHR for patient
    ehr_records = db.query(MedicalRecordDB).filter(MedicalRecordDB.patient_id == session.patient_id).order_by(MedicalRecordDB.id.desc()).limit(5).all()
    grounded_ehr = {
        "recent_records": [
            {
                "id": r.id,
                "department": r.department,
                "modality": r.modality,
                "status_level": r.status_level,
                "confidence": r.confidence,
                "source_category": r.source_category
            }
            for r in ehr_records
        ]
    }

    result = gm_service.process_patient_turn(
        message=payload.message,
        current_matrix=matrix,
        conversation_history=history,
        grounded_ehr=grounded_ehr,
        # Tool execution context
        db=db,
        current_user_id=current_user.id,
        current_user_role=current_user.role,
        session_patient_id=session.patient_id,
        session_uuid=session.session_uuid,
        verify_doctor_fn=verify_doctor_patient_relationship,
    )

    # Update session — persist new state and matrix
    session.current_state = result.get("state", "QUESTIONING")
    session.language = result.get("language", session.language)
    session.triage_urgency = result.get("triage_urgency", session.triage_urgency)
    session.information_completeness = result.get("information_completeness", session.information_completeness)
    session.clinical_matrix_json = json.dumps(matrix)
    session.assessment_json = json.dumps(result)
    db.commit()

    # Save assistant message
    assistant_msg = ChatMessageDB(
        session_id=session.id,
        sender="assistant",
        language=session.language,
        content=result.get("assistant_message", ""),
        data_provenance="PATIENT_REPORTED"
    )
    db.add(assistant_msg)
    db.commit()

    # Compose provider/model string for audit records
    provider_label = (
        f"{result.get('provider_name', 'unknown')}/"
        f"{result.get('model_name', 'unknown')}"
    )

    # Log key events to AuditLogDB
    if session.current_state in ["EMERGENCY_LOCK", "SYNTHESIS"]:
        audit = AuditLogDB(
            user_id=current_user.id,
            patient_id=session.patient_id,
            action="EMERGENCY_LOCK_TRIGGERED" if session.current_state == "EMERGENCY_LOCK" else "TRIAGE_SYNTHESIS",
            department="General Medicine",
            modality="Clinical Consultation & Triage",
            model_name=f"AuraHealth GM Engine [{provider_label}]",
            result_summary=f"State: {session.current_state} | Urgency: {session.triage_urgency} | Completeness: {session.information_completeness:.2f}",
        )
        db.add(audit)
        db.commit()

    return {
        "session_uuid": session.session_uuid,
        "assistant_message": result.get("assistant_message"),
        "language": session.language,
        "state": session.current_state,
        "triage_urgency": session.triage_urgency,
        "information_completeness": session.information_completeness,
        "needs_more_questions": result.get("needs_more_questions", True),
        "clinical_matrix": matrix,
        "possible_considerations": result.get("possible_considerations", []),
        "recommended_investigations": result.get("recommended_investigations", []),
        "recommended_departments": result.get("recommended_departments", []),
        "tool_calls": result.get("tool_calls", []),
        "disclaimer": result.get("disclaimer"),
        "provider_name": result.get("provider_name"),
        "model_name": result.get("model_name"),
    }



# =====================================================================
# 3. INGEST SPECIALIZED AI FINDING (STRICT SAME-PATIENT VALIDATION)
# =====================================================================
@router.post("/ingest-finding")
def ingest_specialized_finding(
    payload: IngestFindingPayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    session = db.query(ChatSessionDB).filter(ChatSessionDB.session_uuid == payload.session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Consultation session not found.")

    record = db.query(MedicalRecordDB).filter(MedicalRecordDB.id == payload.record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    # MANDATORY PATIENT MATCHING CHECK: Reject cross-patient contamination
    if session.patient_id != record.patient_id:
        raise HTTPException(
            status_code=400,
            detail="Security Violation: The medical record does not belong to the patient in this consultation session."
        )

    # Authorization verification
    if current_user.role == "patient" and session.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, session.patient_id):
        raise HTTPException(status_code=403, detail="Forbidden.")

    # Attach record ID to session
    linked = json.loads(session.linked_record_ids_json or "[]")
    if record.id not in linked:
        linked.append(record.id)
        session.linked_record_ids_json = json.dumps(linked)

    matrix = json.loads(session.clinical_matrix_json or "{}")
    re_eval = gm_service.re_evaluate_with_specialized_finding(matrix, record, session.language)

    assessment = json.loads(session.assessment_json or "{}")
    assessment["last_ingested_finding"] = {
        "record_id": record.id,
        "department": record.department,
        "model_name": record.model_name,
        "confidence": record.confidence,
        "status_level": record.status_level
    }
    session.assessment_json = json.dumps(assessment)
    session.current_state = "SYNTHESIS"
    db.commit()

    # Save Assistant message noting the ingestion
    ingest_msg = ChatMessageDB(
        session_id=session.id,
        sender="assistant",
        language=session.language,
        content=re_eval["assistant_message"],
        data_provenance="NEW_AI_ANALYSIS"
    )
    db.add(ingest_msg)
    db.commit()

    # Audit Log
    audit = AuditLogDB(
        user_id=current_user.id,
        patient_id=session.patient_id,
        action="AI_FINDING_INGESTED",
        department="General Medicine",
        modality=record.modality or "Diagnostic AI",
        model_name=record.model_name or "Specialized Model",
        result_summary=f"Ingested {record.department} #{record.id} (Confidence: {record.confidence})",
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "session_uuid": session.session_uuid,
        "assistant_message": re_eval["assistant_message"],
        "model_confidence": re_eval.get("model_confidence"),
        "linked_record_ids": linked
    }


# =====================================================================
# 4. DOCTOR CLINICAL CONSULTATION
# =====================================================================
@router.post("/doctor-consult")
def doctor_clinical_consult(
    payload: DoctorConsultPayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Doctor or Admin authority required.")

    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Unauthorized: No active clinical relationship with this patient.")

    # Load patient context
    patient = db.query(UserDB).filter(UserDB.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    records = db.query(MedicalRecordDB).filter(MedicalRecordDB.patient_id == payload.patient_id).order_by(MedicalRecordDB.id.desc()).limit(10).all()
    
    context_summary = f"Patient: {patient.full_name}, Age: {patient.date_of_birth or 'N/A'}, Blood Group: {patient.blood_group or 'N/A'}.\n"
    context_summary += "Recent Diagnostic Records:\n"
    for r in records:
        context_summary += f"- [{r.department}] {r.record_type} ({r.status_level}), Model: {r.model_name}, Confidence: {r.confidence}\n"

    synthesis_msg = (
        f"Physician Query Analysis for {patient.full_name}:\n"
        f"Based on {len(records)} recent clinical and specialized AI records in the patient's EHR, "
        f"the documented findings indicate multi-specialty correlations. "
        f"The primary considerations should be correlated with bedside physical examination."
    )

    # Log to AuditLogDB
    audit = AuditLogDB(
        user_id=current_user.id,
        patient_id=payload.patient_id,
        action="DOCTOR_CONSULT_QUERY",
        department="General Medicine",
        modality="Clinical Case Synthesis",
        model_name="AuraHealth Clinical Triage Engine v1.0",
        result_summary=f"Doctor Query: {payload.query[:60]}",
    )
    db.add(audit)
    db.commit()

    return {
        "patient_id": payload.patient_id,
        "query": payload.query,
        "synthesis": synthesis_msg,
        "records_referenced": len(records),
        "disclaimer": "AI decision support only. The licensed physician retains final diagnostic authority."
    }


# =====================================================================
# 5. SAVE CONSULTATION TO EHR (MEDICALRECORDDB)
# =====================================================================
@router.post("/save-to-ehr")
def save_consultation_to_ehr(
    payload: SaveToEhrPayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    session = db.query(ChatSessionDB).filter(ChatSessionDB.session_uuid == payload.session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if current_user.role == "patient" and session.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, session.patient_id):
        raise HTTPException(status_code=403, detail="Forbidden.")

    matrix = json.loads(session.clinical_matrix_json or "{}")
    assessment = json.loads(session.assessment_json or "{}")
    linked_ids = json.loads(session.linked_record_ids_json or "[]")

    complaint = matrix.get("chief_complaint") or "General Clinical Triage"
    title = f"Triage: {complaint[:40]}"

    new_record = MedicalRecordDB(
        patient_id=session.patient_id,
        doctor_id=session.doctor_id or (current_user.id if current_user.role == "doctor" else None),
        department="General Medicine",
        modality="Clinical Consultation & Triage",
        source_category="doctor_notes" if (session.doctor_id or current_user.role == "doctor") else "ai_analysis",
        model_name="AuraHealth Clinical Triage Engine v1.0",
        confidence=None,  # General Medicine confidence is strictly None
        image_ref=None,
        record_type=title,
        risk_score=None,
        status_level=session.triage_urgency,
        details_json=json.dumps({
            "session_uuid": session.session_uuid,
            "language": session.language,
            "information_completeness": session.information_completeness,
            "clinical_matrix": matrix,
            "possible_considerations": assessment.get("possible_considerations", []),
            "recommended_investigations": assessment.get("recommended_investigations", []),
            "recommended_departments": assessment.get("recommended_departments", []),
            "linked_ai_record_ids": linked_ids,
            "disclaimer": assessment.get("disclaimer", "Clinical decision support only.")
        })
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    audit = AuditLogDB(
        user_id=current_user.id,
        patient_id=session.patient_id,
        action="CONSULTATION_SAVED_EHR",
        department="General Medicine",
        modality="Clinical Consultation & Triage",
        model_name="AuraHealth Clinical Triage Engine v1.0",
        result_summary=f"Saved consultation session {session.session_uuid} as Record #{new_record.id}",
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "record_id": new_record.id,
        "message": "Consultation successfully saved to patient EHR."
    }


# =====================================================================
# 6. SESSIONS LIST & DETAILS
# =====================================================================
@router.get("/sessions/{patient_id}")
def get_patient_sessions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view another patient's sessions.")
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, patient_id):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized doctor.")

    sessions = db.query(ChatSessionDB).filter(ChatSessionDB.patient_id == patient_id).order_by(ChatSessionDB.created_at.desc()).all()
    return [
        {
            "session_uuid": s.session_uuid,
            "current_state": s.current_state,
            "triage_urgency": s.triage_urgency,
            "information_completeness": s.information_completeness,
            "created_at": s.created_at.isoformat()
        }
        for s in sessions
    ]


@router.get("/session/{session_uuid}")
def get_session_details(
    session_uuid: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    session = db.query(ChatSessionDB).filter(ChatSessionDB.session_uuid == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if current_user.role == "patient" and session.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, session.patient_id):
        raise HTTPException(status_code=403, detail="Forbidden.")

    session_msgs = db.query(ChatMessageDB).filter(ChatMessageDB.session_id == session.id).order_by(ChatMessageDB.timestamp.asc()).all()
    return {
        "session_uuid": session.session_uuid,
        "patient_id": session.patient_id,
        "doctor_id": session.doctor_id,
        "language": session.language,
        "current_state": session.current_state,
        "triage_urgency": session.triage_urgency,
        "information_completeness": session.information_completeness,
        "clinical_matrix": json.loads(session.clinical_matrix_json or "{}"),
        "assessment": json.loads(session.assessment_json or "{}"),
        "messages": [
            {
                "id": m.id,
                "sender": m.sender,
                "language": m.language,
                "content": m.content,
                "data_provenance": m.data_provenance,
                "timestamp": m.timestamp.isoformat()
            }
            for m in session_msgs
        ]
    }


# =====================================================================
# 7. ACTIVE SESSION RESOLVER (SEAMLESS CLOSED-LOOP BINDING)
# =====================================================================
@router.get("/active-session/{patient_id}")
def get_or_create_active_session(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    if current_user.role == "doctor" and not verify_doctor_patient_relationship(db, current_user.id, patient_id):
        raise HTTPException(status_code=403, detail="Forbidden.")

    session = db.query(ChatSessionDB).filter(
        ChatSessionDB.patient_id == patient_id
    ).order_by(ChatSessionDB.created_at.desc()).first()

    if not session or session.current_state == "EMERGENCY_LOCK":
        # Create fresh session
        session_uuid = f"gm_{uuid.uuid4().hex[:12]}"
        session = ChatSessionDB(
            session_uuid=session_uuid,
            patient_id=patient_id,
            doctor_id=current_user.id if current_user.role == "doctor" else None,
            language="en",
            current_state="INIT",
            triage_urgency="ROUTINE",
            information_completeness=0.0,
            clinical_matrix_json=json.dumps(create_empty_clinical_matrix()),
            assessment_json="{}",
            linked_record_ids_json="[]"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    return {
        "session_uuid": session.session_uuid,
        "patient_id": session.patient_id,
        "current_state": session.current_state
    }
