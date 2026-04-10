"""
Entrainement U-Net 3D v2 - Version amelioree
==============================================

Ameliorations par rapport a train.py :
  1. base_features = 32 (au lieu de 16) -> modele plus expressif
  2. Data augmentation enrichie : rotations 90, bruit gaussien,
     simulation de biais d'intensite
  3. Post-processing : suppression des petites composantes connexes
  4. Cosine annealing scheduler (meilleure convergence)
  5. Gradient clipping (stabilite)

Usage :
    python train_v2.py                  # 100 epochs par defaut
    python train_v2.py --epochs 50      # test rapide
"""

import argparse
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from scipy import ndimage
import nibabel as nib

from unet3d import UNet3D
from dataset_isbi import (
    load_and_preprocess, find_mask_paths, DATA_ROOT,
    list_flair_files_for_patients, TRAIN_PATIENTS, VAL_PATIENTS,
    PATCH_SIZE, MIN_LESION_VOXELS_PER_PATCH, MAX_RESAMPLE_TRIES,
)
from train import DiceLoss, ComboLoss, dice_score, sensitivity_precision

import random

# =============================================================================
# CONFIGURATION
# =============================================================================
CHECKPOINTS_DIR = Path("./checkpoints_v2")
CHECKPOINTS_DIR.mkdir(exist_ok=True)

LOGS_DIR = Path("./logs_v2")
LOGS_DIR.mkdir(exist_ok=True)

PREDICTIONS_DIR = Path("./predictions_v2")
PREDICTIONS_DIR.mkdir(exist_ok=True)


