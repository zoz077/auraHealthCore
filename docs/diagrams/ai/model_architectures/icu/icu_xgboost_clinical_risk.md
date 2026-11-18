# ICU Clinical Risk XGBoost Classifier Architecture

## Metadata
- **Model Name:** ICU Clinical Deterioration & Mortality Risk Classifier
- **Department:** ICU & Critical Care
- **Task:** Hemodynamic Deterioration & ICU Admission Risk Prediction
- **Model File:** `icu_xgb_model.pkl` (Preprocessor: `icu_xgb_scaler.pkl`)
- **Framework:** Scikit-Learn & XGBoost (`XGBClassifier`)

---

## Architecture Flow

```mermaid
graph TD
    subgraph InputStage["1. Raw Clinical Inputs"]
        I1["Age (years)"]
        I2["Ejection Fraction - EF (%)"]
        I3["Systolic Blood Pressure - BP (mmHg)"]
        I4["Serum Creatinine (mg/dL)"]
        I5["Serum Sodium (mEq/L)"]
    end

    subgraph FeatureEngStage["2. Clinical Feature Engineering"]
        I2 & I4 --> FE1["Renal-Cardiac Ratio = Creatinine / (EF + 1e-5)"]
        I1 & I5 --> FE2["Age-Sodium Index = Age / (Sodium + 1e-5)"]
        I1 & I4 --> FE3["Age-Creatinine Ratio = Age * Creatinine"]
    end

    subgraph VectorAssembly["3. 13-Dimensional Feature Vector Assembly"]
        I1 & I2 & I3 & I4 & I5 & FE1 & FE2 & FE3 --> VEC["Raw Input Vector: [Age, Anaemia=0, CPK=250, Diabetes=0, EF, BP, Platelets=250k, Creatinine, Sodium, Sex=1, Smoking=0, Renal-Cardiac Ratio, Age-Sodium Index]"]
    end

    subgraph ScalingStage["4. StandardScaler Transformation"]
        VEC --> SC["StandardScaler.transform(raw_inputs) -> 13 Standardized Features"]
    end

    subgraph ModelStage["5. XGBoost Ensemble Classifier"]
        SC --> XGB["XGBClassifier<br/>- n_estimators: 200<br/>- max_depth: 4<br/>- learning_rate: 0.03<br/>- subsample: 0.8<br/>- colsample_bytree: 0.8<br/>- random_state: 42"]
        XGB --> PROB["predict_proba() -> Risk Probability [0.0% - 100.0%]"]
    end

    subgraph DecisionStage["6. Clinical Stratification & Decision Support"]
        PROB --> DEC{Risk Stratification Rules}
        DEC -->|Risk >= 50% OR EF < 30 OR Creatinine >= 2.5| HIGH["Status: HIGH / CRITICAL<br/>Action: Immediate ICU admission & continuous telemetry"]
        DEC -->|Risk >= 25%| MOD["Status: MODERATE<br/>Action: Inpatient observation & 12h cardiac biomarker repeat"]
        DEC -->|Risk < 25%| NORM["Status: NORMAL / STABLE<br/>Action: Low risk baseline outpatient regimen"]
    end
```

---

## Test & Evaluation Results
- **Evaluation Type:** Test Set Evaluation (80/20 train/test stratified split with SMOTE rebalancing)
- **Evaluation Dataset:** UCI Heart Failure Clinical Records Dataset (`heart_failure_clinical_records_dataset.csv`, 299 patient records)
- **Results Source:** `backend/scripts/train_icu.py`
- **Trained Parameters:** `n_estimators=200, max_depth=4, learning_rate=0.03`
