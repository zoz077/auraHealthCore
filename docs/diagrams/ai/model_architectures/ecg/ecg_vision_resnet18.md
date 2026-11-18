# ECG 12-Lead Vision ResNet-18 Classifier Architecture

## Metadata
- **Model Name:** ECG Vision ResNet-18
- **Department:** Cardiology
- **Task:** 12-Lead ECG Paper Strip Visual Image Classification
- **Model File:** `ecg_vision_resnet18_best.pth`
- **Framework:** PyTorch (`torchvision.models.resnet18` with 5-class FC head)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["ECG 12-Lead Paper Strip / Monitor Graph Scan Image"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Convert to RGB"]
        P1 --> P2["Resize: (224, 224)"]
        P2 --> P3["ToTensor()"]
        P3 --> P4["ImageNet Normalization<br/>Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]"]
        P4 --> P5["Batch Tensor: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. ResNet-18 Feature Extractor"]
        P5 --> BB["ResNet-18 Residual Layers 1-4 (512 output channels)"]
        BB --> GAP["AdaptiveAvgPool2d((1, 1)) -> 512-dim vector"]
    end

    subgraph HeadStage["4. Classifier Head"]
        GAP --> FC["Linear(in_features=512, out_features=5)"]
        FC --> SM["Softmax Activation"]
    end

    subgraph OutputStage["5. Output Diagnoses"]
        SM --> OUT["5 Cardiac Pathology Classes:<br/>0: Arrhythmia with Heart Block (AHB)<br/>1: COVID-19 Cardiac Manifestation<br/>2: History of Myocardial Infarction (HMI)<br/>3: Acute Myocardial Infarction (MI)<br/>4: Normal ECG<br/>Confidence % & Probability Distribution"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** `build_resnet18_model` in `backend/app/services/ecg_service.py`.
