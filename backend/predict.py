"""
Inference U-Net 3D sur volumes FLAIR complets
==============================================

Strategie : Sliding Window avec chevauchement (overlap)

Le modele a ete entraine sur des patches de 64x64x64. Pour predire sur un
volume entier (181x217x181), on ne peut pas simplement le passer en une fois
(trop gros pour la VRAM et shape differente de l'entrainement).

On decoupe donc le volume en patches qui se chevauchent (typiquement 50%
d'overlap), on predit chaque patch, puis on recombine les predictions en
faisant la MOYENNE dans les zones de chevauchement. Ce moyennage est crucial :
il lisse les artefacts de bord et produit des predictions beaucoup plus
stables que si on prenait les patches bout a bout sans overlap.

Usage :
    # Predire un seul volume
    python predict.py --input data/mslsc/preprocessed/training05_01_flair_pp.nii

    # Predire tous les volumes de validation et evaluer
    python predict.py --eval

    # Predire + sauvegarder des visualisations PNG
    python predict.py --eval --visualize
"""

import argparse
from pathlib import Path
from typing import Tuple

import numpy as np
import nibabel as nib
import torch
import torch.nn.functional as F

from unet3d import UNet3D
from dataset_isbi import (
    load_and_preprocess, find_mask_paths, list_flair_files_for_patients,
    DATA_ROOT, VAL_PATIENTS,
)


# =============================================================================
# CONFIGURATION
# =============================================================================
CHECKPOINT_PATH = Path("./checkpoints/best_model.pth")
OUTPUT_DIR = Path("./predictions")
OUTPUT_DIR.mkdir(exist_ok=True)

PATCH_SIZE = (64, 64, 64)
# Overlap de 50% : chaque voxel est couvert par ~8 patches en 3D
# C'est le standard en segmentation medicale (nnU-Net fait pareil)
OVERLAP = 0.5
THRESHOLD = 0.5   # seuil pour binariser les probabilites


# =============================================================================
# SLIDING WINDOW INFERENCE
# =============================================================================
def sliding_window_inference(
    volume: np.ndarray,
    model: torch.nn.Module,
    device: str,
    patch_size: Tuple[int, int, int] = PATCH_SIZE,
    overlap: float = OVERLAP,
    batch_size: int = 4,
) -> np.ndarray:
    """
    Applique le modele sur un volume entier par sliding window.

    Parametres
    ----------
    volume : np.ndarray, shape (H, W, D), float32 normalise
    model  : UNet3D entraine
    device : "cuda" ou "cpu"
    patch_size : taille des patches (doit matcher l'entrainement)
    overlap : fraction de chevauchement entre patches (0.5 = 50%)
    batch_size : nombre de patches traites en parallele sur le GPU

    Retourne
    --------
    prob_map : np.ndarray, shape (H, W, D), float32
        Carte de probabilites [0, 1] pour chaque voxel.
    """
    model.eval()
    ph, pw, pd = patch_size
    h, w, d = volume.shape

    # Calcul du pas (stride) entre patches
    # Avec overlap=0.5 et patch=64, stride=32
    stride_h = max(1, int(ph * (1 - overlap)))
    stride_w = max(1, int(pw * (1 - overlap)))
    stride_d = max(1, int(pd * (1 - overlap)))

    # Grille de toutes les origines de patches
    origins = []
    for x in range(0, h - ph + 1, stride_h):
        for y in range(0, w - pw + 1, stride_w):
            for z in range(0, d - pd + 1, stride_d):
                origins.append((x, y, z))

    # On ajoute les bords pour ne rien oublier
    # (si le volume n'est pas divisible par le stride)
    for x in range(0, h - ph + 1, stride_h):
        for y in range(0, w - pw + 1, stride_w):
            origins.append((x, y, d - pd))
    for x in range(0, h - ph + 1, stride_h):
        for z in range(0, d - pd + 1, stride_d):
            origins.append((x, w - pw, z))
    for y in range(0, w - pw + 1, stride_w):
        for z in range(0, d - pd + 1, stride_d):
            origins.append((h - ph, y, z))
    # Coin extreme
    origins.append((h - ph, w - pw, d - pd))

    # Deduplique (certains bords peuvent deja etre dans la grille)
    origins = list(set(origins))
    origins.sort()

    print(f"    Sliding window : {len(origins)} patches "
          f"(stride={stride_h}, overlap={overlap})")

    # Accumulateurs : on somme les predictions et on compte combien
    # de patches couvrent chaque voxel
    sum_preds = np.zeros(volume.shape, dtype=np.float64)
    count_map = np.zeros(volume.shape, dtype=np.float64)

    # Traitement par mini-batches pour utiliser le GPU efficacement
    with torch.no_grad():
        for i in range(0, len(origins), batch_size):
            batch_origins = origins[i:i + batch_size]

            # Extraire les patches
            patches = []
            for (x, y, z) in batch_origins:
                patch = volume[x:x + ph, y:y + pw, z:z + pd]
                patches.append(patch)

            # Stack en tenseur : (B, 1, pH, pW, pD)
            batch_tensor = torch.from_numpy(
                np.stack(patches)[:, np.newaxis]
            ).float().to(device)

            # Forward
            logits = model(batch_tensor)
            probs = torch.sigmoid(logits).cpu().numpy()[:, 0]  # (B, pH, pW, pD)

            # Accumuler
            for j, (x, y, z) in enumerate(batch_origins):
                sum_preds[x:x + ph, y:y + pw, z:z + pd] += probs[j]
                count_map[x:x + ph, y:y + pw, z:z + pd] += 1.0

    # Moyenne : divise par le nombre de patches qui couvrent chaque voxel
    # Les voxels non couverts (theoriquement 0) restent a 0
    prob_map = np.divide(sum_preds, count_map,
                         out=np.zeros_like(sum_preds),
                         where=count_map > 0)

    return prob_map.astype(np.float32)


