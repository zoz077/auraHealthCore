from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.services.orthopedics_service import orthopedics_service

router = APIRouter(prefix="/api/orthopedics", tags=["Orthopedics & Joints"])

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def _validate_image_file(file: UploadFile):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )
    ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS and (file.content_type and not file.content_type.startswith("image/")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Please upload an image (JPEG, PNG, WEBP)."
        )

@router.get("/models-info")
async def get_orthopedics_models_info():
    """Retrieve metadata, architectures, classes, and evaluation disclosures for Orthopedics models."""
    return {"status": "success", "data": orthopedics_service.get_models_info()}

@router.post("/xray/detect")
@router.post("/xray-detect")
async def detect_xray_fracture(file: UploadFile = File(...)):
    """Runs radiographic bone fracture detection using best.pt."""
    _validate_image_file(file)
    try:
        image_bytes = await file.read()
        if not image_bytes or len(image_bytes) < 16:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
        result = orthopedics_service.detect_fracture(image_bytes)
        return {"status": "success", "data": result}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/mri/classify")
@router.post("/mri-classify")
async def classify_mri_joint(file: UploadFile = File(...)):
    """Runs joint abnormality screening classification using mri_classifier.keras."""
    _validate_image_file(file)
    try:
        image_bytes = await file.read()
        if not image_bytes or len(image_bytes) < 16:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
        result = orthopedics_service.classify_mri_joint(image_bytes)
        return {"status": "success", "data": result}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/mri/segment")
@router.post("/mri-segment")
async def segment_mri_joint(file: UploadFile = File(...)):
    """Runs joint lesion segmentation using mri_unet_segmentation.keras."""
    _validate_image_file(file)
    try:
        image_bytes = await file.read()
        if not image_bytes or len(image_bytes) < 16:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
        result = orthopedics_service.segment_mri_joint(image_bytes)
        return {"status": "success", "data": result}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
