# Facial Paralysis & Asymmetry Vision Classifier Architecture

## Metadata
- **Model Name:** Facial Paralysis & Asymmetry Vision Model
- **Department:** Neurology & Brain
- **Task:** Cranial Nerve VII / Facial Stroke Pattern Screening
- **Model File:** `paralysis_vision_model.pth`
- **Framework:** PyTorch (`torchvision.models.mobilenet_v3_large`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Frontal Facial Photograph / Portrait Scan"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["RGB Conversion"]
        P1 --> P2["Resize: (224, 224)"]
        P2 --> P3["ToTensor() + ImageNet Normalization"]
        P3 --> P4["Batch Tensor: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. MobileNetV3-Large Feature Extractor"]
        P4 --> S0["Stem Conv3x3 (16 channels)"]
        S0 --> B1["Bneck Stages 1-15 (Depthwise Separable + Squeeze-and-Excitation + Hardswish)"]
        B1 --> S1["Final 1x1 Conv (960 channels)"]
        S1 --> GAP["AdaptiveAvgPool2d((1, 1)) -> 960-dim vector"]
    end

    subgraph HeadStage["4. Classifier Head"]
        GAP --> FC1["Linear(960 -> 256)"]
        FC1 --> HS["Hardswish Activation"]
        HS --> DROP["Dropout(p=0.3)"]
        DROP --> FC2["Linear(256 -> 2)"]
        FC2 --> SM["Softmax Activation"]
    end

    subgraph OutputStage["5. Diagnostic Findings"]
        SM --> OUT["Clinical Screening Findings:<br/>- Class 0: Normal / Non-Asymmetry<br/>- Class 1: Facial Asymmetry / Paralysis Pattern Detected<br/>Confidence %, has_asymmetry flag, Affected Zone Locator"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** `paralysis_model` definition and weights inspection in `backend/app/services/neurology_service.py`.
