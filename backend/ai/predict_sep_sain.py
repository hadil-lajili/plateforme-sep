import torch
import nibabel as nib
import numpy as np
from PIL import Image
import os

def predire_sep_sain(fichier_nii, checkpoint_path="ai/checkpoints/resnet_classifier.pth"):
    """
    Prédit si une IRM est SEP ou Saine
    
    Args:
        fichier_nii : chemin vers le fichier IRM (.nii ou .nii.gz)
        checkpoint_path : chemin vers le modèle entraîné
    
    Returns:
        dict avec diagnostic, score, confiance et interprétation
    """
    from ai.models.resnet_classifier import ResNetSEPClassifier

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Charger le modèle
    model = ResNetSEPClassifier(n_coupes=5)
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    model = model.to(device)

    # Charger l'IRM
    img = nib.load(fichier_nii)
    data = np.squeeze(img.get_fdata().astype(np.float32))

    # Extraire 5 coupes centrales
    n = data.shape[2] if len(data.shape) == 3 else 1
    indices = np.linspace(n//4, 3*n//4, 5, dtype=int)

    coupes = []
    for idx in indices:
        coupe = data[:, :, idx] if len(data.shape) == 3 else data
        std = coupe.std()
        if std > 0:
            coupe = (coupe - coupe.mean()) / std
        coupe_img = Image.fromarray(coupe).resize((224, 224), Image.BILINEAR)
        coupes.append(np.array(coupe_img, dtype=np.float32))

    # Prédiction
    volume = np.stack(coupes, axis=0)
    tensor = torch.tensor(volume).unsqueeze(1).unsqueeze(0).to(device)

    with torch.no_grad():
        score = model(tensor).item()

    diagnostic = "SEP Détectée" if score > 0.5 else "Sain"
    confiance = score if score > 0.5 else 1 - score

    if score > 0.8:
        interpretation = "Forte probabilité de SEP"
        couleur = "#ef4444"
    elif score > 0.5:
        interpretation = "Probabilité modérée de SEP"
        couleur = "#f59e0b"
    elif score > 0.2:
        interpretation = "Faible probabilité de SEP"
        couleur = "#84cc16"
    else:
        interpretation = "Aucun signe de SEP détecté"
        couleur = "#22c55e"

    return {
        "diagnostic": diagnostic,
        "score": round(score, 4),
        "confiance": round(confiance * 100, 1),
        "interpretation": interpretation,
        "couleur": couleur
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m ai.predict_sep_sain chemin/vers/irm.nii.gz")
        sys.exit(1)

    fichier = sys.argv[1]
    if not os.path.exists(fichier):
        print(f"Erreur: fichier {fichier} introuvable")
        sys.exit(1)

    print(f"📊 Analyse de {fichier}...")
    resultats = predire_sep_sain(fichier)

    print(f"\n{'='*40}")
    print(f"Diagnostic  : {resultats['diagnostic']}")
    print(f"Score SEP   : {resultats['score']}")
    print(f"Confiance   : {resultats['confiance']}%")
    print(f"Résultat    : {resultats['interpretation']}")
    print(f"{'='*40}")