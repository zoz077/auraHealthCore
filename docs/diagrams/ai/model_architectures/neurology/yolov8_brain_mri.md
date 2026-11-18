# YOLOv8 Brain MRI Lesion Detector Architecture

## Metadata
- **Model Name:** YOLOv8 Brain MRI Object Detector
- **Department:** Neurology & Brain
- **Task:** Brain Tumor Localization & Bounding Box Detection
- **Model File:** `yolov8_mri.pt`
- **Framework:** Ultralytics YOLOv8 (PyTorch)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Brain MRI Scan Image"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Letterbox Resize: (640, 640)"]
        P1 --> P2["Pixel Normalization [0, 1]"]
    end

    subgraph BackboneStage["3. YOLOv8 Backbone (CSPDarknet53 Modified)"]
        P2 --> B0["Conv P1 (3 -> 16, k=3, s=2)"]
        B0 --> B1["Conv P2 + C2f Block"]
        B1 --> B2["Conv P3 + C2f Block (Feature Map P3: 80x80)"]
        B2 --> B3["Conv P4 + C2f Block (Feature Map P4: 40x40)"]
        B3 --> B4["Conv P5 + C2f + SPPF (Spatial Pyramid Pooling Fast, 20x20)"]
    end

    subgraph NeckStage["4. Path Aggregation Network (PANet Neck)"]
        B4 --> N1["Upsample + Concat with P4 + C2f"]
        N1 --> N2["Upsample + Concat with P3 + C2f (Small Lesion Scale)"]
        N2 --> N3["Downsample + Concat with P4 + C2f (Medium Lesion Scale)"]
        N3 --> N4["Downsample + Concat with P5 + C2f (Large Lesion Scale)"]
    end

    subgraph HeadStage["5. Decoupled Detection Heads (P3, P4, P5)"]
        N2 --> H1["Detection Head P3 (Small)"]
        N3 --> H2["Detection Head P4 (Medium)"]
        N4 --> H3["Detection Head P5 (Large)"]
        H1 --> DEC["Decoupled Regression (BBoxes) & Classification (Scores)"]
        H2 --> DEC
        H3 --> DEC
    end

    subgraph PostProcStage["6. Post-Processing"]
        DEC --> NMS["Non-Maximum Suppression (IoU Threshold: 0.45, Conf: 0.25)"]
    end

    subgraph OutputStage["7. Output"]
        NMS --> OUT["Detected Brain Lesions across 4 Classes:<br/>0: Glioma<br/>1: Meningioma<br/>2: Normal<br/>3: Pituitary<br/>Coordinates [x1, y1, x2, y2], Confidence %, Annotated Image"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Model metadata inspected from `backend/app/models/yolov8_mri.pt`.
