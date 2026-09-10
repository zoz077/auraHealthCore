from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from datetime import datetime
from app.database import Base

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="patient")
    department = Column(String, nullable=True)

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
    status = Column(String, default="WAITING")
    queue_number = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

class MedicalRecordDB(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    record_type = Column(String, default="ICU Risk Assessment")
    risk_score = Column(Float)
    status_level = Column(String)
    details_json = Column(String)
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