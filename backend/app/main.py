import os
import secrets
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List, Set, Dict
from contextlib import asynccontextmanager

import bcrypt
import jwt
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models.db_models import (
    UserDB,
    AppointmentDB,
    MedicalRecordDB,
    EmergencyEHR,
    NotificationDB,
)
from app.services.icu_service import predict_icu_risk

from app.routers import (
    mri_router,
    xray_router,
    ultrasound_router,
    ecg_router,
    respiratory_router,
    neurology_router,
)

# إنشاء الجداول تلقائياً
Base.metadata.create_all(bind=engine)

# إعدادات الأمان والجلسات
AURA_JWT_SECRET = os.getenv("AURA_JWT_SECRET", "aura-health-jwt-secret-key-2026")
AURA_JWT_ALGORITHM = "HS256"
AURA_COOKIE_NAME = "aura_session"
AURA_COOKIE_MAX_AGE = 86400  # 24 hours
AURA_ENV = os.getenv("AURA_ENV", "development")
IS_PRODUCTION = AURA_ENV == "production"

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# --- أدوات المساعدة للكلمات السرية وتشفير bcrypt ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_and_migrate_password(password: str, user: UserDB, db: Session) -> bool:
    stored_hash = user.hashed_password
    if not stored_hash:
        return False

    # 1. التحقق بنموذج bcrypt الحديث ($2b$ أو $2a$)
    if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except Exception:
            return False

    # 2. التحقق من التشفير القديم SHA-256 (64 خانة سداسية عشرية)
    if len(stored_hash) == 64 and all(c in "0123456789abcdefABCDEF" for c in stored_hash):
        legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if legacy_hash.lower() == stored_hash.lower():
            # ترقية كلمة المرور تلقائياً وفوراً إلى bcrypt المملّح
            new_hash = hash_password(password)
            user.hashed_password = new_hash
            db.commit()
            return True

    return False

# --- أدوات المساعدة لرموز JWT والكوكيز ---
def create_access_token(user_id: int, role: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(seconds=AURA_COOKIE_MAX_AGE)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, AURA_JWT_SECRET, algorithm=AURA_JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, AURA_JWT_SECRET, algorithms=[AURA_JWT_ALGORITHM]
        )
        return payload
    except Exception:
        return None

def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=AURA_COOKIE_NAME,
        value=token,
        max_age=AURA_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        path="/",
    )

def clear_session_cookie(response: Response):
    response.delete_cookie(
        key=AURA_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        path="/",
    )

# --- تبعيات المصادقة والتحكم بالوصول (RBAC) ---
def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> UserDB:
    token = request.cookies.get(AURA_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

def require_roles(*allowed_roles: str):
    def role_checker(
        current_user: UserDB = Depends(get_current_user),
    ) -> UserDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: insufficient permissions",
            )
        return current_user

    return role_checker

# إدارة دورة حياة التطبيق (Lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = next(get_db())
    try:
        admin_email = os.getenv("AURA_ADMIN_EMAIL", "admin@aura.com")
        admin = db.query(UserDB).filter(UserDB.email == admin_email).first()
        if not admin:
            admin_password = os.getenv("AURA_ADMIN_PASSWORD")
            if not admin_password:
                admin_password = secrets.token_urlsafe(16)
            new_admin = UserDB(
                full_name="System Admin",
                email=admin_email,
                hashed_password=hash_password(admin_password),
                role="admin",
            )
            db.add(new_admin)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="AuraHealth AI System", lifespan=lifespan)

# إعدادات CORS المحددة والآمنة
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# تضمين كافة الموجهات للذكاء الاصطناعي مع حمايتها بالمصادقة
ai_auth_dep = [Depends(get_current_user)]
app.include_router(mri_router.router, dependencies=ai_auth_dep)
app.include_router(xray_router.router, dependencies=ai_auth_dep)
app.include_router(ultrasound_router.router, dependencies=ai_auth_dep)
app.include_router(ecg_router.router, dependencies=ai_auth_dep)
app.include_router(respiratory_router.router, dependencies=ai_auth_dep)
app.include_router(neurology_router.router, dependencies=ai_auth_dep)