# =============================================================================
# DATASET AMELIORE (augmentation enrichie)
# =============================================================================
class ISBIDatasetV2(Dataset):
    """
    Dataset v2 avec data augmentation enrichie :
      - Flips aleatoires (comme v1)
      - Rotations de 90 degres sur les 3 axes
      - Bruit gaussien additif (simule le bruit du scanner)
      - Perturbation d'intensite (simule les variations entre scanners)
    """

    def __init__(self, flair_paths, patch_size=PATCH_SIZE,
                 patches_per_volume=40, lesion_sampling_prob=0.5,
                 augment=True):
        self.patch_size = patch_size
        self.patches_per_volume = patches_per_volume
        self.lesion_sampling_prob = lesion_sampling_prob
        self.augment = augment

        print(f"[ISBIDatasetV2] Chargement de {len(flair_paths)} volumes...")
        self.volumes = []
        for p in flair_paths:
            flair, mask = load_and_preprocess(p)
            lesion_coords = np.argwhere(mask > 0)
            self.volumes.append({
                "flair": flair, "mask": mask,
                "lesion_coords": lesion_coords, "name": p.stem,
            })
            print(f"  [OK] {p.stem}  lesion_voxels={len(lesion_coords):,}")

        print(f"[ISBIDatasetV2] {len(self.volumes)} volumes x "
              f"{patches_per_volume} patches = {len(self)} par epoch")

    def __len__(self):
        return len(self.volumes) * self.patches_per_volume

    def _extract_patch(self, vol, x, y, z):
        ph, pw, pd = self.patch_size
        return (vol["flair"][x:x+ph, y:y+pw, z:z+pd],
                vol["mask"][x:x+ph, y:y+pw, z:z+pd])

    def _origin_on_lesion(self, vol):
        shape = vol["flair"].shape
        ph, pw, pd = self.patch_size
        cx, cy, cz = vol["lesion_coords"][
            random.randint(0, len(vol["lesion_coords"]) - 1)]
        jitter = 16
        x = max(0, min(cx - ph//2 + random.randint(-jitter, jitter),
                        shape[0] - ph))
        y = max(0, min(cy - pw//2 + random.randint(-jitter, jitter),
                        shape[1] - pw))
        z = max(0, min(cz - pd//2 + random.randint(-jitter, jitter),
                        shape[2] - pd))
        return x, y, z

    def _random_origin(self, vol):
        shape = vol["flair"].shape
        ph, pw, pd = self.patch_size
        return (random.randint(0, shape[0]-ph),
                random.randint(0, shape[1]-pw),
                random.randint(0, shape[2]-pd))

    def _sample_valid_patch(self, vol):
        sample_lesion = (len(vol["lesion_coords"]) > 0
                         and random.random() < self.lesion_sampling_prob)
        if sample_lesion:
            for _ in range(MAX_RESAMPLE_TRIES):
                x, y, z = self._origin_on_lesion(vol)
                fp, mp = self._extract_patch(vol, x, y, z)
                if mp.sum() >= MIN_LESION_VOXELS_PER_PATCH:
                    return fp, mp
            return fp, mp
        else:
            x, y, z = self._random_origin(vol)
            return self._extract_patch(vol, x, y, z)

    def _augment(self, flair, mask):
        """
        Augmentation enrichie :
          1. Flips aleatoires sur 3 axes
          2. Rotation de 90 degres aleatoire sur un plan
          3. Bruit gaussien additif
          4. Perturbation d'intensite (scale + shift)
        """
        # --- 1. Flips aleatoires ---
        for axis in range(3):
            if random.random() < 0.5:
                flair = np.flip(flair, axis=axis)
                mask = np.flip(mask, axis=axis)

        # --- 2. Rotation 90 degres (sur un plan aleatoire) ---
        if random.random() < 0.3:
            # Choisir un plan et un nombre de rotations (1, 2, ou 3 x 90)
            plane = random.choice([(0, 1), (0, 2), (1, 2)])
            k = random.randint(1, 3)
            flair = np.rot90(flair, k=k, axes=plane)
            mask = np.rot90(mask, k=k, axes=plane)

        # Copie pour resoudre les strides negatifs
        flair = flair.copy()
        mask = mask.copy()

        # --- 3. Bruit gaussien ---
        if random.random() < 0.3:
            noise_std = random.uniform(0.01, 0.1)
            noise = np.random.normal(0, noise_std, flair.shape).astype(np.float32)
            # On n'ajoute le bruit que sur les voxels du cerveau (pas le fond)
            brain_mask = flair != 0
            flair[brain_mask] += noise[brain_mask]

        # --- 4. Perturbation d'intensite ---
        if random.random() < 0.3:
            # Scale : multiplier toutes les intensites par un facteur ~[0.9, 1.1]
            scale = random.uniform(0.9, 1.1)
            # Shift : ajouter un offset ~[-0.1, 0.1]
            shift = random.uniform(-0.1, 0.1)
            brain_mask = flair != 0
            flair[brain_mask] = flair[brain_mask] * scale + shift

        return flair, mask

    def __getitem__(self, idx):
        vol_idx = idx // self.patches_per_volume
        vol = self.volumes[vol_idx]
        flair_patch, mask_patch = self._sample_valid_patch(vol)
        if self.augment:
            flair_patch, mask_patch = self._augment(flair_patch, mask_patch)
        return (torch.from_numpy(flair_patch).unsqueeze(0).float(),
                torch.from_numpy(mask_patch).unsqueeze(0).float())


# =============================================================================
# POST-PROCESSING
# =============================================================================
def postprocess_mask(binary_mask: np.ndarray,
                     min_component_size: int = 20) -> np.ndarray:
    """
    Supprime les petites composantes connexes du masque predit.

    Les faux positifs sont souvent des petits clusters isoles de quelques
    voxels. En supprimant tout ce qui fait moins de `min_component_size`
    voxels, on ameliore la precision sans trop affecter la sensibilite.
    """
    if binary_mask.sum() == 0:
        return binary_mask

    labeled, n_components = ndimage.label(binary_mask)
    cleaned = np.zeros_like(binary_mask)
    for i in range(1, n_components + 1):
        component = labeled == i
        if component.sum() >= min_component_size:
            cleaned[component] = 1

    return cleaned


