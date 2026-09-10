from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.mri_service import analyze_mri_image

router = APIRouter(prefix="/api/mri", tags=["MRI"])

@router.post("/detect")
async def detect_mri(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = analyze_mri_image(image_bytes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))