from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List
from app.services.ecg_service import predict_ecg_signal, predict_ecg_image

router = APIRouter(prefix="/ecg", tags=["ECG Diagnosis"])

class ECGRequest(BaseModel):
    signal: List[float]

@router.post("/predict")
def predict_signal(data: ECGRequest):
    if len(data.signal) != 187:
        raise HTTPException(
            status_code=400,
            detail=f"Signal length must be exactly 187 points. Provided length: {len(data.signal)}"
        )
    return predict_ecg_signal(data.signal)

@router.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be a valid image (PNG, JPG, JPEG)."
        )
    
    image_bytes = await file.read()
    return predict_ecg_image(image_bytes)