# --- إدارة الاتصالات المباشرة الآمنة والموجهة (Targeted WebSockets) ---
class ConnectionManager:
    def __init__(self):
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.staff_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, user: UserDB):
        await websocket.accept()
        self.user_connections.setdefault(user.id, set()).add(websocket)
        if user.role in ("doctor", "admin"):
            self.staff_connections.add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        self.staff_connections.discard(websocket)

    async def send_personal(self, user_id: int, message: dict):
        connections = self.user_connections.get(user_id, set())
        for ws in list(connections):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_staff(self, message: dict):
        for ws in list(self.staff_connections):
            try:
                await ws.send_json(message)
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
    appts = (
        db.query(AppointmentDB)
        .filter(
            AppointmentDB.doctor_id == doctor_id,
            AppointmentDB.appointment_date == appointment_date,
            AppointmentDB.status != "CANCELLED",
        )
        .all()
    )

    def sort_key(a):
        try:
            return _parse_time(a.appointment_time)
        except Exception:
            return datetime.max

    appts_sorted = sorted(appts, key=sort_key)
    for idx, appt in enumerate(appts_sorted, start=1):
        appt.queue_number = idx
    db.commit()

# --- WebSockets Endpoint الآمن والمحمي بالمصادقة (HttpOnly Cookie فقط) ---
@app.websocket("/ws/notifications")
async def websocket_endpoint(
    websocket: WebSocket,
):
    cookie_token = websocket.cookies.get(AURA_COOKIE_NAME)
    if not cookie_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(cookie_token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = next(get_db())
    try:
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await manager.connect(websocket, user)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)

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
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
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

# --- Endpoints للنظام الأساسي والمصادقة ---

@app.post("/api/auth/register")
def register(data: RegisterInput, db: Session = Depends(get_db)):
    existing = db.query(UserDB).filter(UserDB.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Email already registered"
        )

    user = UserDB(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role="patient",
    )
    db.add(user)
    db.commit()
    return {"message": "Registered successfully"}

@app.post("/api/auth/login")
def login(
    data: LoginInput,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(UserDB).filter(UserDB.email == data.email).first()
    if not user or not verify_and_migrate_password(data.password, user, db):
        raise HTTPException(
            status_code=401, detail="Invalid email or password"
        )

    token = create_access_token(user.id, user.role, user.email)
    set_session_cookie(response, token)

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "department": getattr(user, "department", None),
        }
    }

@app.get("/api/auth/me")
def get_me(current_user: UserDB = Depends(get_current_user)):
    user_data = {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "department": getattr(current_user, "department", None),
    }
    return {
        **user_data,
        "user": user_data,
    }

@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"message": "Logged out successfully"}

@app.post("/api/admin/doctors")
def create_doctor(
    data: CreateDoctorInput,
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(UserDB).filter(UserDB.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Doctor email already exists"
        )

    doc = UserDB(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role="doctor",
        department=data.department,
    )
    db.add(doc)
    db.commit()
    return {"message": "Doctor created successfully"}

@app.get("/api/admin/users")
def get_all_users(
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    users = db.query(UserDB).order_by(UserDB.id.asc()).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "department": getattr(u, "department", None),
        }
        for u in users
    ]

@app.get("/api/admin/appointments")
def get_all_appointments(
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    appointments = db.query(AppointmentDB).order_by(AppointmentDB.id.desc()).all()
    return [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "doctor_id": a.doctor_id,
            "patient_name": a.patient_name,
            "doctor_name": a.doctor_name,
            "department": a.department,
            "appointment_date": a.appointment_date,
            "appointment_time": a.appointment_time,
            "status": a.status,
            "queue_number": a.queue_number,
            "created_at": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else None,
        }
        for a in appointments
    ]