# =============================================================================
# PREDICTION D'UN VOLUME
# =============================================================================
def predict_volume(
    flair_path: Path,
    model: torch.nn.Module,
    device: str,
) -> Tuple[np.ndarray, np.ndarray, nib.Nifti1Image]:
    """
    Pipeline complet : charge -> preprocess -> predict -> binarise.

    Retourne : (prob_map, binary_mask, nifti_original)
    """
    # Charger le volume original (pour l'affine et le header)
    nii = nib.load(str(flair_path))

    # Preprocesser (meme pipeline que l'entrainement)
    flair_norm, gt_mask = load_and_preprocess(flair_path)

    # Inference sliding window
    prob_map = sliding_window_inference(flair_norm, model, device)

    # Binariser
    binary_mask = (prob_map >= THRESHOLD).astype(np.uint8)

    return prob_map, binary_mask, gt_mask, nii


# =============================================================================
# METRIQUES SUR VOLUMES COMPLETS
# =============================================================================
def dice_volume(pred: np.ndarray, gt: np.ndarray, smooth: float = 1.0
                ) -> float:
    """Dice score entre deux masques binaires complets."""
    pred = pred.astype(bool)
    gt = gt.astype(bool)
    intersection = (pred & gt).sum()
    return float((2 * intersection + smooth) / (pred.sum() + gt.sum() + smooth))


def volume_ml(mask: np.ndarray, voxel_spacing: tuple) -> float:
    """Volume de lesion en mL (1 mL = 1000 mm3)."""
    voxel_vol = np.prod(voxel_spacing)
    return float(mask.sum() * voxel_vol / 1000)


