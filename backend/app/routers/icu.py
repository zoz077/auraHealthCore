from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.icu_service import predict_icu_risk

router = APIRouter()

class PatientICUInput(BaseModel):
    patient_name: str = Field(default="Anonymous", example="John Doe")
    patient_id: str = Field(default="EMG-101", example="EMG-2026-01")
    age: float = Field(..., ge=0, le=120, example=65.0)
    ejection_fraction: float = Field(..., ge=10, le=80, example=30.0)
    high_blood_pressure: int = Field(..., ge=0, le=1, example=1)
    serum_creatinine: float = Field(..., ge=0.1, le=15.0, example=2.1)
    serum_sodium: float = Field(..., ge=100, le=170, example=132.0)

@router.post("/analyze")
def analyze_icu_patient(patient: PatientICUInput):
    try:
        result = predict_icu_risk(
            age=patient.age,
            ef=patient.ejection_fraction,
            bp=patient.high_blood_pressure,
            creatinine=patient.serum_creatinine,
            sodium=patient.serum_sodium
        )
        
        return {
            "status": "success",
            "patient_info": {
                "name": patient.patient_name,
                "id": patient.patient_id,
                "age": patient.age
            },
            "assessment": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))