@app.get("/api/doctors")
def get_doctors(
    department: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(UserDB).filter(UserDB.role == "doctor")
    if department:
        query = query.filter(UserDB.department == department)
    doctors = query.all()
    return [
        {
            "id": d.id,
            "name": d.full_name,
            "department": d.department,
            "email": d.email,
        }
        for d in doctors
    ]

@app.get("/api/appointments/available-slots")
def get_available_slots(
    doctor_id: int,
    date: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    all_slots = generate_daily_slots()
    booked = (
        db.query(AppointmentDB.appointment_time)
        .filter(
            AppointmentDB.doctor_id == doctor_id,
            AppointmentDB.appointment_date == date,
            AppointmentDB.status != "CANCELLED",
        )
        .all()
    )
    booked_times = {b[0] for b in booked}

    return [
        {"time": slot, "available": slot not in booked_times}
        for slot in all_slots
    ]

@app.post("/api/appointments/book")
async def book_appointment(
    data: BookAppointmentInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    valid_slots = generate_daily_slots()
    if data.appointment_time not in valid_slots:
        raise HTTPException(status_code=400, detail="Invalid time slot.")

    already_taken = (
        db.query(AppointmentDB)
        .filter(
            AppointmentDB.doctor_id == data.doctor_id,
            AppointmentDB.appointment_date == data.appointment_date,
            AppointmentDB.appointment_time == data.appointment_time,
            AppointmentDB.status != "CANCELLED",
        )
        .first()
    )
    if already_taken:
        raise HTTPException(status_code=409, detail="Slot already booked.")

    # حماية الهوية: إذا كان المستخدم مريضاً، يتم استخدام هويته المحققة وتجاهل أي مدخل مزيف
    if current_user.role == "patient":
        effective_patient_id = current_user.id
        effective_patient_name = current_user.full_name
    else:
        effective_patient_id = data.patient_id or current_user.id
        effective_patient_name = data.patient_name or current_user.full_name

    appointment = AppointmentDB(
        patient_id=effective_patient_id,
        doctor_id=data.doctor_id,
        patient_name=effective_patient_name,
        doctor_name=data.doctor_name,
        department=data.department,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        queue_number=1,
        status="WAITING",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    recompute_queue_numbers(db, data.doctor_id, data.appointment_date)
    db.refresh(appointment)

    # إنشاء الإشعارات الموجهة وتخزينها في قاعدة البيانات
    notif_doc = NotificationDB(
        target_user_id=data.doctor_id,
        title="New Patient Appointment",
        message=f"Patient {effective_patient_name} reserved Queue #{appointment.queue_number} for {data.appointment_time}",
        priority="NORMAL",
    )
    notif_pat = NotificationDB(
        target_user_id=effective_patient_id,
        title="Appointment Confirmed",
        message=f"Your appointment with Dr. {data.doctor_name} is confirmed. Queue #{appointment.queue_number}",
        priority="NORMAL",
    )
    db.add(notif_doc)
    db.add(notif_pat)
    db.commit()

    # إرسال التنبيهات الموجهة إلى WebSocket الخاص بكل مستخدم فقط
    await manager.send_personal(
        data.doctor_id,
        {
            "id": notif_doc.id,
            "title": notif_doc.title,
            "message": notif_doc.message,
            "priority": notif_doc.priority,
            "created_at": notif_doc.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    )
    await manager.send_personal(
        effective_patient_id,
        {
            "id": notif_pat.id,
            "title": notif_pat.title,
            "message": notif_pat.message,
            "priority": notif_pat.priority,
            "created_at": notif_pat.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    )

    return {
        "message": "Booked successfully",
        "appointment_id": appointment.id,
        "queue_number": appointment.queue_number,
    }

@app.get("/api/appointments/patient/{patient_id}")
def get_patient_appointments(
    patient_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # لا يمكن للمريض الاطلاع إلا على مواعيده الخاصة
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot view another patient's appointments",
        )

    return (
        db.query(AppointmentDB)
        .filter(AppointmentDB.patient_id == patient_id)
        .order_by(AppointmentDB.id.desc())
        .all()
    )

@app.get("/api/appointments/doctor/{doctor_id}")
def get_doctor_queue(
    doctor_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # لا يمكن للطبيب الاطلاع إلا على عيادته، والمريض ممنوع تماماً
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: insufficient permissions",
        )
    if current_user.role == "doctor" and current_user.id != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot view another doctor's clinic queue",
        )

    return (
        db.query(AppointmentDB)
        .filter(AppointmentDB.doctor_id == doctor_id)
        .order_by(AppointmentDB.queue_number.asc())
        .all()
    )

@app.put("/api/appointments/{app_id}/status")
async def update_appointment_status(
    app_id: int,
    data: UpdateStatusInput,
    current_user: UserDB = Depends(require_roles("doctor", "admin")),
    db: Session = Depends(get_db),
):
    app_item = db.query(AppointmentDB).filter(AppointmentDB.id == app_id).first()
    if not app_item:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # الطبيب يستطيع فقط تعديل المواعيد الخاصة بعيادته
    if current_user.role == "doctor" and app_item.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot modify another doctor's appointments",
        )

    app_item.status = data.status
    db.commit()

    # إشعار موجه للمريض بتحديث حالة دوره
    notif = NotificationDB(
        target_user_id=app_item.patient_id,
        title="Ticket Status Update",
        message=f"Your ticket with Dr. {app_item.doctor_name} has been updated to: {data.status}",
        priority="NORMAL",
    )
    db.add(notif)
    db.commit()

    await manager.send_personal(
        app_item.patient_id,
        {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "priority": notif.priority,
            "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    )

    return {"message": "Status updated"}

@app.put("/api/appointments/{app_id}/cancel")
async def cancel_appointment(
    app_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app_item = db.query(AppointmentDB).filter(AppointmentDB.id == app_id).first()
    if not app_item:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "patient":
        if app_item.patient_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot cancel another patient's appointment",
            )
        if app_item.status != "WAITING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel appointment with status '{app_item.status}'",
            )
    elif current_user.role == "doctor":
        if app_item.doctor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot cancel another doctor's appointment",
            )

    app_item.status = "CANCELLED"
    db.commit()

    # إعادة ترتيب أرقام قائمة الانتظار للمواعيد المتبقية
    recompute_queue_numbers(db, app_item.doctor_id, app_item.appointment_date)

    # إشعار لكل من الطبيب والمريض
    notif_doc = NotificationDB(
        target_user_id=app_item.doctor_id,
        title="Appointment Cancelled",
        message=f"Appointment for patient {app_item.patient_name} ({app_item.appointment_time}) was cancelled.",
        priority="NORMAL",
    )
    notif_pat = NotificationDB(
        target_user_id=app_item.patient_id,
        title="Appointment Cancelled",
        message=f"Your appointment with Dr. {app_item.doctor_name} has been cancelled.",
        priority="NORMAL",
    )
    db.add(notif_doc)
    db.add(notif_pat)
    db.commit()

    # إرسال تنبيه مباشر عبر WebSocket
    await manager.send_personal(
        app_item.doctor_id,
        {
            "id": notif_doc.id,
            "title": notif_doc.title,
            "message": notif_doc.message,
            "priority": notif_doc.priority,
            "created_at": notif_doc.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    )
    await manager.send_personal(
        app_item.patient_id,
        {
            "id": notif_pat.id,
            "title": notif_pat.title,
            "message": notif_pat.message,
            "priority": notif_pat.priority,
            "created_at": notif_pat.created_at.strftime("%Y-%m-%d %H:%M"),
        },
    )

    return {"message": "Appointment cancelled successfully"}

@app.post("/api/icu/analyze")
async def analyze_icu_patient(
    data: IcuPatientInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment_result = predict_icu_risk(
        data.age,
        data.ejection_fraction,
        data.high_blood_pressure,
        data.serum_creatinine,
        data.serum_sodium,
    )

    # التحقق من هوية المريض لضمان تسجيل السجل للمريض الصحيح
    if current_user.role == "patient":
        target_patient_id = current_user.id
    else:
        target_patient_id = data.db_patient_id

    if target_patient_id:
        record = MedicalRecordDB(
            patient_id=target_patient_id,
            record_type="ICU Assessment",
            risk_score=assessment_result["risk_score"],
            status_level=assessment_result["status_level"],
            details_json=json.dumps(assessment_result["details"]),
        )
        db.add(record)
        db.commit()

    return {
        "patient_info": {
            "name": data.patient_name,
            "id": data.patient_id,
            "age": data.age,
        },
        "assessment": assessment_result,
    }

@app.post("/api/medical-records/save")
def save_medical_record(
    data: SaveRecordInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # إن كان مريضاً، يتم فرض معرفه الخاص لمنع التزوير
    if current_user.role == "patient":
        target_patient_id = current_user.id
    else:
        target_patient_id = data.patient_id or current_user.id

    record = MedicalRecordDB(
        patient_id=target_patient_id,
        record_type=data.record_type,
        risk_score=data.risk_score,
        status_level=data.status_level,
        details_json=json.dumps(data.details),
    )
    db.add(record)
    db.commit()
    return {"message": "Record saved successfully"}

@app.get("/api/medical-records/patient/{patient_id}")
def get_patient_medical_records(
    patient_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # خصوصية طبية صارمة: لا يمكن للمريض قراءة سجلات مريض آخر
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot view another patient's medical records",
        )

    records = (
        db.query(MedicalRecordDB)
        .filter(MedicalRecordDB.patient_id == patient_id)
        .order_by(MedicalRecordDB.id.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "record_type": r.record_type,
            "risk_score": r.risk_score,
            "status_level": r.status_level,
            "details": json.loads(r.details_json) if r.details_json else [],
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for r in records
    ]

@app.get("/api/medical-records/all")
def get_all_medical_records(
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    records = db.query(MedicalRecordDB).order_by(MedicalRecordDB.id.desc()).all()
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "record_type": r.record_type,
            "risk_score": r.risk_score,
            "status_level": r.status_level,
            "details": json.loads(r.details_json) if r.details_json else [],
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in records
    ]

# --- إشعارات المستخدم المخزنة ---
@app.get("/api/notifications")
def get_my_notifications(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(NotificationDB)
        .filter(NotificationDB.target_user_id == current_user.id)
        .order_by(NotificationDB.id.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "priority": n.priority,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for n in notifs
    ]

@app.put("/api/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(NotificationDB).filter(NotificationDB.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot modify another user's notifications",
        )
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@app.put("/api/notifications/mark-all-read")
def mark_all_notifications_read(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(NotificationDB).filter(
        NotificationDB.target_user_id == current_user.id,
        NotificationDB.is_read == False,
    ).update({NotificationDB.is_read: True})
    db.commit()
    return {"message": "All notifications marked as read"}

# --- الطوارئ مع سياسة الأذونات الصارمة ---
@app.post("/api/v1/emergency/report")
async def create_emergency_report(
    data: EmergencyReportInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # التحقق من صلاحيات الطوارئ
    if current_user.role == "patient":
        target_patient_id = current_user.id
        effective_patient_name = current_user.full_name
    else:
        target_patient_id = data.db_patient_id or current_user.id
        effective_patient_name = data.patient_name

    ehr = EmergencyEHR(
        patient_id=target_patient_id,
        patient_name=effective_patient_name,
        heart_rate=data.heart_rate,
        spo2=data.spo2,
        blood_pressure=data.blood_pressure,
        temperature=data.temperature,
        triage_notes=data.triage_notes,
        diagnosis=data.diagnosis,
    )
    db.add(ehr)

    notif = NotificationDB(
        target_user_id=target_patient_id,
        title=f"Emergency Alert: {effective_patient_name}",
        message=f"Diagnosis: {data.diagnosis} | SpO2: {data.spo2}%",
        priority=data.priority,
    )
    db.add(notif)
    db.commit()

    # إرسال التنبيه فقط إلى الكادر الطبي المصرح له (الأطباء والمسؤولين)
    alert_payload = {
        "id": notif.id,
        "patient_name": effective_patient_name,
        "title": notif.title,
        "message": notif.message,
        "priority": data.priority,
        "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M"),
    }
    await manager.broadcast_staff(alert_payload)

    # وإشعار موجه للمريض نفسه
    if target_patient_id:
        await manager.send_personal(target_patient_id, alert_payload)

    return {"status": "success", "ehr_id": ehr.id}

@app.get("/api/v1/emergency/records")
def get_emergency_records(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "patient":
        records = (
            db.query(EmergencyEHR)
            .filter(EmergencyEHR.patient_id == current_user.id)
            .order_by(EmergencyEHR.id.desc())
            .all()
        )
    else:
        # الكادر الطبي (الأطباء والمسؤولون) يمكنهم مراجعة كافة حالات الطوارئ
        records = db.query(EmergencyEHR).order_by(EmergencyEHR.id.desc()).all()

    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient_name,
            "heart_rate": r.heart_rate,
            "spo2": r.spo2,
            "blood_pressure": r.blood_pressure,
            "temperature": r.temperature,
            "triage_notes": r.triage_notes,
            "diagnosis": r.diagnosis,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in records
    ]