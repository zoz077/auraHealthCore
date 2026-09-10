import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models.db_models import UserDB, AppointmentDB, MedicalRecordDB, EmergencyEHR, NotificationDB
from app.services.icu_service import predict_icu_risk

from app.routers import (
    mri_router,
    xray_router,
    ultrasound_router,
    ecg_router,
    respiratory_router,
    neurology_router,  # تم إضافة موجه الأعصاب هنا
)


# إنشاء الجداول تلقائياً
Base.metadata.create_all(bind=engine)

# أدوات المساعدة للكلمات السرية
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# إدارة دورة حياة التطبيق (Lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = next(get_db())
    try:
        admin = db.query(UserDB).filter(UserDB.email == "admin@aura.com").first()
        if not admin:
            new_admin = UserDB(
                full_name="System Admin", 
                email="admin@aura.com", 
                hashed_password=hash_password("admin123"), 
                role="admin"
            )
            db.add(new_admin)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="AuraHealth AI System", lifespan=lifespan)

# إعدادات CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# تضمين كافة الموجهات
app.include_router(mri_router.router)
app.include_router(xray_router.router)
app.include_router(ultrasound_router.router)
app.include_router(ecg_router.router)
app.include_router(respiratory_router.router)
app.include_router(neurology_router.router)  # تم ربط مسارات الأعصاب بالتطبيق

# --- إدارة الاتصالات المباشرة (WebSockets) ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# --- أدوات المساعدة للمواعيد ---
CLINIC_START_TIME = "09:00 AM"
CLINIC_END_TIME = "05:00 PM"
SLOT_DURATION_MINUTES = 20
TIME_FORMAT = "%I:%M %p"

def _parse_time(t: str) -> datetime:
    return datetime.strptime(t.strip().upper(), TIME_FORMAT)

def generate_daily_slots() -> List[str]:
    start = _parse_time(CLINIC_START_TIME)
    end = _parse_time(CLINIC_END_TIME)
    slots = []
    cur = start
    while cur < end:
        slots.append(cur.strftime(TIME_FORMAT).lstrip("0"))
        cur += timedelta(minutes=SLOT_DURATION_MINUTES)
    return slots

def recompute_queue_numbers(db: Session, doctor_id: int, appointment_date: str):
    appts = db.query(AppointmentDB).filter(
        AppointmentDB.doctor_id == doctor_id,
        AppointmentDB.appointment_date == appointment_date,
        AppointmentDB.status != "CANCELLED"
    ).all()

    def sort_key(a):
        try:
            return _parse_time(a.appointment_time)
        except Exception:
            return datetime.max

    appts_sorted = sorted(appts, key=sort_key)
    for idx, appt in enumerate(appts_sorted, start=1):
        appt.queue_number = idx
    db.commit()

# --- WebSockets Endpoint ---
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- نماذج المدخلات (Pydantic Models) ---
class RegisterInput(BaseModel):
    full_name: str
    email: str
    password: str

class LoginInput(BaseModel):
    email: str
    password: str

class CreateDoctorInput(BaseModel):
    full_name: str
    email: str
    password: str
    department: str

class BookAppointmentInput(BaseModel):
    patient_id: int
    patient_name: str
    doctor_id: int
    doctor_name: str
    department: str
    appointment_date: str
    appointment_time: str

class UpdateStatusInput(BaseModel):
    status: str

class IcuPatientInput(BaseModel):
    patient_name: str
    patient_id: str
    age: float
    ejection_fraction: float
    high_blood_pressure: int
    serum_creatinine: float
    serum_sodium: float
    db_patient_id: Optional[int] = None

class EmergencyReportInput(BaseModel):
    patient_name: str
    db_patient_id: Optional[int] = None
    heart_rate: int
    spo2: float
    blood_pressure: str
    temperature: float
    triage_notes: str
    diagnosis: str
    priority: str = "CRITICAL"

class SaveRecordInput(BaseModel):
    patient_id: Optional[int] = None
    record_type: str
    risk_score: float
    status_level: str
    details: List[str]

# --- Endpoints للنظام الأساسي ---

@app.post("/api/auth/register")
def register(data: RegisterInput, db: Session = Depends(get_db)):
    existing = db.query(UserDB).filter(UserDB.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = UserDB(full_name=data.full_name, email=data.email, hashed_password=hash_password(data.password), role="patient")
    db.add(user)
    db.commit()
    return {"message": "Registered successfully"}

@app.post("/api/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "department": getattr(user, 'department', None)
        }
    }

