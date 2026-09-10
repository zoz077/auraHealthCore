import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
from sklearn.metrics import accuracy_score, classification_report

# 1. تحميل الداتا سيت الكاملة
DATASET_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00519/heart_failure_clinical_records_dataset.csv"
df = pd.read_csv(DATASET_URL)

# 2. هندسة ميزات طبية جديدة (Feature Engineering)
df['renal_cardiac_index'] = df['serum_creatinine'] / (df['ejection_fraction'] + 1e-5)
df['age_creatinine_ratio'] = df['age'] * df['serum_creatinine']

X = df.drop(columns=['DEATH_EVENT', 'time']) # استخدام كافّة الميزات الطبية
y = df['DEATH_EVENT']

# 3. تقسيم البيانات وموازنتها بـ SMOTE
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

smote = SMOTE(random_state=42)
X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train_resampled)
X_test_scaled = scaler.transform(X_test)

# 4. تدريب نموذج XGBoost عالي الأداء
model = XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.03,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42
)
model.fit(X_train_scaled, y_train_resampled)

# 5. التقييم وحفظ النموذج
y_pred = model.predict(X_test_scaled)
acc = accuracy_score(y_test, y_pred) * 100

print(f"🚀 New Model Accuracy: {acc:.2f}%")
print("\n📋 Detailed Classification Report:\n", classification_report(y_test, y_pred))

# حفظ النموذج والـ Scaler
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "models")
os.makedirs(MODELS_DIR, exist_ok=True)
joblib.dump(model, os.path.join(MODELS_DIR, "icu_xgb_model.pkl"))
joblib.dump(scaler, os.path.join(MODELS_DIR, "icu_xgb_scaler.pkl"))