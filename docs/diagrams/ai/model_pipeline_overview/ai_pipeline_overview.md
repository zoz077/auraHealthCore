# AI Diagnostic Pipeline Overview

Illustrates the end-to-end processing pipeline from patient admission through clinical data ingestion, domain-specific preprocessing, neural network inference, post-processing, and physician attribution.

```mermaid
flowchart TD
    subgraph S1["1. Clinical Context & Patient Identification"]
        Pat[Patient Presenting at Clinic] --> Sel[Doctor Selects Patient Context via WorkstationPatientSelector]
    end

    subgraph S2["2. Multimodal Data Ingestion"]
        Sel --> Ingest{Clinical Modality Ingestion}
        Ingest -->|Radiographic Images| ImgIn[X-Ray / MRI / Ultrasound / CT Scan File]
        Ingest -->|Bio-Signals| SigIn[ECG Array / EEG Voltage Signal]
        Ingest -->|Acoustic Data| AudIn[Respiratory Auscultation WAV Audio]
        Ingest -->|Hemodynamic / Lab Vitals| TabIn[Heart Rate, SpO2, BP, Temp, Creatinine, EF]
    end

    subgraph S3["3. Specialized Preprocessing"]
        ImgIn --> ImgPrep[Resize: 224x224 / 256x256 / 640x640<br/>ImageNet RGB Normalization / Grayscale]
        SigIn --> SigPrep[1D Signal Resample, Squeeze/Unsqueeze (1, C, L)]
        AudIn --> AudPrep[Librosa 16kHz 5s Trim/Pad, Mel-Spectrogram (128 mels), Power-to-dB, RGB Image]
        TabIn --> TabPrep[Feature Engineering: Ratios, Scaler.transform via joblib/npz]
    end

    subgraph S4["4. Department Neural & Statistical Modeling"]
        ImgPrep --> DeepVision{Domain Model Dispatch}
        SigPrep --> DeepSignal{Signal Model Dispatch}
        AudPrep --> DeepAudio{Audio Model Dispatch}
        TabPrep --> DeepTabular{Tabular Model Dispatch}

        DeepVision -->|Orthopedics X-Ray| YOLO_Ortho[YOLOv8n best.pt (7 Bone Anomaly Classes)]
        DeepVision -->|Orthopedics MRI| Keras_Ortho[Keras 3 MobileNetV2 + U-Net Segmentation]
        DeepVision -->|Neurology Brain MRI| SMP_UNet[SMP U-Net ResNet34 (Dice 92.08%)]
        DeepVision -->|Neurology Alzheimer| EffNet_Alz[EfficientNet-B0 (4 Stages)]
        DeepVision -->|Neurology Spine| Dense_Spine[DenseNet121 (Val Acc 96.11%)]
        DeepVision -->|Neurology Face/Spiral| MobNet_Face[MobileNetV3 Asymmetry + ResNet18 Spiral]
        DeepVision -->|Pulmonology X-Ray/CT/US| Timm_Pulm[EffNetV2 + ConvNeXt + DenseNet121]
        
        DeepSignal -->|Cardiology ECG| ResNet_1D[1D CNN ResNet (5 MIT-BIH Classes)]
        DeepSignal -->|Neurology EEG| CNN_EEG[EEGConvNet 1D (2 Seizure Classes)]
        
        DeepAudio -->|Pulmonology Sounds| ResNet_Audio[ResNet34 Audio (6 Respiratory Classes)]
        
        DeepTabular -->|ICU Critical Care| XGB_ICU[XGBoost Clinical Risk Classifier]
        DeepTabular -->|Pulmonology Vitals| XGB_Vitals[XGBoost Vital Signs Classifier]
        DeepTabular -->|Neurology Vision Exam| MLP_Vision[VisionExamNet 22-Feature MLP]
    end

    subgraph S5["5. Post-Processing & Clinical Findings Generation"]
        YOLO_Ortho --> PostProc[Non-Maximum Suppression (NMS), Sigmoid Thresholding, Mask Overlays, Softmax Probabilities]
        Keras_Ortho --> PostProc
        SMP_UNet --> PostProc
        EffNet_Alz --> PostProc
        Dense_Spine --> PostProc
        MobNet_Face --> PostProc
        Timm_Pulm --> PostProc
        ResNet_1D --> PostProc
        CNN_EEG --> PostProc
        ResNet_Audio --> PostProc
        XGB_ICU --> PostProc
        XGB_Vitals --> PostProc
        MLP_Vision --> PostProc
        
        PostProc --> Findings[Clinical Findings: Diagnosis, Risk Level, Confidence %, Annotated Visual Overlay]
    end

    subgraph S6["6. Doctor Verification & EHR Commitment"]
        Findings --> DocRev{Attending Physician Evaluation}
        DocRev -- Approved --> Save[Commit to Patient Electronic Health Record (EHR)]
        Save --> RecDB[(MedicalRecordDB: patient_id, doctor_id, modality, model_name, confidence, details)]
        Save --> AudDB[(AuditLogDB: user_id, patient_id, timestamp, model_name, summary)]
        Save --> NotifWS[WebSocket Notification Dispatched to Patient]
    end
```
