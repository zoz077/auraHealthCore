from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ultrasound_service import analyze_ultrasound_image

router = APIRouter(prefix="/api/ultrasound", tags=["Ultrasound"])

@router.post("/detect")
async def detect_ultrasound(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = analyze_ultrasound_image(image_bytes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))