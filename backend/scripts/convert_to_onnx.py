"""
Conversion PyTorch → ONNX pour déploiement léger (onnxruntime-cpu).
Exécuter UNE FOIS depuis le dossier backend/ :
    pip install torch torchvision onnx
    python scripts/convert_to_onnx.py

Les 3 fichiers .onnx générés dans ai/checkpoints/ doivent ensuite être
uploadés dans le GitHub Release v1.0-models.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CKPT = os.path.join(BASE, "ai", "checkpoints")

def export(model, dummy, name, output_names):
    path = os.path.join(CKPT, name)
    torch.onnx.export(
        model, dummy, path,
        input_names=["input"],
        output_names=output_names,
        opset_version=17,
        do_constant_folding=True,
    )
    mb = os.path.getsize(path) // (1024 * 1024)
    print(f"  [OK] {name} ({mb} MB)")

# ── ResNet Classifier ──────────────────────────────────────
from ai.models.resnet_classifier import ResNetSEPClassifier
m = ResNetSEPClassifier(n_coupes=5, pretrained=False)
ck = torch.load(os.path.join(CKPT, "resnet_classifier.pth"), map_location="cpu", weights_only=False)
m.load_state_dict(ck["model_state_dict"])
m.eval()
export(m, torch.zeros(1, 5, 1, 224, 224), "resnet_classifier.onnx", ["output"])

# ── U-Net Predictor ────────────────────────────────────────
from ai.models.unet_predictor import UNetPredictor
m = UNetPredictor(in_channels=2)
ck = torch.load(os.path.join(CKPT, "predictor_lesions_v2.pth"), map_location="cpu", weights_only=False)
m.load_state_dict(ck["model_state_dict"])
m.eval()
export(m, torch.zeros(1, 2, 256, 256), "predictor_lesions_v2.onnx", ["seg", "cls"])

# ── ConvLSTM Predictor ─────────────────────────────────────
from ai.models.convlstm_predictor import ConvLSTMPredictor
m = ConvLSTMPredictor(in_channels=1, hidden_channels=32, n_timesteps=3)
ck = torch.load(os.path.join(CKPT, "convlstm_predictor_aug.pth"), map_location="cpu", weights_only=False)
m.load_state_dict(ck["model_state_dict"])
m.eval()
export(m, torch.zeros(1, 3, 1, 128, 128), "convlstm_predictor_aug.onnx", ["output"])

print("\nConversion terminée. Uploadez les 3 fichiers .onnx dans le GitHub Release v1.0-models.")
