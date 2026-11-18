# Spine Neuropathy ResNet-18 Binary Classifier Architecture

## Metadata
- **Model Name:** Spine ResNet-18 Binary Classifier (Legacy Backup)
- **Department:** Neurology & Brain
- **Task:** Binary Spinal Pathology Detection
- **Model File:** `spine_neuropathy_model.pth`
- **Framework:** PyTorch (`torchvision.models.resnet18`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Spine MRI Sagittal Scan"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["RGB Conversion, Resize (224, 224), ImageNet Normalize"]
        P1 --> P2["Tensor: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. ResNet-18 Backbone"]
        P2 --> BB["ResNet-18 4 Layer Stages (512-dim output)"]
        BB --> GAP["AdaptiveAvgPool2d((1, 1))"]
    end

    subgraph HeadStage["4. Binary Head"]
        GAP --> FC["Linear(512 -> 1)"]
        FC --> SIG["Sigmoid Activation"]
    end

    subgraph OutputStage["5. Output"]
        SIG --> OUT["Binary Output: Pathology Detected vs Normal Spine (Threshold: 0.5)"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** `spine_model` definition in `backend/app/services/neurology_service.py`.
