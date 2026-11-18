# Orthopedics YOLOv8 Bone Fracture Detector Architecture

## Metadata
- **Model Name:** Orthopedics Bone Radiograph Fracture Detector
- **Department:** Orthopedics
- **Task:** Multi-Class Anatomical Bone Fracture Localization & Object Detection
- **Model File:** `best.pt` (Backup Checkpoint: `last.pt`)
- **Framework:** Ultralytics YOLOv8n (8.4.150) PyTorch Checkpoint
- **Checkpoint Relationship:** `best.pt` and `last.pt` originate from the same 50-epoch training run; `best.pt` selected for peak validation fitness at epoch 25.

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Skeletal X-Ray Radiograph (Limb / Joint / Trunk)"]
    end

    subgraph PreprocStage["2. Image Preprocessing"]
        IN --> P1["Image Matrix Decoding (cv2.imdecode)"]
        P1 --> P2["Extract Original Dimensions (Width, Height)"]
        P2 --> P3["Letterbox Resize: (640, 640)"]
        P3 --> P4["Normalization: Pixel Scale [0, 1]"]
    end

    subgraph BackboneStage["3. YOLOv8n Backbone (Modified CSPDarknet)"]
        P4 --> B0["P1/2: Conv 3x3, 16 channels, stride 2"]
        B0 --> B1["P2/4: Conv 3x3 + C2f Block (32 channels)"]
        B1 --> B2["P3/8: Conv 3x3 + C2f Block (64 channels) -> Small Bounding Box Features"]
        B2 --> B3["P4/16: Conv 3x3 + C2f Block (128 channels) -> Medium Bounding Box Features"]
        B3 --> B4["P5/32: Conv 3x3 + C2f Block (256 channels) + SPPF (Spatial Pyramid Pooling Fast)"]
    end

    subgraph NeckStage["4. Neck (PANet Path Aggregation Network)"]
        B4 --> N1["Upsample + Concatenate with P4 + C2f"]
        N1 --> N2["Upsample + Concatenate with P3 + C2f (Scale P3)"]
        N2 --> N3["Downsample + Concatenate with P4 + C2f (Scale P4)"]
        N3 --> N4["Downsample + Concatenate with P5 + C2f (Scale P5)"]
    end

    subgraph HeadStage["5. Decoupled Anchor-Free Detection Heads"]
        N2 --> H1["Head P3 (Fine-Grained Small Fractures)"]
        N3 --> H2["Head P4 (Medium Bone Fractures)"]
        N4 --> H3["Head P5 (Large Bone / Joint Fractures)"]
        H1 & H2 & H3 --> DEC["Decoupled Regression (Box IoU loss) & Classification (BCE loss)"]
    end

    subgraph PostProcStage["6. Post-Processing & Filtering"]
        DEC --> NMS["Non-Maximum Suppression (NMS, Conf Threshold >= 0.15)"]
        NMS --> DRAW["OpenCV Bounding Box Plotting & Label Stamping"]
        DRAW --> B64["Base64 JPEG Encoding for Frontend Visualization"]
    end

    subgraph OutputStage["7. Clinical Detections Output"]
        B64 --> OUT["Detected Skeletal Anomalies across 7 Classes:<br/>0: elbow positive<br/>1: fingers positive<br/>2: forearm fracture<br/>3: humerus fracture<br/>4: humerus<br/>5: shoulder fracture<br/>6: wrist positive<br/>Coordinates [x1, y1, x2, y2], Top Confidence %, Annotated Visual Overlay Base64"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Validation Evaluation (Epoch 25 Peak Fitness Checkpoint)
- **Evaluation Dataset:** Bone Fracture Radiograph Validation Set
- **Actual Results:**
  - **mAP50:** `29.89%`
  - **mAP50-95:** `10.28%`
  - **Precision:** `33.02%`
  - **Recall:** `31.30%`
- **Results Source:** Embedded training checkpoint metadata in `best.pt` (`orthopedics_service.py` L78-84).
- **Clinical Disclaimer:** AI decision-support output only. Not a definitive medical diagnosis. Clinical correlation by a licensed radiologist or orthopedic specialist is required.