# =============================================================================
# INFERENCE SLIDING WINDOW (avec post-processing)
# =============================================================================
def sliding_window_inference(volume, model, device, patch_size=PATCH_SIZE,
                             overlap=0.5, batch_size=4):
    """Sliding window identique a predict.py."""
    model.eval()
    ph, pw, pd = patch_size
    h, w, d = volume.shape

    stride_h = max(1, int(ph * (1 - overlap)))
    stride_w = max(1, int(pw * (1 - overlap)))
    stride_d = max(1, int(pd * (1 - overlap)))

    origins = set()
    for x in range(0, h - ph + 1, stride_h):
        for y in range(0, w - pw + 1, stride_w):
            for z in range(0, d - pd + 1, stride_d):
                origins.add((x, y, z))
            origins.add((x, y, d - pd))
        for z in range(0, d - pd + 1, stride_d):
            origins.add((x, w - pw, z))
    for y in range(0, w - pw + 1, stride_w):
        for z in range(0, d - pd + 1, stride_d):
            origins.add((h - ph, y, z))
    origins.add((h - ph, w - pw, d - pd))
    origins = sorted(origins)

    sum_preds = np.zeros(volume.shape, dtype=np.float64)
    count_map = np.zeros(volume.shape, dtype=np.float64)

    with torch.no_grad():
        for i in range(0, len(origins), batch_size):
            batch_origins = origins[i:i + batch_size]
            patches = [volume[x:x+ph, y:y+pw, z:z+pd]
                       for x, y, z in batch_origins]
            batch_t = torch.from_numpy(
                np.stack(patches)[:, np.newaxis]).float().to(device)
            logits = model(batch_t)
            probs = torch.sigmoid(logits).cpu().numpy()[:, 0]
            for j, (x, y, z) in enumerate(batch_origins):
                sum_preds[x:x+ph, y:y+pw, z:z+pd] += probs[j]
                count_map[x:x+ph, y:y+pw, z:z+pd] += 1.0

    prob_map = np.divide(sum_preds, count_map,
                         out=np.zeros_like(sum_preds),
                         where=count_map > 0)
    return prob_map.astype(np.float32)


# =============================================================================
# METRIQUES SUR VOLUMES COMPLETS
# =============================================================================
def dice_volume(pred, gt, smooth=1.0):
    pred, gt = pred.astype(bool), gt.astype(bool)
    inter = (pred & gt).sum()
    return float((2 * inter + smooth) / (pred.sum() + gt.sum() + smooth))


# =============================================================================
# BOUCLES TRAIN / VAL (memes que train.py)
# =============================================================================
def train_one_epoch(model, loader, optimizer, criterion, device,
                    epoch, total_epochs):
    model.train()
    total_loss = total_dice = 0.0
    n = 0
    t0 = time.time()
    for batch_idx, (flair, mask) in enumerate(loader):
        flair = flair.to(device, non_blocking=True)
        mask = mask.to(device, non_blocking=True)
        logits = model(flair)
        loss = criterion(logits, mask)
        optimizer.zero_grad()
        loss.backward()
        # Gradient clipping : evite les explosions de gradient
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
        total_dice += dice_score(logits, mask)
        n += 1
        if batch_idx % 5 == 0:
            print(f"\r  Epoch {epoch}/{total_epochs}  "
                  f"batch {batch_idx+1}/{len(loader)}  "
                  f"loss={loss.item():.4f}  "
                  f"time={time.time()-t0:.0f}s", end="", flush=True)

    elapsed = time.time() - t0
    print(f"\r  Epoch {epoch}/{total_epochs}  "
          f"[TRAIN] loss={total_loss/n:.4f}  "
          f"dice={total_dice/n:.4f}  time={elapsed:.0f}s")
    return {"loss": total_loss/n, "dice": total_dice/n}


@torch.no_grad()
def validate(model, loader, criterion, device):
    model.eval()
    total_loss = total_dice = total_sens = total_prec = 0.0
    n = 0
    for flair, mask in loader:
        flair = flair.to(device, non_blocking=True)
        mask = mask.to(device, non_blocking=True)
        logits = model(flair)
        total_loss += criterion(logits, mask).item()
        total_dice += dice_score(logits, mask)
        s, p = sensitivity_precision(logits, mask)
        total_sens += s
        total_prec += p
        n += 1
    return {"loss": total_loss/n, "dice": total_dice/n,
            "sensitivity": total_sens/n, "precision": total_prec/n}


