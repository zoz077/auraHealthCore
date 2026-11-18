# Chest X-Ray EfficientNetV2-S Classifier Architecture

## Metadata
- **Model Name:** Lung Chest X-Ray EfficientNetV2-S
- **Department:** Pulmonology (Respiratory)
- **Task:** 4-Class Radiographic Pulmonary Pathology Classification
- **Model File:** `lung_xray_effnetv2.pth`
- **Framework:** PyTorch (`timm.create_model("tf_efficientnetv2_s", num_classes=4)`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Chest Frontal X-Ray Radiograph (AP / PA View)"]
    end

    subgraph PreprocStage["2. Preprocessing"]
        IN --> P1["Image Matrix Decoding (cv2.imdecode)"]
        P1 --> P2["Color Conversion BGR -> RGB"]
        P2 --> P3["Resize: (224, 224)"]
        P3 --> P4["ToTensor() + ImageNet Normalization<br/>Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]"]
        P4 --> P5["Batch Tensor: (1, 3, 224, 224)"]
    end

    subgraph BackboneStage["3. EfficientNetV2-S Backbone (FusedMBConv + MBConv)"]
        P5 --> S0["Stem Conv3x3 (24 channels, s=2)"]
        S0 --> S1["Stage 1: FusedMBConv1 (24 channels)"]
        S1 --> S2["Stage 2: FusedMBConv4 (48 channels, s=2)"]
        S2 --> S3["Stage 3: FusedMBConv4 (64 channels, s=2)"]
        S3 --> S4["Stage 4: MBConv4 with SE (128 channels, s=2)"]
        S4 --> S5["Stage 5: MBConv6 with SE (160 channels)"]
        S5 --> S6["Stage 6: MBConv6 with SE (256 channels, s=2)"]
        S6 --> HEAD_CONV["1x1 Conv (1280 channels)"]
    end

    subgraph HeadStage["4. Pooling & Linear Classifier"]
        HEAD_CONV --> GAP["Global Average Pooling (1280-dim vector)"]
        GAP --> FC["Linear(1280 -> 4)"]
        FC --> SM["Softmax Probability Distribution"]
    end

    subgraph OutputStage["5. Pulmonary Diagnoses"]
        SM --> OUT["4 Radiographic Classes:<br/>0: COVID<br/>1: Lung_Opacity<br/>2: Normal<br/>3: Viral Pneumonia<br/>Diagnosis, Risk Level, Confidence %, Probability Details"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** `RespiratoryService.predict_xray` in `backend/app/services/respiratory_service.py`.
