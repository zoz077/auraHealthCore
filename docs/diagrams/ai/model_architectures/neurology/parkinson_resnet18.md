# Parkinson Spiral Motor Examination Classifier Architecture

## Metadata
- **Model Name:** Parkinson Spiral Examination Model
- **Department:** Neurology & Brain
- **Task:** Spiral Drawing Motor Tremor & Parkinson Detection
- **Model File:** `parkinson_model.pth`
- **Framework:** PyTorch (`torchvision.models.resnet18` with custom FC head)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Hand-Drawn Spiral Examination Sheet Image"]
    end

    subgraph PreprocStage["2. Preprocessing Pipeline"]
        IN --> P1["Resize: (224, 224)"]
        P1 --> P2["Grayscale Conversion with 3 Output Channels"]
        P2 --> P3["ToTensor()"]
        P3 --> P4["ImageNet Normalization"]
        P4 --> P5["Batch Tensor: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. ResNet-18 Backbone"]
        P5 --> BB["ResNet-18 Residual Blocks (512-dim output)"]
        BB --> GAP["AdaptiveAvgPool2d((1, 1))"]
    end

    subgraph HeadStage["4. Custom Classifier Head"]
        GAP --> FC1["Linear(512 -> 64)"]
        FC1 --> RELU["ReLU Activation"]
        RELU --> DROP["Dropout(p=0.4)"]
        DROP --> FC2["Linear(64 -> 2)"]
        FC2 --> SM["Softmax Activation"]
    end

    subgraph OutputStage["5. Output"]
        SM --> OUT["Findings:<br/>- Healthy / Normal (Class 0)<br/>- Parkinson's Disease Detected (Class 1)<br/>Confidence % & is_parkinson Boolean Flag"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Inspected from `parkinson_img_model` definition in `backend/app/services/neurology_service.py`.
