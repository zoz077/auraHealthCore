import os
import shutil
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from app.services.respiratory_service import respiratory_service

router = APIRouter(
    prefix="/api/respiratory",
    tags=["Respiratory Diagnosis Dashboard"]
)

TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/diagnose")
async def diagnose(
    test_type: str = Form(...),
    file: Optional[UploadFile] = File(None),
    spo2: Optional[float] = Form(None),
    temp: Optional[float] = Form(None),
    heart_rate: Optional[int] = Form(None),
    resp_rate: Optional[int] = Form(None)
):
    # 1. التعامل مع الفحوصات الطبية التي تتطلب ملف (صور/صوت)
    if test_type in ["ct", "xray", "ultrasound", "sounds"]:
        if not file:
            raise HTTPException(status_code=400, detail=f"File required for {test_type.upper()} analysis.")
        
        file_bytes = await file.read()
        
        if test_type == "ct":
            return respiratory_service.predict_ctscan(file_bytes)
        elif test_type == "xray":
            return respiratory_service.predict_xray(file_bytes)
        elif test_type == "ultrasound":
            return respiratory_service.predict_ultrasound(file_bytes)
        elif test_type == "sounds":
            # حفظ مؤقت لملف الصوت
            temp_path = os.path.join(TEMP_DIR, f"temp_{file.filename}")
            try:
                with open(temp_path, "wb") as f:
                    f.write(file_bytes)
                return respiratory_service.predict_audio(temp_path)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    # 2. التعامل مع العلامات الحيوية Vital Signs
    elif test_type == "vitals":
        if None in [spo2, temp, heart_rate, resp_rate]:
            raise HTTPException(status_code=400, detail="All vital signs inputs are required.")
        
        return respiratory_service.predict_vitals(
            spo2=spo2,
            temp=temp,
            heart_rate=heart_rate,
            resp_rate=resp_rate
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid test_type selected.")