# =============================================================================
# EVALUATION SUR VOLUMES COMPLETS (avec post-processing)
# =============================================================================
def evaluate_full_volumes(model, device, min_component_size=20):
    """Evalue le modele sur les volumes complets de validation."""
    print("\n" + "=" * 70)
    print("EVALUATION SUR VOLUMES COMPLETS (avec post-processing)")
    print("=" * 70)

    val_paths = list_flair_files_for_patients(VAL_PATIENTS)
    results = []

    for flair_path in val_paths:
        name = flair_path.stem
        flair_norm, gt_mask = load_and_preprocess(flair_path)
        nii = nib.load(str(flair_path))

        print(f"  [{name}]")
        prob_map = sliding_window_inference(flair_norm, model, device)
        pred_raw = (prob_map >= 0.5).astype(np.uint8)
        pred_pp = postprocess_mask(pred_raw, min_component_size)

        dice_raw = dice_volume(pred_raw, gt_mask)
        dice_pp = dice_volume(pred_pp, gt_mask)

        # Metriques sur la version post-processed
        tp = ((pred_pp > 0) & (gt_mask > 0)).sum()
        fp = ((pred_pp > 0) & (gt_mask == 0)).sum()
        fn = ((pred_pp == 0) & (gt_mask > 0)).sum()
        sens = tp / (tp + fn + 1e-8)
        prec = tp / (tp + fp + 1e-8)

        spacing = nii.header.get_zooms()
        vol_pred = float(pred_pp.sum() * np.prod(spacing) / 1000)
        vol_gt = float(gt_mask.sum() * np.prod(spacing) / 1000)

        # Sauvegarder NIfTI
        out_nii = nib.Nifti1Image(pred_pp, nii.affine, nii.header)
        nib.save(out_nii, str(PREDICTIONS_DIR / f"{name}_pred_v2.nii.gz"))

        results.append({
            "name": name, "dice_raw": dice_raw, "dice_pp": dice_pp,
            "sensitivity": sens, "precision": prec,
            "vol_pred": vol_pred, "vol_gt": vol_gt,
        })
        print(f"    Dice brut={dice_raw:.4f}  Dice PP={dice_pp:.4f}  "
              f"Sens={sens:.3f}  Prec={prec:.3f}")

    # Tableau recapitulatif
    print(f"\n  {'Volume':<30} {'Brut':>6} {'Post-P':>6} {'Sens':>6} "
          f"{'Prec':>6} {'PredmL':>7} {'GT mL':>7}")
    print(f"  {'-'*70}")
    for r in results:
        print(f"  {r['name']:<30} {r['dice_raw']:>6.4f} {r['dice_pp']:>6.4f} "
              f"{r['sensitivity']:>6.3f} {r['precision']:>6.3f} "
              f"{r['vol_pred']:>7.1f} {r['vol_gt']:>7.1f}")
    print(f"  {'-'*70}")
    mean_raw = np.mean([r["dice_raw"] for r in results])
    mean_pp = np.mean([r["dice_pp"] for r in results])
    mean_sens = np.mean([r["sensitivity"] for r in results])
    mean_prec = np.mean([r["precision"] for r in results])
    print(f"  {'MOYENNE':<30} {mean_raw:>6.4f} {mean_pp:>6.4f} "
          f"{mean_sens:>6.3f} {mean_prec:>6.3f}")
    print(f"\n  Amelioration post-processing : "
          f"{mean_pp - mean_raw:+.4f} Dice")

    return results


