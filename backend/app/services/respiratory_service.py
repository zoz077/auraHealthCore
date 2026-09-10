import io
import os
import tempfile
import cv2
import joblib
import librosa
import numpy as np
import pandas as pd
import timm
import torch
import torch.nn as nn
import torchvision.transforms as T
import xgboost as xgb

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


class RespiratoryService:

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"⚡ Running Respiratory Service on: {self.device}")

        # --- 1. إعداد التحويلات المشتركة للصور ---
        self.img_tf = T.Compose([
            T.ToPILImage(),
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        # --- 2. تحميل نموذج الأشعة السينية (Chest X-Ray) ---
        self.xray_classes = ["COVID", "Lung_Opacity", "Normal", "Viral Pneumonia"]
        self.xray_model = timm.create_model(
            "tf_efficientnetv2_s", pretrained=False, num_classes=len(self.xray_classes)
        )
        self._load_torch_weights(self.xray_model, "lung_xray_effnetv2.pth")

        # --- 3. تحميل نموذج السونار (Ultrasound) ---
        self.us_classes = ["COVID-19", "Normal", "Pneumonia"]
        self.us_model = timm.create_model(
            "convnext_small", pretrained=False, num_classes=len(self.us_classes)
        )
        self._load_torch_weights(self.us_model, "lung_ultrasound_convnext.pth")

        # --- 4. تحميل نموذج المفراس (CT Scan) ---
        self.ct_classes = [
            "Adenocarcinoma",
            "Large Cell Carcinoma",
            "Squamous Cell Carcinoma",
            "Normal Lung",
        ]
        self.ct_model = timm.create_model(
            "densenet121", pretrained=False, num_classes=len(self.ct_classes)
        )
        self._load_torch_weights(self.ct_model, "lung_ctscan_densenet.pth")

        # --- 5. تحميل نموذج الأصوات (Lung Sounds) - 6 فئات ---
        self.audio_classes = [
            "COPD",
            "Healthy",
            "URTI",
            "Bronchiectasis",
            "Pneumonia",
            "Bronchiolitis",
        ]
        self.audio_model = timm.create_model(
            "resnet34", pretrained=False, num_classes=len(self.audio_classes)
        )
        self._load_torch_weights(self.audio_model, "lung_audio_multi_disease.pth")

        # --- 6. تحميل نموذج العلامات الحيوية (XGBoost + Scaler) ---
        vitals_json = os.path.join(MODELS_DIR, "vital_signs_xgb.json")
        vitals_prep = os.path.join(MODELS_DIR, "vital_signs_preprocessors.joblib")

        self.vitals_scaler = None
        self.vitals_model = None

        if os.path.exists(vitals_json) and os.path.exists(vitals_prep):
            try:
                self.vitals_scaler = joblib.load(vitals_prep)
                self.vitals_model = xgb.XGBClassifier()
                self.vitals_model.load_model(vitals_json)
                print("✅ Loaded Vital Signs XGBoost & Preprocessor")
            except Exception as e:
                print(f"❌ Failed to load Vital Signs models: {e}")
        else:
            print("⚠️ Warning: Vital signs XGBoost or Scaler model missing!")

    def _load_torch_weights(self, model: nn.Module, file_name: str):
        path = os.path.join(MODELS_DIR, file_name)
        if os.path.exists(path):
            try:
                checkpoint = torch.load(path, map_location=self.device)
                state_dict = (
                    checkpoint["model_state"]
                    if isinstance(checkpoint, dict) and "model_state" in checkpoint
                    else checkpoint
                )
                cleaned = {k.replace("module.", ""): v for k, v in state_dict.items()}
                model.load_state_dict(cleaned, strict=False)
                model.to(self.device)
                model.eval()
                print(f"✅ Loaded PyTorch Model: {file_name}")
            except Exception as e:
                print(f"❌ Failed to load weights for {file_name}: {e}")
        else:
            print(f"⚠️ Warning: Model file {file_name} not found at {path}")

    def _process_image_bytes(self, image_bytes: bytes) -> torch.Tensor:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Could not decode image bytes into a valid image matrix.")
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        return self.img_tf(img_rgb).unsqueeze(0).to(self.device)

    # ==================== 1. CT Scan ====================
    def predict_ctscan(self, image_bytes: bytes) -> dict:
        tensor_in = self._process_image_bytes(image_bytes)
        with torch.no_grad():
            out = self.ct_model(tensor_in)
            probs = torch.softmax(out, dim=1)[0].cpu().numpy()

        pred_idx = int(np.argmax(probs))
        label = self.ct_classes[pred_idx]
        confidence = float(probs[pred_idx])

        return {
            "diagnosis": f"CT-Scan Finding: {label}",
            "risk_level": "HIGH" if "Normal" not in label else "LOW",
            "confidence": confidence,
            "details": {
                self.ct_classes[i]: f"{probs[i]*100:.1f}%"
                for i in range(len(self.ct_classes))
            },
        }

    # ==================== 2. Chest X-Ray ====================
    def predict_xray(self, image_bytes: bytes) -> dict:
        tensor_in = self._process_image_bytes(image_bytes)
        with torch.no_grad():
            out = self.xray_model(tensor_in)
            probs = torch.softmax(out, dim=1)[0].cpu().numpy()

        pred_idx = int(np.argmax(probs))
        label = self.xray_classes[pred_idx]
        confidence = float(probs[pred_idx])

        return {
            "diagnosis": f"X-Ray Finding: {label}",
            "risk_level": "HIGH" if label != "Normal" else "LOW",
            "confidence": confidence,
            "details": {
                self.xray_classes[i]: f"{probs[i]*100:.1f}%"
                for i in range(len(self.xray_classes))
            },
        }

    # ==================== 3. Ultrasound ====================
    def predict_ultrasound(self, image_bytes: bytes) -> dict:
        tensor_in = self._process_image_bytes(image_bytes)
        with torch.no_grad():
            out = self.us_model(tensor_in)
            probs = torch.softmax(out, dim=1)[0].cpu().numpy()

        pred_idx = int(np.argmax(probs))
        label = self.us_classes[pred_idx]
        confidence = float(probs[pred_idx])

        return {
            "diagnosis": f"Ultrasound Finding: {label}",
            "risk_level": "HIGH" if label != "Normal" else "LOW",
            "confidence": confidence,
            "details": {
                self.us_classes[i]: f"{probs[i]*100:.1f}%"
                for i in range(len(self.us_classes))
            },
        }

    # ==================== 4. Lung Sounds (Audio) ====================
    def predict_audio(self, audio_input) -> dict:
        temp_file_path = None

        # Handling bytes, FileStorage/UploadFile buffers, or string paths
        if isinstance(audio_input, (bytes, bytearray)):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(audio_input)
                temp_file_path = tmp.name
            audio_path = temp_file_path
        elif hasattr(audio_input, "read"):
            content = audio_input.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(content)
                temp_file_path = tmp.name
            audio_path = temp_file_path
        else:
            audio_path = str(audio_input)

        try:
            y, sr = librosa.load(audio_path, sr=16000, duration=5)
            target_len = 16000 * 5
            if len(y) < target_len:
                y = np.pad(y, (0, target_len - len(y)), mode="constant")
            else:
                y = y[:target_len]

            mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
            mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
            norm_spec = cv2.normalize(mel_spec_db, None, 0, 255, cv2.NORM_MINMAX)
            img_rgb = cv2.cvtColor(np.uint8(norm_spec), cv2.COLOR_GRAY2RGB)

            tensor_in = self.img_tf(img_rgb).unsqueeze(0).to(self.device)
            with torch.no_grad():
                out = self.audio_model(tensor_in)
                probs = torch.softmax(out, dim=1)[0].cpu().numpy()

            pred_idx = int(np.argmax(probs))
            label = self.audio_classes[pred_idx]
            confidence = float(probs[pred_idx])

            return {
                "diagnosis": f"Lung Sound Finding: {label}",
                "risk_level": "HIGH" if label not in ["Normal", "Healthy"] else "LOW",
                "confidence": confidence,
                "details": {
                    self.audio_classes[i]: f"{probs[i]*100:.1f}%"
                    for i in range(len(self.audio_classes))
                },
            }
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    # ==================== 5. Vital Signs (XGBoost) ====================
    def predict_vitals(
        self, spo2: float, temp: float, heart_rate: int, resp_rate: int
    ) -> dict:
        if self.vitals_model is None or self.vitals_scaler is None:
            raise ValueError("Vital signs model or scaler is not loaded correctly.")

        input_df = pd.DataFrame([{
            "spo2": float(spo2),
            "temp": float(temp),
            "heart_rate": int(heart_rate),
            "resp_rate": int(resp_rate),
        }])

        processed_data = self.vitals_scaler.transform(input_df)
        probs = self.vitals_model.predict_proba(processed_data)[0]

        pred_idx = int(np.argmax(probs))
        confidence = float(probs[pred_idx])

        labels = ["Normal", "Abnormal / High Risk"]
        predicted_label = labels[pred_idx] if pred_idx < len(labels) else "Abnormal"

        return {
            "diagnosis": f"Vitals Evaluation: {predicted_label}",
            "risk_level": "HIGH" if pred_idx != 0 else "LOW",
            "confidence": confidence,
            "details": {
                "SpO2 Saturation": f"{spo2}%",
                "Body Temperature": f"{temp} °C",
                "Heart Rate": f"{heart_rate} BPM",
                "Respiration Rate": f"{resp_rate} RPM",
                "AI Abnormal Probability": f"{float(probs[-1])*100:.1f}%",
            },
        }


respiratory_service = RespiratoryService()