from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import List

from app.services.neurology_service import (
    predict_brain_tumor_service,
    predict_alzheimer_service,
    predict_eeg_service,
    predict_vision_service,
    predict_vision_file_service,
    predict_parkinson_file_service,
    predict_spine_service
)

router = APIRouter(prefix="/api/neurology", tags=["Neurology & Brain AI Services"])

class EEGDataInput(BaseModel):
    signals: List[float]

class VisionMetricsInput(BaseModel):
    metrics: List[float]

@router.post("/brain-tumor")
async def analyze_brain_tumor(file: UploadFile = File(...)):
    if file.content_type and not (file.content_type.startswith("image/") or file.content_type == "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")
    contents = await file.read()
    return predict_brain_tumor_service(contents)

@router.post("/alzheimer")
async def analyze_alzheimer(file: UploadFile = File(...)):
    if file.content_type and not (file.content_type.startswith("image/") or file.content_type == "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")
    contents = await file.read()
    return predict_alzheimer_service(contents)

@router.post("/eeg")
def analyze_eeg(data: EEGDataInput):
    if len(data.signals) != 178:
        raise HTTPException(status_code=400, detail="EEG classification requires exactly 178 signal points.")
    return predict_eeg_service(data.signals)

@router.post("/vision-exam")
def analyze_vision_exam(data: VisionMetricsInput):
    if len(data.metrics) < 1:
        raise HTTPException(status_code=400, detail="Vision examination metrics are required.")
    return predict_vision_service(data.metrics)

@router.post("/vision-exam-file")
async def analyze_vision_exam_file(file: UploadFile = File(...)):
    contents = await file.read()
    return predict_vision_file_service(contents)

@router.post("/parkinsons")
async def analyze_parkinsons(file: UploadFile = File(...)):
    contents = await file.read()
    return predict_parkinson_file_service(contents)

@router.post("/spine")
async def analyze_spine(file: UploadFile = File(...)):
    if file.content_type and not (file.content_type.startswith("image/") or file.content_type == "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")
    contents = await file.read()
    return predict_spine_service(contents)