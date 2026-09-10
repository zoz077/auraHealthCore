from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.xray_service import analyze_xray_image

router = APIRouter(prefix="/api/xray", tags=["X-Ray"])

@router.post("/detect")
async def detect_xray(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = analyze_xray_image(image_bytes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))