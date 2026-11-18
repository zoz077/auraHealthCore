# Vision Exam Tabular MLP Classifier Architecture

## Metadata
- **Model Name:** Vision Exam Net
- **Department:** Neurology & Brain
- **Task:** Multi-Parameter Visual Field Defect Detection
- **Model File:** `vision_exam_model.pth`
- **Framework:** PyTorch (`VisionExamNet` Multi-Layer Perceptron)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["22 Clinical Visual Field & Optic Examination Features"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Array Padding / Truncation to exactly 22 float32 values"]
        P1 --> P2["Tensor Conversion: (1, 22)"]
    end

    subgraph MLPStage["3. Multi-Layer Perceptron Layers"]
        P2 --> L1["Linear(22 -> 128)"]
        L1 --> BN1["BatchNorm1d(128)"]
        BN1 --> R1["ReLU Activation"]
        R1 --> D1["Dropout(p=0.3)"]

        D1 --> L2["Linear(128 -> 64)"]
        L2 --> BN2["BatchNorm1d(64)"]
        BN2 --> R2["ReLU Activation"]
        R2 --> D2["Dropout(p=0.3)"]

        D2 --> L3["Linear(64 -> 2)"]
        L3 --> SM["Softmax Activation"]
    end

    subgraph OutputStage["4. Output"]
        SM --> OUT["Classification:<br/>0: Normal Vision Exam<br/>1: Abnormal / Visual Field Defect<br/>Confidence %"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Inspected from `VisionExamNet` definition in `backend/app/services/neurology_service.py`.
