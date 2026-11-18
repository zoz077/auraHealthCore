# General Radiography YOLOv8 Fracture Detector Architecture

## Metadata
- **Model Name:** General X-Ray Fracture Detector
- **Department:** Orthopedics
- **Task:** General Bone Fracture Radiographic Localization
- **Model File:** `yolov8_xray.pt`
- **Framework:** Ultralytics YOLOv8 (PyTorch)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Plain Radiograph (X-Ray)"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Letterbox Resize: (640, 640) RGB"]
        P1 --> P2["Normalized Pixel Matrix [0, 1]"]
    end

    subgraph BackboneStage["3. YOLOv8 Backbone & Neck"]
        P2 --> BB["YOLOv8 CSPDarknet Backbone (P1-P5)"]
        BB --> NECK["PANet Multi-Scale Feature Aggregator"]
    end

    subgraph HeadStage["4. Anchor-Free Head & Non-Maximum Suppression"]
        NECK --> HEAD["Single-Class Fracture Detection Head"]
        HEAD --> NMS["Non-Maximum Suppression (Confidence >= 0.15)"]
    end

    subgraph OutputStage["5. Output"]
        NMS --> OUT["Detected Bone Fractures:<br/>Class: fracture<br/>Bounding Boxes [x1, y1, x2, y2], Confidence %, Annotated Image Overlay Base64"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Model metadata inspected from `backend/app/models/yolov8_xray.pt` (`xray_service.py`).