# =============================================================================
# VISUALISATION
# =============================================================================
def save_visualization(flair_path: Path, flair_norm: np.ndarray,
                       gt_mask: np.ndarray, pred_mask: np.ndarray,
                       prob_map: np.ndarray, dice: float,
                       out_dir: Path):
    """Sauvegarde des visualisations comparatives GT vs Prediction."""
    import matplotlib.pyplot as plt

    name = flair_path.stem

    # Trouver les 3 slices axiales avec le plus de lesions (GT)
    lesions_per_slice = gt_mask.sum(axis=(0, 1))
    if lesions_per_slice.sum() > 0:
        best_slices = np.argsort(lesions_per_slice)[-3:][::-1]
    else:
        mid = flair_norm.shape[2] // 2
        best_slices = [mid - 10, mid, mid + 10]

    # Clipping pour affichage
    p1, p99 = np.percentile(flair_norm[flair_norm != 0], [2, 98])
    flair_disp = np.clip(flair_norm, p1, p99)

    fig, axes = plt.subplots(3, 4, figsize=(16, 12))

    for row, sl in enumerate(best_slices):
        # Colonne 1 : FLAIR
        axes[row, 0].imshow(flair_disp[:, :, sl].T, cmap="gray",
                            origin="lower")
        axes[row, 0].set_title(f"FLAIR (slice {sl})")
        axes[row, 0].axis("off")

        # Colonne 2 : Ground Truth
        axes[row, 1].imshow(flair_disp[:, :, sl].T, cmap="gray",
                            origin="lower")
        gt_sl = np.ma.masked_where(gt_mask[:, :, sl].T == 0,
                                   gt_mask[:, :, sl].T)
        axes[row, 1].imshow(gt_sl, cmap="Greens", alpha=0.6, origin="lower")
        axes[row, 1].set_title("Ground Truth")
        axes[row, 1].axis("off")

        # Colonne 3 : Prediction
        axes[row, 2].imshow(flair_disp[:, :, sl].T, cmap="gray",
                            origin="lower")
        pred_sl = np.ma.masked_where(pred_mask[:, :, sl].T == 0,
                                     pred_mask[:, :, sl].T)
        axes[row, 2].imshow(pred_sl, cmap="Reds", alpha=0.6, origin="lower")
        axes[row, 2].set_title("Prediction")
        axes[row, 2].axis("off")

        # Colonne 4 : Carte de probabilites
        axes[row, 3].imshow(flair_disp[:, :, sl].T, cmap="gray",
                            origin="lower")
        prob_sl = prob_map[:, :, sl].T
        prob_disp = np.ma.masked_where(prob_sl < 0.1, prob_sl)
        im = axes[row, 3].imshow(prob_disp, cmap="hot", alpha=0.7,
                                 origin="lower", vmin=0, vmax=1)
        axes[row, 3].set_title("Probabilites")
        axes[row, 3].axis("off")

    plt.suptitle(f"{name}  -  Dice = {dice:.4f}", fontsize=14,
                 fontweight="bold")
    plt.tight_layout()
    out_path = out_dir / f"{name}_prediction.png"
    plt.savefig(out_path, dpi=100, bbox_inches="tight")
    plt.close()
    return out_path


