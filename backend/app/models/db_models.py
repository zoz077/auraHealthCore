from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    role = Column(String, default="patient")
    department = Column(String, nullable=True)

    # Google Authentication & Profile Demographics
    google_id = Column(String, unique=True, index=True, nullable=True)
    is_email_verified = Column(Boolean, default=False)
    phone_number = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    profile_completed = Column(Boolean, default=True)

class AppointmentDB(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    patient_name = Column(String, nullable=False)
    doctor_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    appointment_date = Column(String, nullable=False)
    appointment_time = Column(String, nullable=False)
    status = Column(String, default="Upcoming")  # Upcoming, In Progress, Completed, Missed, Cancelled
    queue_number = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class MedicalRecordDB(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department = Column(String, nullable=True)
    modality = Column(String, nullable=True)
    record_type = Column(String, default="ICU Risk Assessment")
    source_category = Column(String, default="ai_analysis")  # ai_analysis, doctor_notes, medical_reports, lab_results, patient_history, appointment_history
    risk_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    status_level = Column(String, nullable=True)
    model_name = Column(String, nullable=True)
    image_ref = Column(String, nullable=True)
    details_json = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmergencyEHR(Base):
    __tablename__ = "emergency_ehr"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    patient_name = Column(String, nullable=False)
    heart_rate = Column(Integer)
    spo2 = Column(Float)
    blood_pressure = Column(String)
    temperature = Column(Float)
    triage_notes = Column(Text)
    diagnosis = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class NotificationDB(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String, default="CRITICAL")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # Doctor / Staff / System who performed the action
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, default="AI_ANALYSIS")  # AI_ANALYSIS, RECORD_CREATED, STATUS_CHANGE
    department = Column(String, nullable=True)
    modality = Column(String, nullable=True)
    model_name = Column(String, nullable=True)
    result_summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatSessionDB(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String(64), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    language = Column(String(10), default="en", nullable=False)  # 'en', 'ar'
    current_state = Column(String(50), default="INIT", nullable=False)  # INIT, QUESTIONING, SYNTHESIS, EMERGENCY_LOCK
    triage_urgency = Column(String(30), default="ROUTINE", nullable=False)  # ROUTINE, MODERATE, URGENT_PRIORITY, EMERGENCY
    information_completeness = Column(Float, default=0.0, nullable=False)
    clinical_matrix_json = Column(Text, default="{}", nullable=False)
    assessment_json = Column(Text, default="{}", nullable=False)
    linked_record_ids_json = Column(Text, default="[]", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    messages = relationship("ChatMessageDB", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessageDB.timestamp.asc()")

class ChatMessageDB(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # 'patient', 'doctor', 'assistant', 'system'
    language = Column(String(10), default="en", nullable=False)
    content = Column(Text, nullable=False)
    data_provenance = Column(String(50), default="PATIENT_REPORTED", nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSessionDB", back_populates="messages")