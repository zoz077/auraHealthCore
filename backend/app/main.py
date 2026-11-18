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

from app.database import engine, Base, get_db, sync_db_schema
from app.models.db_models import (
    UserDB,
    AppointmentDB,
    MedicalRecordDB,
    EmergencyEHR,
    NotificationDB,
    AuditLogDB,
)
from app.services.icu_service import predict_icu_risk

from app.routers import (
    mri_router,
    xray_router,
    ultrasound_router,
    ecg_router,
    respiratory_router,
    neurology_router,
    orthopedics_router,
    general_medicine_router,
)


# مزامنة قاعدة البيانات وإنشاء الجداول تلقائياً
sync_db_schema()
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
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
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
app.include_router(orthopedics_router.router, dependencies=ai_auth_dep)
app.include_router(general_medicine_router.router)


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
    clean = t.strip().upper()
    if len(clean.split(":")[0]) == 1:
        clean = "0" + clean
    return datetime.strptime(clean, TIME_FORMAT)

def parse_appointment_datetime(date_str: str, time_str: str) -> Optional[datetime]:
    try:
        clean_time = time_str.strip().upper()
        if len(clean_time.split(":")[0]) == 1:
            clean_time = "0" + clean_time
        return datetime.strptime(f"{date_str.strip()} {clean_time}", f"%Y-%m-%d {TIME_FORMAT}")
    except Exception:
        return None

def generate_daily_slots() -> List[str]:
    start = _parse_time(CLINIC_START_TIME)
    end = _parse_time(CLINIC_END_TIME)
    slots = []
    cur = start
    while cur < end:
        slots.append(cur.strftime(TIME_FORMAT).lstrip("0"))
        cur += timedelta(minutes=SLOT_DURATION_MINUTES)
    return slots

def sync_appointment_lifecycle(db: Session):
    """
    Automatically marks past appointments as Missed if they were not Completed or Cancelled.
    """
    now = datetime.now()
    active_appts = (
        db.query(AppointmentDB)
        .filter(AppointmentDB.status.in_(["Upcoming", "WAITING", "In Progress"]))
        .all()
    )
    changed = False
    for a in active_appts:
        dt = parse_appointment_datetime(a.appointment_date, a.appointment_time)
        if dt:
            end_time = dt + timedelta(minutes=SLOT_DURATION_MINUTES)
            if end_time < now:
                a.status = "Missed"
                changed = True
        elif a.status == "WAITING":
            a.status = "Upcoming"
            changed = True
    if changed:
        db.commit()

