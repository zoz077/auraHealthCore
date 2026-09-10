import io
import os
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms, models

# ==========================================
# 1. 1D Signal Model (ECG Parameters/Array)
# ==========================================
class ResidualBlock1D(nn.Module):
    def __init__(self, channels):
        super(ResidualBlock1D, self).__init__()
        self.conv1 = nn.Conv1d(channels, channels, kernel_size=5, padding=2)
        self.bn1 = nn.BatchNorm1d(channels)
        self.relu = nn.ReLU()
        self.conv2 = nn.Conv1d(channels, channels, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm1d(channels)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        return self.relu(out)

class ECG1DCNN(nn.Module):
    def __init__(self, num_classes=5):
        super(ECG1DCNN, self).__init__()
        self.in_conv = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=5, padding=2),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.MaxPool1d(2)
        )
        self.res1 = ResidualBlock1D(32)
        self.down1 = nn.Sequential(
            nn.Conv1d(32, 64, kernel_size=5, padding=2),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(2)
        )
        self.res2 = ResidualBlock1D(64)
        self.down2 = nn.Sequential(
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(2)
        )
        self.res3 = ResidualBlock1D(128)
        self.gap = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        x = self.in_conv(x)
        x = self.res1(x)
        x = self.down1(x)
        x = self.res2(x)
        x = self.down2(x)
        x = self.res3(x)
        x = self.gap(x).squeeze(-1)
        return self.fc(x)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

MODEL_1D_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "ecg_mitbih_1dresnet_best.pth")
MODEL_2D_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "ecg_vision_resnet18_best.pth")

CLASS_NAMES_1D = ['Normal (N)', 'Supraventricular (S)', 'Ventricular (V)', 'Fusion (F)', 'Unknown (Q)']
CLASS_NAMES_2D = ['AHB', 'COVID-19', 'HMI', 'MI', 'Normal']

# Load 1D Signal Model
model_1d = ECG1DCNN(num_classes=5).to(DEVICE)
if os.path.exists(MODEL_1D_PATH):
    model_1d.load_state_dict(torch.load(MODEL_1D_PATH, map_location=DEVICE))
    model_1d.eval()

# ==========================================
# 2. 2D Vision Model (ECG Image Scan)
# ==========================================
def build_resnet18_model(num_classes):
    model = models.resnet18(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, num_classes)
    return model

model_2d = build_resnet18_model(num_classes=len(CLASS_NAMES_2D)).to(DEVICE)
if os.path.exists(MODEL_2D_PATH):
    model_2d.load_state_dict(torch.load(MODEL_2D_PATH, map_location=DEVICE))
    model_2d.eval()

image_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def predict_ecg_signal(signal: list[float]):
    input_tensor = torch.tensor(signal, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        outputs = model_1d(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        confidence, predicted_idx = torch.max(probabilities, dim=0)

    class_id = int(predicted_idx.item())
    return {
        "prediction": {
            "class_id": class_id,
            "class_name": CLASS_NAMES_1D[class_id],
            "confidence": round(float(confidence.item()) * 100, 2)
        },
        "all_probabilities": {
            CLASS_NAMES_1D[i]: round(float(probabilities[i].item()) * 100, 2)
            for i in range(len(CLASS_NAMES_1D))
        }
    }

def predict_ecg_image(image_bytes: bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    input_tensor = image_transforms(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model_2d(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        confidence, predicted_idx = torch.max(probabilities, dim=0)

    class_id = int(predicted_idx.item())
    return {
        "prediction": {
            "class_id": class_id,
            "class_name": CLASS_NAMES_2D[class_id] if class_id < len(CLASS_NAMES_2D) else f"Class_{class_id}",
            "confidence": round(float(confidence.item()) * 100, 2)
        },
        "all_probabilities": {
            CLASS_NAMES_2D[i]: round(float(probabilities[i].item()) * 100, 2)
            for i in range(min(len(CLASS_NAMES_2D), len(probabilities)))
        }
    }