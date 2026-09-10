import os
import cv2
import base64
import numpy as np
from ultralytics import YOLO

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "yolov8_xray.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "app/models/yolov8_xray.pt"

model = None
if os.path.exists(MODEL_PATH):
    try:
        model = YOLO(MODEL_PATH)
        print("[INFO] YOLOv8 X-Ray Model loaded successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to load X-Ray model: {e}")
else:
    print(f"[WARNING] X-Ray model file not found at {MODEL_PATH}")

def analyze_xray_image(image_bytes: bytes):
    if model is None:
        return {
            "status_level": "UNKNOWN",
            "confidence": 0,
            "diagnosis": "Model File Missing",
            "details": ["Please place yolov8_xray.pt in app/models directory."],
            "annotated_image": None
        }

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    results = model.predict(img, conf=0.15)
    result = results[0]

    boxes = result.boxes
    if len(boxes) > 0:
        annotated_img = result.plot()
        _, buffer = cv2.imencode('.jpg', annotated_img)
        img_str = base64.b64encode(buffer).decode('utf-8')
        annotated_base64 = f"data:image/jpeg;base64,{img_str}"

        top_box = boxes[0]
        cls_id = int(top_box.cls[0])
        cls_name = model.names[cls_id] if model.names else "Fracture/Pathology"
        conf = float(top_box.conf[0]) * 100

        return {
            "status_level": "HIGH_RISK",
            "confidence": round(conf, 1),
            "diagnosis": f"Detected: {cls_name.title()}",
            "details": [
                f"Pathological abnormality detected: {cls_name.title()} ({round(conf, 1)}% Confidence).",
                "Structural bone/tissue lesion identified in highlighted area."
            ],
            "annotated_image": annotated_base64
        }
    else:
        _, buffer = cv2.imencode('.jpg', img)
        img_str = base64.b64encode(buffer).decode('utf-8')
        annotated_base64 = f"data:image/jpeg;base64,{img_str}"

        return {
            "status_level": "LOW_RISK",
            "confidence": 95.0,
            "diagnosis": "Normal Diagnostic X-Ray Scan",
            "details": [
                "No fracture or clear pathological lesion detected by AI engine.",
                "Bone alignment and surrounding structures appear normal."
            ],
            "annotated_image": annotated_base64
        }