# =============================================================================
# MAIN
# =============================================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, default=None,
                        help="Chemin vers un fichier FLAIR .nii a predire")
    parser.add_argument("--eval", action="store_true",
                        help="Evaluer sur tous les volumes de validation")
    parser.add_argument("--visualize", action="store_true",
                        help="Sauvegarder des visualisations PNG")
    parser.add_argument("--checkpoint", type=str,
                        default=str(CHECKPOINT_PATH))
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"

    # --- Charger le modele ---
    print("=" * 70)
    print("INFERENCE U-NET 3D")
    print("=" * 70)

    checkpoint = torch.load(args.checkpoint, map_location=device,
                            weights_only=False)
    model_args = checkpoint.get("args", {})
    model = UNet3D(
        in_channels=1, out_channels=1,
        base_features=model_args.get("base_features", 16),
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    print(f"  Checkpoint : {args.checkpoint}")
    print(f"  Epoch      : {checkpoint.get('epoch', '?')}")
    print(f"  Val Dice   : {checkpoint.get('val_dice', '?')}")
    print(f"  Device     : {device}")

    if args.input:
        # --- Mode : prediction d'un seul volume ---
        flair_path = Path(args.input)
        print(f"\n  Volume : {flair_path.name}")
        prob_map, pred_mask, gt_mask, nii = predict_volume(
            flair_path, model, device)

        # Sauvegarder le masque predit en NIfTI
        out_nii = nib.Nifti1Image(pred_mask, nii.affine, nii.header)
        out_path = OUTPUT_DIR / f"{flair_path.stem}_pred.nii.gz"
        nib.save(out_nii, str(out_path))
        print(f"  Masque sauve : {out_path}")

        # Si on a la GT, calculer le Dice
        dice = dice_volume(pred_mask, gt_mask)
        spacing = nii.header.get_zooms()
        vol_pred = volume_ml(pred_mask, spacing)
        vol_gt = volume_ml(gt_mask, spacing)
        print(f"  Dice           : {dice:.4f}")
        print(f"  Volume pred    : {vol_pred:.2f} mL")
        print(f"  Volume GT      : {vol_gt:.2f} mL")

        if args.visualize:
            flair_norm, _ = load_and_preprocess(flair_path)
            png_path = save_visualization(
                flair_path, flair_norm, gt_mask, pred_mask, prob_map,
                dice, OUTPUT_DIR)
            print(f"  Visualisation  : {png_path}")

    elif args.eval:
        # --- Mode : evaluation sur tous les volumes de validation ---
        val_paths = list_flair_files_for_patients(VAL_PATIENTS)
        print(f"\n  Evaluation sur {len(val_paths)} volumes ({VAL_PATIENTS})")
        print()

        results = []
        for flair_path in val_paths:
            name = flair_path.stem
            print(f"  [{name}]")

            prob_map, pred_mask, gt_mask, nii = predict_volume(
                flair_path, model, device)

            # Sauvegarder NIfTI
            out_nii = nib.Nifti1Image(pred_mask, nii.affine, nii.header)
            out_path = OUTPUT_DIR / f"{name}_pred.nii.gz"
            nib.save(out_nii, str(out_path))

            # Metriques
            dice = dice_volume(pred_mask, gt_mask)
            spacing = nii.header.get_zooms()
            vol_pred = volume_ml(pred_mask, spacing)
            vol_gt = volume_ml(gt_mask, spacing)

            tp = ((pred_mask > 0) & (gt_mask > 0)).sum()
            fp = ((pred_mask > 0) & (gt_mask == 0)).sum()
            fn = ((pred_mask == 0) & (gt_mask > 0)).sum()
            sens = tp / (tp + fn + 1e-8)
            prec = tp / (tp + fp + 1e-8)

            results.append({
                "name": name, "dice": dice,
                "sensitivity": sens, "precision": prec,
                "vol_pred_ml": vol_pred, "vol_gt_ml": vol_gt,
            })

            print(f"    Dice={dice:.4f}  Sens={sens:.3f}  Prec={prec:.3f}  "
                  f"Vol_pred={vol_pred:.1f}mL  Vol_GT={vol_gt:.1f}mL")

            if args.visualize:
                flair_norm, _ = load_and_preprocess(flair_path)
                save_visualization(flair_path, flair_norm, gt_mask,
                                   pred_mask, prob_map, dice, OUTPUT_DIR)

        # --- Tableau recapitulatif ---
        print("\n" + "=" * 70)
        print("RESULTATS RECAPITULATIFS")
        print("=" * 70)
        print(f"  {'Volume':<30} {'Dice':>6} {'Sens':>6} {'Prec':>6} "
              f"{'Pred mL':>8} {'GT mL':>8}")
        print("  " + "-" * 66)
        for r in results:
            print(f"  {r['name']:<30} {r['dice']:>6.4f} "
                  f"{r['sensitivity']:>6.3f} {r['precision']:>6.3f} "
                  f"{r['vol_pred_ml']:>8.1f} {r['vol_gt_ml']:>8.1f}")
        print("  " + "-" * 66)

        mean_dice = np.mean([r["dice"] for r in results])
        mean_sens = np.mean([r["sensitivity"] for r in results])
        mean_prec = np.mean([r["precision"] for r in results])
        print(f"  {'MOYENNE':<30} {mean_dice:>6.4f} "
              f"{mean_sens:>6.3f} {mean_prec:>6.3f}")
        print(f"\n  Plafond inter-experts ISBI : ~0.73")
        print(f"  Ton modele                : {mean_dice:.4f}")
        print(f"  Ratio vs plafond          : "
              f"{100 * mean_dice / 0.73:.1f} %")

        if args.visualize:
            print(f"\n  Visualisations sauvees dans : {OUTPUT_DIR}/")

    else:
        print("\n  Aucune action specifiee. Utilise --input ou --eval")
        print("  Exemples :")
        print("    python predict.py --eval --visualize")
        print("    python predict.py --input chemin/vers/flair.nii")


if __name__ == "__main__":
    main()
