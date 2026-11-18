# EEG Vision Waveform Strip Classifier Architecture

## Metadata
- **Model Name:** EEG Waveform Vision Classifier
- **Department:** Neurology & Brain
- **Task:** Visual 2D EEG Strip Seizure Pattern Recognition
- **Model File:** `eeg_image_vision_model.pth`
- **Framework:** PyTorch (`torchvision.models.resnet18` with custom FC head)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Rendered 2D EEG Waveform Strip Image"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Convert to RGB"]
        P1 --> P2["Resize: (224, 224)"]
        P2 --> P3["ToTensor() + ImageNet Normalization"]
        P3 --> P4["Batch Unsqueeze: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. ResNet-18 Backbone"]
        P4 --> BB["ResNet-18 Feature Extractor (Conv1, Layer1-4) -> 512 channels"]
        BB --> GAP["AdaptiveAvgPool2d((1, 1)) -> 512-dim feature vector"]
    end

    subgraph HeadStage["4. Custom Sequential Classifier Head"]
        GAP --> FC1["Linear(512, 128)"]
        FC1 --> RELU["ReLU Activation"]
        RELU --> DROP["Dropout(p=0.3)"]
        DROP --> FC2["Linear(128, 2)"]
        FC2 --> SM["Softmax Activation"]
    end

    subgraph OutputStage["5. Output"]
        SM --> OUT["Diagnosis:<br/>- Normal Waveform (Class 0)<br/>- Seizure Waveform (Class 1)<br/>Confidence %, has_seizure flag, Risk Level"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Inspected from `eeg_image_model` definition in `backend/app/services/neurology_service.py`.