@app.post("/api/admin/doctors")
def create_doctor(data: CreateDoctorInput, db: Session = Depends(get_db)):
    existing = db.query(UserDB).filter(UserDB.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Doctor email already exists")
    
    doc = UserDB(full_name=data.full_name, email=data.email, hashed_password=hash_password(data.password), role="doctor", department=data.department)
    db.add(doc)
    db.commit()
    return {"message": "Doctor created successfully"}

@app.get("/api/doctors")
def get_doctors(department: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(UserDB).filter(UserDB.role == "doctor")
    if department:
        query = query.filter(UserDB.department == department)
    doctors = query.all()
    return [{"id": d.id, "name": d.full_name, "department": d.department, "email": d.email} for d in doctors]

@app.get("/api/appointments/available-slots")
def get_available_slots(doctor_id: int, date: str, db: Session = Depends(get_db)):
    all_slots = generate_daily_slots()
    booked = db.query(AppointmentDB.appointment_time).filter(
        AppointmentDB.doctor_id == doctor_id,
        AppointmentDB.appointment_date == date,
        AppointmentDB.status != "CANCELLED"
    ).all()
    booked_times = {b[0] for b in booked}

    return [{"time": slot, "available": slot not in booked_times} for slot in all_slots]

@app.post("/api/appointments/book")
def book_appointment(data: BookAppointmentInput, db: Session = Depends(get_db)):
    valid_slots = generate_daily_slots()
    if data.appointment_time not in valid_slots:
        raise HTTPException(status_code=400, detail="Invalid time slot.")

    already_taken = db.query(AppointmentDB).filter(
        AppointmentDB.doctor_id == data.doctor_id,
        AppointmentDB.appointment_date == data.appointment_date,
        AppointmentDB.appointment_time == data.appointment_time,
        AppointmentDB.status != "CANCELLED"
    ).first()
    if already_taken:
        raise HTTPException(status_code=409, detail="Slot already booked.")

    appointment = AppointmentDB(
        patient_id=data.patient_id,
        doctor_id=data.doctor_id,
        patient_name=data.patient_name,
        doctor_name=data.doctor_name,
        department=data.department,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        queue_number=1,
        status="WAITING"
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    recompute_queue_numbers(db, data.doctor_id, data.appointment_date)
    db.refresh(appointment)

    return {"message": "Booked successfully", "queue_number": appointment.queue_number}

@app.get("/api/appointments/patient/{patient_id}")
def get_patient_appointments(patient_id: int, db: Session = Depends(get_db)):
    return db.query(AppointmentDB).filter(AppointmentDB.patient_id == patient_id).order_by(AppointmentDB.id.desc()).all()

@app.get("/api/appointments/doctor/{doctor_id}")
def get_doctor_queue(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(AppointmentDB).filter(AppointmentDB.doctor_id == doctor_id).order_by(AppointmentDB.queue_number.asc()).all()

@app.put("/api/appointments/{app_id}/status")
def update_appointment_status(app_id: int, data: UpdateStatusInput, db: Session = Depends(get_db)):
    app_item = db.query(AppointmentDB).filter(AppointmentDB.id == app_id).first()
    if app_item:
        app_item.status = data.status
        db.commit()
    return {"message": "Status updated"}

@app.post("/api/icu/analyze")
async def analyze_icu_patient(data: IcuPatientInput, db: Session = Depends(get_db)):
    assessment_result = predict_icu_risk(
        data.age, data.ejection_fraction, data.high_blood_pressure, data.serum_creatinine, data.serum_sodium
    )

    if data.db_patient_id:
        record = MedicalRecordDB(
            patient_id=data.db_patient_id,
            record_type="ICU Assessment",
            risk_score=assessment_result["risk_score"],
            status_level=assessment_result["status_level"],
            details_json=json.dumps(assessment_result["details"])
        )
        db.add(record)
        db.commit()

    return {
        "patient_info": {"name": data.patient_name, "id": data.patient_id, "age": data.age},
        "assessment": assessment_result
    }

@app.post("/api/medical-records/save")
def save_medical_record(data: SaveRecordInput, db: Session = Depends(get_db)):
    if not data.patient_id:
        raise HTTPException(status_code=400, detail="Patient ID is required")

    record = MedicalRecordDB(
        patient_id=data.patient_id,
        record_type=data.record_type,
        risk_score=data.risk_score,
        status_level=data.status_level,
        details_json=json.dumps(data.details)
    )
    db.add(record)
    db.commit()
    return {"message": "Record saved successfully"}

@app.get("/api/medical-records/patient/{patient_id}")
def get_patient_medical_records(patient_id: int, db: Session = Depends(get_db)):
    records = db.query(MedicalRecordDB).filter(MedicalRecordDB.patient_id == patient_id).order_by(MedicalRecordDB.id.desc()).all()
    return [
        {
            "id": r.id,
            "record_type": r.record_type,
            "risk_score": r.risk_score,
            "status_level": r.status_level,
            "details": json.loads(r.details_json) if r.details_json else [],
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for r in records
    ]

@app.post("/api/v1/emergency/report")
async def create_emergency_report(data: EmergencyReportInput, db: Session = Depends(get_db)):
    ehr = EmergencyEHR(
        patient_id=data.db_patient_id,
        patient_name=data.patient_name,
        heart_rate=data.heart_rate,
        spo2=data.spo2,
        blood_pressure=data.blood_pressure,
        temperature=data.temperature,
        triage_notes=data.triage_notes,
        diagnosis=data.diagnosis
    )
    db.add(ehr)

    notif = NotificationDB(
        target_user_id=data.db_patient_id,
        title=f"Emergency Alert: {data.patient_name}",
        message=f"Diagnosis: {data.diagnosis} | SpO2: {data.spo2}%",
        priority=data.priority
    )
    db.add(notif)
    db.commit()

    await manager.broadcast({
        "id": notif.id,
        "patient_name": data.patient_name,
        "title": notif.title,
        "message": notif.message,
        "priority": data.priority
    })

    return {"status": "success", "ehr_id": ehr.id}