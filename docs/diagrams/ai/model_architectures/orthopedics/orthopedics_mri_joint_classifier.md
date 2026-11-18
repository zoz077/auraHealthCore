# Orthopedics MRI Joint Pathology Classifier Architecture

## Metadata
- **Model Name:** Orthopedics MRI Joint Abnormality Classifier
- **Department:** Orthopedics
- **Task:** Binary Joint Structural Abnormality & Focal Lesion Screening
- **Model File:** `mri_classifier.keras`
- **Framework:** Keras 3 with PyTorch Backend (`keras.src.models.sequential.Sequential`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Orthopedic Joint MRI Scan (Knee / Shoulder / Ankle)"]
    end

    subgraph PreprocStage["2. Preprocessing Pipeline"]
        IN --> P1["Decode Image Matrix (cv2.imdecode)"]
        P1 --> P2["Color Conversion BGR -> RGB"]
        P2 --> P3["Resize: (128, 128)"]
        P3 --> P4["Normalization: float32 / 255.0 to [0.0, 1.0]"]
        P4 --> P5["Tensor Reshape: (1, 128, 128, 3)"]
    end

    subgraph BackboneStage["3. Transfer Learning Backbone (MobileNetV2)"]
        P5 --> BB["mobilenetv2_1.00_128 Base Model<br/>- Inverted Residual Bottlenecks<br/>- Depthwise Separable Convolutions<br/>- Linear Bottlenecks"]
    end

    subgraph HeadStage["4. Pooling & Dense Classification Head"]
        BB --> GAP["global_average_pooling2d Layer -> 1280-dim feature vector"]
        GAP --> DROP["dropout Layer (rate=0.2)"]
        DROP --> D1["dense Layer: Dense(64, activation='relu')"]
        D1 --> D2["dense_1 Layer: Dense(1, activation='sigmoid')"]
    end

    subgraph PostProcStage["5. Post-Processing & Thresholding"]
        D2 --> PROB["Extract Probability scalar in [0.0, 1.0]"]
        PROB --> THRESH{Probability >= 0.5?}
        THRESH -- Yes --> ABN["Status: HIGH_RISK<br/>Diagnosis: Suspected Joint Abnormality / Pathology Detected<br/>Confidence: prob * 100"]
        THRESH -- No --> NORM["Status: LOW_RISK<br/>Diagnosis: Unremarkable Joint Architecture<br/>Confidence: (1.0 - prob) * 100"]
    end

    subgraph OutputStage["6. Output"]
        ABN & NORM --> OUT["JSON Findings, Acuity Level, Confidence Score %, Preview Image Base64"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available from the supplied artifacts.
- **Results Source:** Architecture verified from `mri_classifier.keras` layer inspection and `orthopedics_service.py`.
- **Clinical Disclaimer:** AI decision-support output only. Not a definitive medical diagnosis. Clinical correlation by a licensed radiologist or orthopedic specialist is required.
