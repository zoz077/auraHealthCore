import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "aura_health.db")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_db_schema():
    """
    Non-destructive SQLite schema synchronization.
    Adds missing columns to existing tables without dropping or altering existing records.
    """
    if not os.path.exists(DB_PATH):
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. users table columns
    cursor.execute("PRAGMA table_info(users)")
    existing_user_cols = {row[1] for row in cursor.fetchall()}
    
    user_cols_to_add = [
        ("google_id", "TEXT"),
        ("is_email_verified", "BOOLEAN DEFAULT 0"),
        ("phone_number", "TEXT"),
        ("date_of_birth", "TEXT"),
        ("gender", "TEXT"),
        ("blood_group", "TEXT"),
        ("emergency_contact", "TEXT"),
        ("profile_completed", "BOOLEAN DEFAULT 1"),
    ]
    for col_name, col_type in user_cols_to_add:
        if col_name not in existing_user_cols:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                print(f"[DB SYNC] Added column '{col_name}' to 'users' table.")
            except Exception as e:
                print(f"[DB SYNC WARNING] Could not add '{col_name}' to users: {e}")

    # 2. medical_records table columns
    cursor.execute("PRAGMA table_info(medical_records)")
    existing_rec_cols = {row[1] for row in cursor.fetchall()}

    rec_cols_to_add = [
        ("doctor_id", "INTEGER"),
        ("department", "TEXT"),
        ("modality", "TEXT"),
        ("source_category", "TEXT DEFAULT 'ai_analysis'"),
        ("model_name", "TEXT"),
        ("image_ref", "TEXT"),
        ("confidence", "REAL"),
    ]
    for col_name, col_type in rec_cols_to_add:
        if col_name not in existing_rec_cols:
            try:
                cursor.execute(f"ALTER TABLE medical_records ADD COLUMN {col_name} {col_type}")
                print(f"[DB SYNC] Added column '{col_name}' to 'medical_records' table.")
            except Exception as e:
                print(f"[DB SYNC WARNING] Could not add '{col_name}' to medical_records: {e}")

    # 3. Canonicalize legacy appointment statuses
    try:
        cursor.execute("UPDATE appointments SET status = 'Upcoming' WHERE status = 'WAITING'")
        cursor.execute("UPDATE appointments SET status = 'In Progress' WHERE status = 'IN_PROGRESS'")
        cursor.execute("UPDATE appointments SET status = 'Completed' WHERE status = 'COMPLETED'")
        cursor.execute("UPDATE appointments SET status = 'Cancelled' WHERE status = 'CANCELLED'")
    except Exception as e:
        pass

    conn.commit()
    conn.close()

    # 4. Create Chat tables if not exist
    try:
        from app.models.db_models import ChatSessionDB, ChatMessageDB
        Base.metadata.create_all(bind=engine)
        print("[DB SYNC] Chat session and message tables verified.")
    except Exception as e:
        print(f"[DB SYNC WARNING] Could not verify chat tables: {e}")