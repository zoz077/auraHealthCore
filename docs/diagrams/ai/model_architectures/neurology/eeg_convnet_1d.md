# EEG 1D ConvNet Epilepsy Classifier Architecture

## Metadata
- **Model Name:** EEG ConvNet 1D
- **Department:** Neurology & Brain
- **Task:** 1D EEG Electroencephalogram Seizure Activity Detection
- **Model File:** `eeg_model.pth`
- **Framework:** PyTorch Custom 1D Convolutional Neural Network (`EEGConvNet`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Input Stage"]
        IN["1D EEG Voltage Waveform Signal Array"]
    end

    subgraph PreprocStage["2. Signal Preprocessing"]
        IN --> P1["Cast to float32 NumPy array"]
        P1 --> P2["Tensor Unsqueeze: Shape (1, 1, Signal_Length)"]
    end

    subgraph ConvBlocks["3. 1D Convolutional Feature Extractor"]
        P2 --> B1["Block 1: Conv1d(1 -> 32, k=7, p=3) + BN + ReLU + MaxPool1d(2)"]
        B1 --> B2["Block 2: Conv1d(32 -> 64, k=5, p=2) + BN + ReLU + MaxPool1d(2)"]
        B2 --> B3["Block 3: Conv1d(64 -> 128, k=3, p=1) + BN + ReLU + AdaptiveAvgPool1d(1)"]
    end

    subgraph FlattenStage["4. Flattening"]
        B3 --> FL["Flatten: 128-dimensional latent vector"]
    end

    subgraph ClassifierStage["5. Fully Connected Classifier"]
        FL --> FC1["Linear(128 -> 64)"]
        FC1 --> RELU["ReLU Activation"]
        RELU --> DROP["Dropout(p=0.3)"]
        DROP --> FC2["Linear(64 -> 2)"]
        FC2 --> SM["Softmax Activation"]
    end

    subgraph OutputStage["6. Output Finding"]
        SM --> OUT["Diagnostic Output:<br/>Class 0: Normal / Healthy Activity<br/>Class 1: Seizure Activity<br/>Confidence % & is_seizure Flag"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** Class definition `EEGConvNet` in `backend/app/services/neurology_service.py`.