# =============================================================================
# MAIN
# =============================================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--base_features", type=int, default=32)
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("=" * 70)
    print(f"ENTRAINEMENT U-NET 3D v2 (ameliore)  -  device: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print("=" * 70)
    print(f"  Epochs        : {args.epochs}")
    print(f"  Batch size    : {args.batch_size}")
    print(f"  Learning rate : {args.lr}")
    print(f"  Base features : {args.base_features}  (v1 etait 16)")
    print()

    # --- Data (v2 avec augmentation enrichie) ---
    train_paths = list_flair_files_for_patients(TRAIN_PATIENTS)
    val_paths = list_flair_files_for_patients(VAL_PATIENTS)
    print(f"Train : {len(train_paths)} volumes")
    print(f"Val   : {len(val_paths)} volumes\n")

    train_ds = ISBIDatasetV2(train_paths, augment=True,
                             patches_per_volume=40)  # plus de patches
    val_ds = ISBIDatasetV2(val_paths, augment=False,
                           patches_per_volume=16,
                           lesion_sampling_prob=0.5)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size,
                              shuffle=True, num_workers=0,
                              pin_memory=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size,
                            shuffle=False, num_workers=0,
                            pin_memory=True, drop_last=False)

    # --- Model (base_features=32) ---
    model = UNet3D(in_channels=1, out_channels=1,
                   base_features=args.base_features).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Modele : {n_params/1e6:.2f} M parametres "
          f"(v1 avait 1.33 M)")

    # --- Loss, optimizer, scheduler ---
    criterion = ComboLoss(dice_weight=0.5, bce_weight=0.5)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    # Cosine annealing : LR descend doucement de lr_max a lr_min
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=1e-6)

    # --- Boucle d'entrainement ---
    history = {"train_loss": [], "train_dice": [],
               "val_loss": [], "val_dice": [],
               "val_sens": [], "val_prec": []}
    best_val_dice = 0.0

    print("\n" + "=" * 70)
    print("DEBUT DE L'ENTRAINEMENT v2")
    print("=" * 70)

    for epoch in range(1, args.epochs + 1):
        train_m = train_one_epoch(model, train_loader, optimizer,
                                  criterion, device, epoch, args.epochs)
        val_m = validate(model, val_loader, criterion, device)
        print(f"              [VAL]   loss={val_m['loss']:.4f}  "
              f"dice={val_m['dice']:.4f}  "
              f"sens={val_m['sensitivity']:.3f}  "
              f"prec={val_m['precision']:.3f}  "
              f"lr={optimizer.param_groups[0]['lr']:.6f}")

        scheduler.step()

        for k in ["train_loss", "train_dice"]:
            history[k].append(train_m[k.replace("train_", "")])
        history["val_loss"].append(val_m["loss"])
        history["val_dice"].append(val_m["dice"])
        history["val_sens"].append(val_m["sensitivity"])
        history["val_prec"].append(val_m["precision"])

        if val_m["dice"] > best_val_dice:
            best_val_dice = val_m["dice"]
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_dice": best_val_dice,
                "args": vars(args),
            }, CHECKPOINTS_DIR / "best_model_v2.pth")
            print(f"              [!] Nouveau meilleur (dice={best_val_dice:.4f})")

    print("\n" + "=" * 70)
    print(f"ENTRAINEMENT v2 TERMINE  -  meilleur Dice val : {best_val_dice:.4f}")
    print("=" * 70)

    # Sauvegarder historique
    np.savez(LOGS_DIR / "history_v2.npz", **history)

    # Courbes
    try:
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        axes[0].plot(history["train_loss"], label="train")
        axes[0].plot(history["val_loss"], label="val")
        axes[0].set_xlabel("Epoch"); axes[0].set_ylabel("Loss")
        axes[0].set_title("Loss v2 (Dice + BCE)")
        axes[0].legend(); axes[0].grid(True, alpha=0.3)

        axes[1].plot(history["train_dice"], label="train")
        axes[1].plot(history["val_dice"], label="val")
        axes[1].axhline(0.73, color="red", linestyle="--",
                        label="plafond inter-experts")
        axes[1].set_xlabel("Epoch"); axes[1].set_ylabel("Dice")
        axes[1].set_title("Dice score v2")
        axes[1].legend(); axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(LOGS_DIR / "training_curves_v2.png", dpi=100,
                    bbox_inches="tight")
        plt.close()
    except Exception as e:
        print(f"  [!] Erreur graphe: {e}")

    # --- Evaluation sur volumes complets ---
    # Charger le meilleur modele
    ckpt = torch.load(CHECKPOINTS_DIR / "best_model_v2.pth",
                      map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    results = evaluate_full_volumes(model, device, min_component_size=20)

    # Comparaison v1 vs v2
    print("\n" + "=" * 70)
    print("COMPARAISON v1 vs v2")
    print("=" * 70)
    v1_dice = 0.6656  # resultat de la v1 (calcule precedemment)
    v2_dice = np.mean([r["dice_pp"] for r in results])
    print(f"  v1 (base_features=16, flips seuls)  : Dice = {v1_dice:.4f}")
    print(f"  v2 (base_features=32, aug+PP)       : Dice = {v2_dice:.4f}")
    print(f"  Amelioration                        : {v2_dice - v1_dice:+.4f}")
    print("=" * 70)


if __name__ == "__main__":
    main()