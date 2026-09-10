import os
import joblib
import numpy as np

# تحديد مسارات النماذج
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "icu_xgb_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "icu_xgb_scaler.pkl")

# تحميل النموذج والـ Scaler
try:
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    print("✅ ICU XGBoost Model & Scaler loaded successfully!")
except Exception as e:
    model = None
    scaler = None
    print(f"⚠️ Warning: ICU Model files not loaded correctly: {e}")


def predict_icu_risk(age: float, ef: float, bp: int, creatinine: float, sodium: float):
    if model is None or scaler is None:
        raise ValueError("Model files are missing. Please run train_icu script first.")

    # حساب الميزات المتقدمة
    renal_cardiac_ratio = creatinine / (ef + 1e-5)
    age_sodium_index = age / (sodium + 1e-5)

    # ترتيب الميزات للنموذج
    raw_inputs = np.array([[
        age, 0, 250, 0, ef, bp, 250000, creatinine, sodium, 1, 0, 
        renal_cardiac_ratio, age_sodium_index
    ]])

    scaled_inputs = scaler.transform(raw_inputs)
    risk_prob = float(model.predict_proba(scaled_inputs)[0][1] * 100.0)

    # تحديد المستوى الطبي والتوصيات
    if risk_prob >= 50.0 or ef < 30 or creatinine >= 2.5:
        status_level = "HIGH"
        details = [
            "🚨 CRITICAL ALERT: High probability of acute deterioration detected.",
            "Protocol: Immediate ICU admission and continuous hemodynamics monitoring.",
            "Action: Alert the call physician & prepare ventilator support if needed."
        ]
    elif risk_prob >= 25.0:
        status_level = "MODERATE"
        details = [
            "⚠️ WARNING: Moderate risk factor elevation observed.",
            "Protocol: Inpatient observation ward admission.",
            "Action: Re-check serum creatinine and cardiac biomarkers in 12 hours."
        ]
    else:
        status_level = "NORMAL"
        details = [
            "🟢 STABLE: Patient clinical indicators are within safe baseline.",
            "Protocol: Low risk of critical heart failure events.",
            "Action: Discharge or standard outpatient care regimen."
        ]

    return {
        "risk_score": round(risk_prob, 2),
        "status_level": status_level,
        "details": details
    }