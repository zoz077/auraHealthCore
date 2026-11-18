# Neuro Imaging 4-Class Tumor Classifier Architecture

## Metadata
- **Model Name:** Neuro Imaging Brain Tumor Classifier
- **Department:** Neurology & Brain
- **Task:** 4-Class Brain Tumor Categorization
- **Model File:** `neuro_imaging_model.pth`
- **Framework:** PyTorch (`torchvision.models.resnet18`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Axial Brain MRI Image"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Convert to RGB"]
        P1 --> P2["Resize: (224, 224)"]
        P2 --> P3["ToTensor()"]
        P3 --> P4["ImageNet Normalization<br/>Mean: [0.485, 0.456, 0.406]<br/>Std: [0.229, 0.224, 0.225]"]
        P4 --> P5["Batch Dim: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. ResNet-18 Backbone (Feature Extractor)"]
        P5 --> C1["Conv1: 7x7, 64, stride 2 + BN + ReLU"]
        C1 --> MP["MaxPool: 3x3, stride 2"]
        MP --> L1["Layer 1: 2 BasicBlocks (64 channels)"]
        L1 --> L2["Layer 2: 2 BasicBlocks (128 channels)"]
        L2 --> L3["Layer 3: 2 BasicBlocks (256 channels)"]
        L3 --> L4["Layer 4: 2 BasicBlocks (512 channels)"]
    end

    subgraph PoolingStage["4. Global Pooling & Classifier"]
        L4 --> GAP["AdaptiveAvgPool2d((1, 1)) -> 512-dim vector"]
        GAP --> FC["Linear(in_features=512, out_features=4)"]
        FC --> SM["Softmax Activation across 4 Classes"]
    end

    subgraph OutputStage["5. Post-Processing & Output"]
        SM --> OUT["Predicted Class & Probabilities:<br/>0: Glioma Tumor<br/>1: Meningioma Tumor<br/>2: No Tumor<br/>3: Pituitary Tumor<br/>Confidence % = max(Probabilities)"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Architecture inspected from state_dict (122 tensor layers, fc weight: 4x512).