def recompute_queue_numbers(db: Session, doctor_id: int, appointment_date: str):
    appts = (
        db.query(AppointmentDB)
        .filter(
            AppointmentDB.doctor_id == doctor_id,
            AppointmentDB.appointment_date == appointment_date,
            AppointmentDB.status.in_(["Upcoming", "WAITING", "In Progress"]),
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

class GoogleAuthInput(BaseModel):
    credential: Optional[str] = None
    google_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None

class CompleteProfileInput(BaseModel):
    phone_number: str
    date_of_birth: str
    gender: str
    blood_group: str
    emergency_contact: Optional[str] = None

class LinkGoogleInput(BaseModel):
    credential: Optional[str] = None
    google_id: Optional[str] = None
    email: Optional[str] = None

class UpdateEmailInput(BaseModel):
    new_email: str
    password: Optional[str] = None

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
    risk_score: float = 0.0
    status_level: str
    details: List[str] = []
    department: Optional[str] = None
    modality: Optional[str] = None
    source_category: Optional[str] = "AI Analysis"
    model_name: Optional[str] = None
    confidence: Optional[float] = None
    image_ref: Optional[str] = None

def serialize_user(user: UserDB) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "department": getattr(user, "department", None),
        "google_id": user.google_id,
        "is_email_verified": bool(user.is_email_verified),
        "profile_completed": bool(user.profile_completed),
        "phone_number": user.phone_number,
        "date_of_birth": user.date_of_birth,
        "gender": user.gender,
        "blood_group": user.blood_group,
        "emergency_contact": user.emergency_contact,
    }

def decode_google_credential(credential: str) -> dict:
    try:
        return jwt.decode(credential, options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google credential: {str(e)}")

# --- Endpoints للنظام الأساسي والمصادقة ---

@app.post("/api/auth/register")
def register(data: RegisterInput, db: Session = Depends(get_db)):
    clean_email = data.email.strip().lower()
    existing = db.query(UserDB).filter(UserDB.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Email already registered"
        )

    user = UserDB(
        full_name=data.full_name.strip(),
        email=clean_email,
        hashed_password=hash_password(data.password),
        role="patient",
        profile_completed=True,
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
    clean_email = data.email.strip().lower()
    user = db.query(UserDB).filter(UserDB.email == clean_email).first()
    if not user or not verify_and_migrate_password(data.password, user, db):
        raise HTTPException(
            status_code=401, detail="Invalid email or password"
        )

    token = create_access_token(user.id, user.role, user.email)
    set_session_cookie(response, token)

    return {
        "user": serialize_user(user)
    }

@app.post("/api/auth/google")
def google_auth(
    data: GoogleAuthInput,
    response: Response,
    db: Session = Depends(get_db),
):
    google_id = data.google_id
    email = data.email
    name = data.name

    if data.credential:
        payload = decode_google_credential(data.credential)
        google_id = str(payload.get("sub", "")) or google_id
        email = payload.get("email") or email
        name = payload.get("name") or name

    if not email:
        raise HTTPException(status_code=400, detail="Google authentication failed: email missing.")

    email = email.strip().lower()
    user = None
    if google_id:
        user = db.query(UserDB).filter(UserDB.google_id == str(google_id)).first()

    is_new_user = False
    if not user:
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if user:
            if google_id:
                user.google_id = str(google_id)
            user.is_email_verified = True
            db.commit()
        else:
            is_new_user = True
            user = UserDB(
                full_name=name.strip() if name else email.split("@")[0].capitalize(),
                email=email,
                role="patient",
                google_id=str(google_id) if google_id else None,
                is_email_verified=True,
                profile_completed=False,
                hashed_password="!google_oauth_" + secrets.token_hex(16),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    token = create_access_token(user.id, user.role, user.email)
    set_session_cookie(response, token)

    requires_completion = not bool(user.profile_completed) and user.role == "patient"

    return {
        "user": serialize_user(user),
        "requires_profile_completion": requires_completion,
        "is_new_user": is_new_user,
        "access_token": token,
    }

@app.post("/api/auth/complete-profile")
def complete_profile(
    data: CompleteProfileInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.phone_number = data.phone_number.strip()
    current_user.date_of_birth = data.date_of_birth.strip()
    current_user.gender = data.gender.strip()
    current_user.blood_group = data.blood_group.strip()
    if data.emergency_contact:
        current_user.emergency_contact = data.emergency_contact.strip()
    current_user.profile_completed = True
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile completed successfully",
        "user": serialize_user(current_user),
    }

@app.post("/api/auth/profile/link-google")
def link_google(
    data: LinkGoogleInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    google_id = data.google_id
    if data.credential:
        payload = decode_google_credential(data.credential)
        google_id = str(payload.get("sub", "")) or google_id

    if not google_id:
        raise HTTPException(status_code=400, detail="Missing Google ID")

    existing = db.query(UserDB).filter(UserDB.google_id == str(google_id), UserDB.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This Google account is already linked to another user.")

    current_user.google_id = str(google_id)
    current_user.is_email_verified = True
    db.commit()
    return {"message": "Google account linked successfully", "user": serialize_user(current_user)}

@app.put("/api/auth/profile/email")
def update_profile_email(
    data: UpdateEmailInput,
    response: Response,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_email = data.new_email.strip().lower()
    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    if new_email == current_user.email.lower():
        return {"message": "Email is already set to this address", "user": serialize_user(current_user)}

    # Verify password if user has password set (local auth accounts)
    if current_user.hashed_password and not current_user.hashed_password.startswith("!google_oauth_"):
        if not data.password or not verify_and_migrate_password(data.password, current_user, db):
            raise HTTPException(status_code=401, detail="Invalid current password. Password verification required to change email.")

    # Check collision
    existing = db.query(UserDB).filter(UserDB.email == new_email, UserDB.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already taken by another user.")

    current_user.email = new_email
    current_user.is_email_verified = False
    db.commit()

    token = create_access_token(current_user.id, current_user.role, current_user.email)
    set_session_cookie(response, token)

    return {"message": "Email updated successfully. Please verify your new email.", "user": serialize_user(current_user)}

@app.post("/api/auth/profile/verify-email")
def verify_profile_email(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.is_email_verified = True
    db.commit()
    return {"message": "Email verified successfully", "user": serialize_user(current_user)}

@app.get("/api/auth/me")
def get_me(current_user: UserDB = Depends(get_current_user)):
    user_data = serialize_user(current_user)
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

@app.get("/api/doctor/patients")
def get_doctor_patients(
    current_user: UserDB = Depends(require_roles("doctor", "admin")),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    else:
        appt_p_ids = [
            a[0]
            for a in db.query(AppointmentDB.patient_id)
            .filter(AppointmentDB.doctor_id == current_user.id)
            .distinct()
            .all()
        ]
        rec_p_ids = [
            r[0]
            for r in db.query(MedicalRecordDB.patient_id)
            .filter(MedicalRecordDB.doctor_id == current_user.id)
            .distinct()
            .all()
        ]
        p_ids = set(appt_p_ids + rec_p_ids)
        if not p_ids:
            patients = db.query(UserDB).filter(UserDB.role == "patient").limit(25).all()
        else:
            patients = db.query(UserDB).filter(UserDB.id.in_(p_ids)).all()

    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "email": p.email,
            "phone_number": p.phone_number,
            "gender": p.gender,
            "blood_group": p.blood_group,
            "date_of_birth": p.date_of_birth,
        }
        for p in patients
    ]

@app.get("/api/appointments/available-slots")
def get_available_slots(
    doctor_id: int,
    date: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sync_appointment_lifecycle(db)
    all_slots = generate_daily_slots()
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    booked = (
        db.query(AppointmentDB.appointment_time)
        .filter(
            AppointmentDB.doctor_id == doctor_id,
            AppointmentDB.appointment_date == date,
            AppointmentDB.status.notin_(["CANCELLED", "Cancelled", "Missed"]),
        )
        .all()
    )
    booked_times = {b[0].strip().upper() for b in booked}

    result = []
    for slot in all_slots:
        is_available = slot.strip().upper() not in booked_times

        # Disallow past dates
        if date < today_str:
            is_available = False
        elif date == today_str:
            slot_dt = parse_appointment_datetime(date, slot)
            if slot_dt and slot_dt <= now:
                is_available = False

        result.append({"time": slot, "available": is_available})

    return result

@app.post("/api/appointments/book")
async def book_appointment(
    data: BookAppointmentInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sync_appointment_lifecycle(db)
    valid_slots = generate_daily_slots()
    valid_normalized = {s.strip().upper() for s in valid_slots}
    if data.appointment_time.strip().upper() not in valid_normalized:
        raise HTTPException(status_code=400, detail="Invalid time slot.")

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    if data.appointment_date < today_str:
        raise HTTPException(status_code=400, detail="Cannot book an appointment in the past.")

    appt_dt = parse_appointment_datetime(data.appointment_date, data.appointment_time)
    if not appt_dt:
        raise HTTPException(status_code=400, detail="Invalid appointment date or time format.")

    if appt_dt < now:
        raise HTTPException(status_code=400, detail="Cannot book an appointment for a time that has already passed.")

    already_taken = (
        db.query(AppointmentDB)
        .filter(
            AppointmentDB.doctor_id == data.doctor_id,
            AppointmentDB.appointment_date == data.appointment_date,
            AppointmentDB.appointment_time == data.appointment_time,
            AppointmentDB.status.notin_(["CANCELLED", "Cancelled"]),
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
        status="Upcoming",
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
        message=f"Patient {effective_patient_name} reserved Queue #{appointment.queue_number} for {data.appointment_date} at {data.appointment_time}",
        priority="NORMAL",
    )
    notif_pat = NotificationDB(
        target_user_id=effective_patient_id,
        title="Appointment Confirmed",
        message=f"Your appointment with Dr. {data.doctor_name} is confirmed for {data.appointment_date} at {data.appointment_time}. Queue #{appointment.queue_number}",
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
        "status": appointment.status,
    }

@app.get("/api/appointments/patient/{patient_id}")
def get_patient_appointments(
    patient_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sync_appointment_lifecycle(db)
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
    sync_appointment_lifecycle(db)
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

    canonical_map = {
        "upcoming": "Upcoming",
        "waiting": "Upcoming",
        "in progress": "In Progress",
        "in_progress": "In Progress",
        "completed": "Completed",
        "missed": "Missed",
        "cancelled": "Cancelled",
        "canceled": "Cancelled",
    }
    normalized_status = canonical_map.get(data.status.strip().lower(), data.status)
    if normalized_status not in ["Upcoming", "In Progress", "Completed", "Missed", "Cancelled"]:
        raise HTTPException(status_code=400, detail=f"Invalid status '{data.status}'")

    app_item.status = normalized_status
    db.commit()

    recompute_queue_numbers(db, app_item.doctor_id, app_item.appointment_date)

    # إشعار موجه للمريض بتحديث حالة دوره
    notif = NotificationDB(
        target_user_id=app_item.patient_id,
        title="Appointment Status Update",
        message=f"Your appointment with Dr. {app_item.doctor_name} has been updated to: {normalized_status}",
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

    return {"message": "Status updated", "status": normalized_status}

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
        if app_item.status not in ["Upcoming", "WAITING"]:
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

    app_item.status = "Cancelled"
    db.commit()

    recompute_queue_numbers(db, app_item.doctor_id, app_item.appointment_date)

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

    if current_user.role == "patient":
        target_patient_id = current_user.id
        doctor_id = None
    else:
        target_patient_id = data.db_patient_id or current_user.id
        doctor_id = current_user.id if current_user.role == "doctor" else None

    if target_patient_id:
        record = MedicalRecordDB(
            patient_id=target_patient_id,
            doctor_id=doctor_id,
            department="ICU & Critical Care",
            modality="Clinical Vitals",
            source_category="AI Analysis",
            model_name="ICU XGBoost Decompensation Analyzer",
            confidence=float(assessment_result["risk_score"]),
            record_type="ICU Assessment",
            risk_score=assessment_result["risk_score"],
            status_level=assessment_result["status_level"],
            details_json=json.dumps(assessment_result["details"]),
        )
        db.add(record)

        audit = AuditLogDB(
            user_id=current_user.id,
            patient_id=target_patient_id,
            action="AI_ANALYSIS_SAVED",
            department="ICU & Critical Care",
            modality="Clinical Vitals",
            model_name="ICU XGBoost Decompensation Analyzer",
            result_summary=f"ICU Assessment: {assessment_result['status_level']} (Score: {assessment_result['risk_score']})",
        )
        db.add(audit)
        db.commit()

        if current_user.role == "doctor" and target_patient_id != current_user.id:
            notif = NotificationDB(
                target_user_id=target_patient_id,
                title="New ICU Risk Assessment",
                message=f"Dr. {current_user.full_name} recorded an ICU Risk Assessment: {assessment_result['status_level']}",
                priority="HIGH" if assessment_result["status_level"] == "CRITICAL" else "NORMAL",
            )
            db.add(notif)
            db.commit()

            await manager.send_personal(
                target_patient_id,
                {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "priority": notif.priority,
                    "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M"),
                },
            )

    return {
        "patient_info": {
            "name": data.patient_name,
            "id": data.patient_id,
            "age": data.age,
        },
        "assessment": assessment_result,
        "record_id": record.id if target_patient_id and record else None,
    }

@app.post("/api/medical-records/save")
async def save_medical_record(
    data: SaveRecordInput,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doctor_id = current_user.id if current_user.role == "doctor" else None

    if current_user.role == "doctor":
        if not data.patient_id:
            raise HTTPException(status_code=400, detail="Patient ID is required when saving AI clinical evaluation.")
        target_patient = db.query(UserDB).filter(UserDB.id == data.patient_id).first()
        if not target_patient:
            raise HTTPException(status_code=404, detail="Selected patient not found.")
        target_patient_id = data.patient_id
    elif current_user.role == "patient":
        target_patient_id = current_user.id
    else:
        target_patient_id = data.patient_id or current_user.id

    record = MedicalRecordDB(
        patient_id=target_patient_id,
        doctor_id=doctor_id,
        department=data.department,
        modality=data.modality,
        source_category=data.source_category or "AI Analysis",
        model_name=data.model_name,
        confidence=data.confidence,
        image_ref=data.image_ref,
        record_type=data.record_type,
        risk_score=data.risk_score,
        status_level=data.status_level,
        details_json=json.dumps(data.details),
    )
    db.add(record)

    audit = AuditLogDB(
        user_id=current_user.id,
        patient_id=target_patient_id,
        action="AI_ANALYSIS_SAVED" if (data.source_category == "AI Analysis" or data.model_name) else "RECORD_SAVED",
        department=data.department,
        modality=data.modality,
        model_name=data.model_name,
        result_summary=f"{data.record_type}: {data.status_level} (Score: {data.risk_score})",
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    # إشعار موجه للمريض إذا قام الطبيب بحفظ السجل له
    if current_user.role == "doctor" and target_patient_id != current_user.id:
        notif = NotificationDB(
            target_user_id=target_patient_id,
            title="New Medical Record Added",
            message=f"Dr. {current_user.full_name} added an AI assessment: {data.record_type} ({data.status_level})",
            priority="NORMAL",
        )
        db.add(notif)
        db.commit()

        await manager.send_personal(
            target_patient_id,
            {
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "priority": notif.priority,
                "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M"),
            },
        )

    return {"message": "Record saved successfully", "record_id": record.id}

@app.get("/api/medical-records/patient/{patient_id}")
def get_patient_medical_records(
    patient_id: int,
    category: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # خصوصية طبية صارمة: لا يمكن للمريض قراءة سجلات مريض آخر
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: cannot view another patient's medical records",
        )

    # تحقق صارم من علاقة الطبيب السريرية بالمريض
    if current_user.role == "doctor":
        has_appointment = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.doctor_id == current_user.id,
                AppointmentDB.patient_id == patient_id,
            )
            .first()
        )
        has_record = (
            db.query(MedicalRecordDB)
            .filter(
                MedicalRecordDB.doctor_id == current_user.id,
                MedicalRecordDB.patient_id == patient_id,
            )
            .first()
        )
        if not has_appointment and not has_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not have an active clinical relationship with this patient.",
            )

    query = db.query(MedicalRecordDB).filter(MedicalRecordDB.patient_id == patient_id)
    if category and category.strip().lower() != "all":
        query = query.filter(MedicalRecordDB.source_category == category.strip())

    records = query.order_by(MedicalRecordDB.id.desc()).all()

    doctor_ids = {r.doctor_id for r in records if r.doctor_id}
    doctors_map = {}
    if doctor_ids:
        docs = db.query(UserDB).filter(UserDB.id.in_(doctor_ids)).all()
        doctors_map = {d.id: d.full_name for d in docs}

    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "doctor_id": r.doctor_id,
            "doctor_name": doctors_map.get(r.doctor_id) if r.doctor_id else None,
            "department": r.department,
            "modality": r.modality,
            "source_category": r.source_category or "AI Analysis",
            "model_name": r.model_name,
            "confidence": r.confidence,
            "image_ref": r.image_ref,
            "record_type": r.record_type,
            "risk_score": r.risk_score,
            "status_level": r.status_level,
            "details": json.loads(r.details_json) if r.details_json else [],
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in records
    ]

@app.get("/api/medical-records/all")
def get_all_medical_records(
    category: Optional[str] = None,
    current_user: UserDB = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    query = db.query(MedicalRecordDB)
    if category and category.strip().lower() != "all":
        query = query.filter(MedicalRecordDB.source_category == category.strip())
    records = query.order_by(MedicalRecordDB.id.desc()).all()

    doctor_ids = {r.doctor_id for r in records if r.doctor_id}
    doctors_map = {}
    if doctor_ids:
        docs = db.query(UserDB).filter(UserDB.id.in_(doctor_ids)).all()
        doctors_map = {d.id: d.full_name for d in docs}

    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "doctor_id": r.doctor_id,
            "doctor_name": doctors_map.get(r.doctor_id) if r.doctor_id else None,
            "department": r.department,
            "modality": r.modality,
            "source_category": r.source_category or "AI Analysis",
            "model_name": r.model_name,
            "confidence": r.confidence,
            "image_ref": r.image_ref,
            "record_type": r.record_type,
            "risk_score": r.risk_score,
            "status_level": r.status_level,
            "details": json.loads(r.details_json) if r.details_json else [],
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in records
    ]

@app.get("/api/audit-logs")
def get_audit_logs(
    current_user: UserDB = Depends(require_roles("doctor", "admin")),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLogDB)
    if current_user.role == "doctor":
        query = query.filter(AuditLogDB.user_id == current_user.id)
    logs = query.order_by(AuditLogDB.id.desc()).limit(100).all()

    user_ids = {l.user_id for l in logs if l.user_id} | {l.patient_id for l in logs if l.patient_id}
    users_map = {}
    if user_ids:
        users = db.query(UserDB).filter(UserDB.id.in_(user_ids)).all()
        users_map = {u.id: u.full_name for u in users}

    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_name": users_map.get(l.user_id, f"User #{l.user_id}"),
            "patient_id": l.patient_id,
            "patient_name": users_map.get(l.patient_id, f"Patient #{l.patient_id}") if l.patient_id else "N/A",
            "action": l.action,
            "department": l.department,
            "modality": l.modality,
            "model_name": l.model_name,
            "result_summary": l.result_summary,
            "created_at": l.created_at.strftime("%Y-%m-%d %H:%M") if l.created_at else None,
        }
        for l in logs
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