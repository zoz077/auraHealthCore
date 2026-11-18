# Vital Signs XGBoost Risk Classifier Architecture

## Metadata
- **Model Name:** Vital Signs Clinical Risk Classifier
- **Department:** Pulmonology (Respiratory)
- **Task:** 4-Feature Hemodynamic & Respiratory Decompensation Assessment
- **Model File:** `vital_signs_xgb.json` (Preprocessor: `vital_signs_preprocessors.joblib`)
- **Framework:** XGBoost & Scikit-Learn (`xgb.XGBClassifier`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Vital Signs Inputs"]
        I1["Oxygen Saturation - SpO2 (%)"]
        I2["Body Temperature - Temp (°C)"]
        I3["Heart Rate - HR (bpm)"]
        I4["Respiratory Rate - RR (breaths/min)"]
    end

    subgraph DFStage["2. DataFrame Construction"]
        I1 & I2 & I3 & I4 --> DF["Construct Pandas DataFrame: ['spo2', 'temp', 'heart_rate', 'resp_rate']"]
    end

    subgraph PreprocStage["3. Joblib Preprocessor Pipeline"]
        DF --> SC["vital_signs_preprocessors.joblib -> Scaler Transformation"]
    end

    subgraph ModelStage["4. XGBoost Inference"]
        SC --> XGB["XGBClassifier.load_model('vital_signs_xgb.json')"]
        XGB --> PRED["Inference Output: Class Prediction & Risk Probabilities"]
    end

    subgraph OutputStage["5. Output"]
        PRED --> OUT["Risk Stratification, Acuity Category, Clinical Alert Indicators"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Evaluation metric not available in project.
- **Results Source:** `vital_signs_xgb.json` inspected from `backend/app/models/vital_signs_xgb.json`.
