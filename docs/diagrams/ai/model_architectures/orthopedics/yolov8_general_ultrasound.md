# General Ultrasound YOLOv8 Kidney Anomaly Detector Architecture

## Metadata
- **Model Name:** Ultrasound YOLOv8 Anomaly Detector
- **Department:** Orthopedics / General Imaging
- **Task:** Sonographic Kidney Stone & Tissue Localization
- **Model File:** `yolov8_ultrasound.pt`
- **Framework:** Ultralytics YOLOv8 (PyTorch)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Ultrasound B-Mode Sonogram Scan"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Letterbox Resize: (640, 640) RGB"]
        P1 --> P2["Pixel Normalization"]
    end

    subgraph BackboneStage["3. YOLOv8 Architecture"]
        P2 --> BB["CSPDarknet Backbone (P1-P5) + PANet Feature Fusion"]
        BB --> HEAD["Dual-Class Detection Heads (P3, P4, P5)"]
    end

    subgraph PostProcStage["4. Post-Processing"]
        HEAD --> NMS["Non-Maximum Suppression (Conf >= 0.25)"]
    end

    subgraph OutputStage["5. Output Findings"]
        NMS --> OUT["Sonographic Detections across 2 Classes:<br/>0: kidney-stone (HIGH_RISK)<br/>1: normal kidney (LOW_RISK)<br/>Bounding Boxes, Confidence %, Annotated Visual Scan"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Model metadata inspected from `backend/app/models/yolov8_ultrasound.pt` (`ultrasound_service.py`).
