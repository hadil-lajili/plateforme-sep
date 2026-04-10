import torch
import nibabel as nib
import numpy as np
from PIL import Image
from pathlib import Path

from ai.models.unet import UNet


"""def charger_modele(checkpoint_path, device=None):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = UNet(in_channels=1, out_channels=1).to(device)
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    return model, device
""""Version améliorée avec gestion d'erreurs et support de modèles plus complexes (ex: Attention U-Net)"""

def charger_modele(checkpoint_path, device=None):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    architecture = checkpoint.get('architecture', 'UNet')

    if architecture == 'AttentionUNet':
        from ai.models.unet_attention import AttentionUNet
        model = AttentionUNet(in_channels=1, out_channels=1).to(device)
        print(f"✅ Architecture : Attention U-Net")
    else:
        from ai.models.unet import UNet
        model = UNet(in_channels=1, out_channels=1).to(device)
        print(f"✅ Architecture : U-Net standard")

    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    return model, device
def predire_irm(fichier_nii, checkpoint_path="ai/checkpoints/best_model.pth", threshold=0.5):
    """
    Prédit le masque de segmentation pour tous les coupes d'une IRM
    Retourne un dict avec les métriques et le masque prédit
    """
    model, device = charger_modele(checkpoint_path)

    img = nib.load(fichier_nii)
    data = img.get_fdata().astype(np.float32)
    n_slices = data.shape[2]

    masque_pred = np.zeros_like(data)

    for i in range(n_slices):
        coupe = data[:, :, i]

        # Normaliser
        mean, std = coupe.mean(), coupe.std()
        if std > 0:
            coupe = (coupe - mean) / std

        # Redimensionner à 256x256
        coupe_img = Image.fromarray(coupe)
        coupe_img = coupe_img.resize((256, 256), Image.BILINEAR)
        coupe_arr = np.array(coupe_img)

        # Prédire
        tensor = torch.tensor(coupe_arr).unsqueeze(0).unsqueeze(0).to(device)
        with torch.no_grad():
            pred = model(tensor)

        # Remettre à la taille originale
        pred_np = pred.squeeze().cpu().numpy()
        pred_img = Image.fromarray(pred_np)
        pred_img = pred_img.resize((data.shape[0], data.shape[1]), Image.BILINEAR)
        masque_pred[:, :, i] = np.array(pred_img)

    # Binariser
    masque_bin = (masque_pred > threshold).astype(np.float32)

    # Calculer métriques
    volume_lesions = int(masque_bin.sum())
    n_coupes_touchees = int((masque_bin.sum(axis=(0, 1)) > 0).sum())

    return {
        "volume_lesions_voxels": volume_lesions,
        "n_coupes_touchees": n_coupes_touchees,
        "n_coupes_total": n_slices,
        "pourcentage_coupes": round(n_coupes_touchees / n_slices * 100, 1),
        "masque": masque_bin,
    }