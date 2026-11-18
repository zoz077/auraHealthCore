# Brain Tumor U-Net Segmentation Architecture

## Metadata
- **Model Name:** Brain Tumor Segmentation U-Net
- **Department:** Neurology & Brain
- **Task:** Focal Brain Tumor & Lesion Semantic Segmentation
- **Model File:** `brain_tumor_segmentation_unet (1).pth` (Backup: `brain_tumor_segmentation_unet.pth`)
- **Framework:** PyTorch (`segmentation_models_pytorch.Unet`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["Input Brain MRI Scan (DICOM / JPEG / PNG)"]
    end

    subgraph PreprocStage["2. Preprocessing Pipeline"]
        IN --> P1["Image Conversion to RGB (3 Channels)"]
        P1 --> P2["Resize: (256, 256)"]
        P2 --> P3["ToTensor() Conversion: (3, 256, 256)"]
        P3 --> P4["ImageNet Normalization<br/>Mean: [0.485, 0.456, 0.406]<br/>Std: [0.229, 0.224, 0.225]"]
        P4 --> P5["Batch Unsqueeze: (1, 3, 256, 256)"]
    end

    subgraph EncoderStage["3. Encoder Backbone (ResNet-34)"]
        P5 --> E0["Conv1: 7x7, 64, stride 2 + MaxPool"]
        E0 --> E1["Layer 1: 3 Residual Blocks (64 channels)"]
        E1 --> E2["Layer 2: 4 Residual Blocks (128 channels)"]
        E2 --> E3["Layer 3: 6 Residual Blocks (256 channels)"]
        E3 --> E4["Layer 4: 3 Residual Blocks (512 channels)"]
    end

    subgraph BottleneckStage["4. Bottleneck"]
        E4 --> B0["Deep Feature Representation (512 channels, 8x8)"]
    end

    subgraph DecoderStage["5. Decoder with Skip Connections"]
        B0 --> D4["Decoder Block 4 (256 channels) + Skip from Layer 3"]
        E3 -. Skip Connection .-> D4
        D4 --> D3["Decoder Block 3 (128 channels) + Skip from Layer 2"]
        E2 -. Skip Connection .-> D3
        D3 --> D2["Decoder Block 2 (64 channels) + Skip from Layer 1"]
        E1 -. Skip Connection .-> D2
        D2 --> D1["Decoder Block 1 (32 channels) + Skip from Conv1"]
        E0 -. Skip Connection .-> D1
    end

    subgraph HeadStage["6. Segmentation Head"]
        D1 --> SH["Conv2D (32 -> 1, kernel 3x3)"]
        SH --> ACT["Sigmoid Activation"]
    end

    subgraph PostProcStage["7. Post-Processing"]
        ACT --> PP1["Thresholding: Probability > 0.5 -> Binary Mask"]
        PP1 --> PP2["Tumor Pixel Counting (Sum > 35 pixels threshold)"]
        PP2 --> PP3["Tumor Area Percentage Calculation"]
        PP3 --> PP4["Mean Lesion Confidence Score Calculation"]
    end

    subgraph OutputStage["8. Final Output"]
        PP4 --> OUT["Clinical Findings:<br/>- Diagnosis: Abnormal lesion detected / No segmented lesion<br/>- Tumor Area %<br/>- Model Confidence Score %<br/>- Binary Segmentation Mask Overlay"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Model Evaluation Benchmark
- **Evaluation Dataset:** Brain MRI Lesion Dataset
- **Metric Available:**
  - **Dice Score:** `92.08%`
- **Results Source:** Embedded in `backend/app/services/neurology_service.py` (`model_evaluation.score = 92.08`)
- **Clinical Disclaimer:** This AI result represents an image segmentation finding and does not determine tumor type, tumor grade, or clinical severity.
