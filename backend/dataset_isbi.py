"""
Dataset PyTorch pour ISBI 2015 (MSLSC) - Segmentation lesions SEP
==================================================================
VERSION 2 - Corrections :
  - _sample_valid_patch() boucle jusqu'a trouver un patch qui contient
    vraiment assez de lesions (au moins MIN_LESION_VOXELS_PER_PATCH)
  - Bloc de test enrichi : % de patches avec lesion, distribution
  - Mode debug : sauvegarde de patches en PNG pour inspection visuelle
 
Usage :
    python dataset_isbi.py              # test simple
    python dataset_isbi.py --debug      # test + sauvegarde PNG
"""
 
from pathlib import Path
from typing import List, Tuple, Dict
import random
import sys
 
import numpy as np
import nibabel as nib
import torch
from torch.utils.data import Dataset, DataLoader
 
 
# =============================================================================
# CONFIGURATION
# =============================================================================
DATA_ROOT = Path(r"Z:\PROJET_SEP\backend\data\mslsc")
DEBUG_DIR = Path("./debug_patches")
 
PATCH_SIZE = (64, 64, 64)
PATCHES_PER_VOLUME = 32
LESION_SAMPLING_PROB = 0.5
 
# NOUVEAU : nombre minimum de voxels lesion requis dans un patch "lesion".
# En-dessous de ce seuil, on re-echantillonne (max MAX_RESAMPLE_TRIES essais).
# 50 voxels sur 262 144 = ~0.02% : assez pour avoir un signal clair mais pas
# si restrictif qu'on boucle sans fin sur les petits patients.
MIN_LESION_VOXELS_PER_PATCH = 50
MAX_RESAMPLE_TRIES = 10
 
TRAIN_PATIENTS = ["training01", "training02", "training03", "training04"]
VAL_PATIENTS = ["training05"]
 
 
# =============================================================================
# CHARGEMENT ET PREPROCESSING (inchange)
# =============================================================================
def find_mask_paths(flair_path: Path) -> Tuple[Path, Path]:
    base = flair_path.stem.replace("_flair_pp", "")
    patient_id = base.split("_")[0]
    if patient_id == "training01":
        mask_dir = DATA_ROOT / "masks"
    else:
        mask_dir = DATA_ROOT / patient_id / "masks"
    return mask_dir / f"{base}_mask1.nii", mask_dir / f"{base}_mask2.nii"
 
 
def load_and_preprocess(flair_path: Path) -> Tuple[np.ndarray, np.ndarray]:
    flair = nib.load(str(flair_path)).get_fdata().astype(np.float32)
    mask1_path, mask2_path = find_mask_paths(flair_path)
    mask1 = nib.load(str(mask1_path)).get_fdata().astype(np.uint8)
    mask2 = nib.load(str(mask2_path)).get_fdata().astype(np.uint8)
    mask = np.logical_or(mask1, mask2).astype(np.uint8)
 
    brain_mask = flair > 0
    brain_values = flair[brain_mask]
    p1, p99 = np.percentile(brain_values, [1, 99])
    flair = np.clip(flair, p1, p99)
 
    brain_values_clipped = flair[brain_mask]
    mean = brain_values_clipped.mean()
    std = brain_values_clipped.std()
    flair = (flair - mean) / (std + 1e-8)
    flair[~brain_mask] = 0.0
 
    return flair.astype(np.float32), mask
 
 
# =============================================================================
# DATASET PYTORCH (corrige)
# =============================================================================
class ISBIDataset(Dataset):
 
    def __init__(
        self,
        flair_paths: List[Path],
        patch_size: Tuple[int, int, int] = PATCH_SIZE,
        patches_per_volume: int = PATCHES_PER_VOLUME,
        lesion_sampling_prob: float = LESION_SAMPLING_PROB,
        augment: bool = True,
    ):
        self.patch_size = patch_size
        self.patches_per_volume = patches_per_volume
        self.lesion_sampling_prob = lesion_sampling_prob
        self.augment = augment
 
        print(f"[ISBIDataset] Chargement de {len(flair_paths)} volumes...")
        self.volumes: List[Dict] = []
        for p in flair_paths:
            flair, mask = load_and_preprocess(p)
            lesion_coords = np.argwhere(mask > 0)
            self.volumes.append({
                "flair": flair,
                "mask": mask,
                "lesion_coords": lesion_coords,
                "name": p.stem,
            })
            print(f"  [OK] {p.stem}  shape={flair.shape}  "
                  f"lesion_voxels={len(lesion_coords):,}")
 
        print(f"[ISBIDataset] Pret. "
              f"{len(self.volumes)} volumes x {patches_per_volume} patches "
              f"= {len(self)} patches par epoch")
 
    def __len__(self) -> int:
        return len(self.volumes) * self.patches_per_volume
 
    def _extract_patch(self, vol: Dict, x: int, y: int, z: int
                       ) -> Tuple[np.ndarray, np.ndarray]:
        ph, pw, pd = self.patch_size
        flair_p = vol["flair"][x:x + ph, y:y + pw, z:z + pd]
        mask_p = vol["mask"][x:x + ph, y:y + pw, z:z + pd]
        return flair_p, mask_p
 
    def _origin_centered_on_lesion(self, vol: Dict
                                   ) -> Tuple[int, int, int]:
        """Origine de patch centree sur un voxel lesion aleatoire (avec jitter)."""
        flair_shape = vol["flair"].shape
        ph, pw, pd = self.patch_size
        max_x = flair_shape[0] - ph
        max_y = flair_shape[1] - pw
        max_z = flair_shape[2] - pd
 
        cx, cy, cz = vol["lesion_coords"][
            random.randint(0, len(vol["lesion_coords"]) - 1)
        ]
        # Jitter : evite que la lesion soit toujours exactement au centre
        # (sinon le modele apprend une position privilegiee)
        jitter = 16
        x = cx - ph // 2 + random.randint(-jitter, jitter)
        y = cy - pw // 2 + random.randint(-jitter, jitter)
        z = cz - pd // 2 + random.randint(-jitter, jitter)
        return (max(0, min(x, max_x)),
                max(0, min(y, max_y)),
                max(0, min(z, max_z)))
 
    def _random_origin(self, vol: Dict) -> Tuple[int, int, int]:
        flair_shape = vol["flair"].shape
        ph, pw, pd = self.patch_size
        return (random.randint(0, flair_shape[0] - ph),
                random.randint(0, flair_shape[1] - pw),
                random.randint(0, flair_shape[2] - pd))
 
    def _sample_valid_patch(self, vol: Dict
                            ) -> Tuple[np.ndarray, np.ndarray]:
        """
        CORRECTION CLE :
        Reessaie jusqu'a obtenir un patch qui contient vraiment assez de
        lesions (>= MIN_LESION_VOXELS_PER_PATCH). Evite de tomber sur une
        lesion isolee d'un seul voxel dans un patch majoritairement de fond.
        """
        sample_lesion = (
            len(vol["lesion_coords"]) > 0
            and random.random() < self.lesion_sampling_prob
        )
 
        if sample_lesion:
            last_patch = None
            for _ in range(MAX_RESAMPLE_TRIES):
                x, y, z = self._origin_centered_on_lesion(vol)
                flair_p, mask_p = self._extract_patch(vol, x, y, z)
                if mask_p.sum() >= MIN_LESION_VOXELS_PER_PATCH:
                    return flair_p, mask_p
                last_patch = (flair_p, mask_p)
            # Fallback : on retourne le dernier patch tente (mieux que rien)
            return last_patch
        else:
            x, y, z = self._random_origin(vol)
            return self._extract_patch(vol, x, y, z)
 
    def _augment(self, flair: np.ndarray, mask: np.ndarray
                 ) -> Tuple[np.ndarray, np.ndarray]:
        for axis in range(3):
            if random.random() < 0.5:
                flair = np.flip(flair, axis=axis)
                mask = np.flip(mask, axis=axis)
        return flair.copy(), mask.copy()
 
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        vol_idx = idx // self.patches_per_volume
        vol = self.volumes[vol_idx]
 
        flair_patch, mask_patch = self._sample_valid_patch(vol)
 
        if self.augment:
            flair_patch, mask_patch = self._augment(flair_patch, mask_patch)
 
        flair_tensor = torch.from_numpy(flair_patch).unsqueeze(0).float()
        mask_tensor = torch.from_numpy(mask_patch).unsqueeze(0).float()
        return flair_tensor, mask_tensor
 
 
# =============================================================================
# HELPERS
# =============================================================================
def list_flair_files_for_patients(patients: List[str]) -> List[Path]:
    files = []
    for patient_id in patients:
        if patient_id == "training01":
            pattern = f"preprocessed/{patient_id}_*_flair_pp.nii"
            files.extend(sorted(DATA_ROOT.glob(pattern)))
        else:
            pattern = f"{patient_id}/preprocessed/{patient_id}_*_flair_pp.nii"
            files.extend(sorted(DATA_ROOT.glob(pattern)))
    return files
 
 
def get_dataloaders(batch_size: int = 2, num_workers: int = 0
                    ) -> Tuple[DataLoader, DataLoader]:
    train_paths = list_flair_files_for_patients(TRAIN_PATIENTS)
    val_paths = list_flair_files_for_patients(VAL_PATIENTS)
 
    print(f"\nTrain : {len(train_paths)} volumes ({TRAIN_PATIENTS})")
    print(f"Val   : {len(val_paths)} volumes ({VAL_PATIENTS})\n")
 
    train_ds = ISBIDataset(train_paths, augment=True)
    val_ds = ISBIDataset(
        val_paths, augment=False,
        patches_per_volume=16, lesion_sampling_prob=0.5,
    )
 
    train_loader = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True,
        num_workers=num_workers, pin_memory=True, drop_last=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=True, drop_last=False,
    )
    return train_loader, val_loader
 
 
# =============================================================================
# DEBUG : sauvegarde de patches en PNG
# =============================================================================
def save_debug_patches(dataset: ISBIDataset, n_patches: int = 8):
    import matplotlib.pyplot as plt
    DEBUG_DIR.mkdir(exist_ok=True)
    print(f"\n[DEBUG] Sauvegarde de {n_patches} patches dans {DEBUG_DIR}/")
 
    step = max(1, len(dataset) // n_patches)
    for i in range(n_patches):
        flair_t, mask_t = dataset[i * step]
        flair = flair_t.squeeze(0).numpy()
        mask = mask_t.squeeze(0).numpy()
 
        lesion_per_slice = mask.sum(axis=(0, 1))
        if lesion_per_slice.sum() > 0:
            best_z = int(np.argmax(lesion_per_slice))
        else:
            best_z = 32
 
        n_lesion_total = int(mask.sum())
 
        fig, axes = plt.subplots(1, 3, figsize=(12, 4))
        axes[0].imshow(flair[:, :, best_z].T, cmap="gray", origin="lower")
        axes[0].set_title(f"FLAIR (patch {i})")
        axes[0].axis("off")
 
        axes[1].imshow(mask[:, :, best_z].T, cmap="hot", origin="lower")
        axes[1].set_title(f"Mask ({n_lesion_total} vx total)")
        axes[1].axis("off")
 
        axes[2].imshow(flair[:, :, best_z].T, cmap="gray", origin="lower")
        m_slice = mask[:, :, best_z].T
        m_disp = np.ma.masked_where(m_slice == 0, m_slice)
        axes[2].imshow(m_disp, cmap="autumn", alpha=0.6, origin="lower")
        axes[2].set_title(f"Overlay (slice {best_z})")
        axes[2].axis("off")
 
        plt.tight_layout()
        plt.savefig(DEBUG_DIR / f"patch_{i:02d}.png", dpi=80,
                    bbox_inches="tight")
        plt.close()
        print(f"  [OK] patch_{i:02d}.png  -  {n_lesion_total} voxels lesion")
 
 
# =============================================================================
# BLOC DE TEST
# =============================================================================
if __name__ == "__main__":
    debug_mode = "--debug" in sys.argv
 
    print("=" * 70)
    print("TEST DU DATASET ISBI v2")
    print("=" * 70)
 
    train_loader, val_loader = get_dataloaders(batch_size=2)
 
    # ---- Metriques sur une epoch complete ----
    print("\n" + "=" * 70)
    print("STATISTIQUES SUR UNE EPOCH TRAIN COMPLETE")
    print("=" * 70)
 
    total_patches = 0
    patches_with_lesion = 0
    total_lesion_voxels = 0
    lesion_voxels_per_patch = []
 
    for flair_b, mask_b in train_loader:
        for i in range(flair_b.shape[0]):
            total_patches += 1
            n_lesion = int(mask_b[i].sum().item())
            total_lesion_voxels += n_lesion
            lesion_voxels_per_patch.append(n_lesion)
            if n_lesion > 0:
                patches_with_lesion += 1
 
    total_voxels = total_patches * int(np.prod(PATCH_SIZE))
    ratio_global = 100 * total_lesion_voxels / total_voxels
    pct_with_lesion = 100 * patches_with_lesion / total_patches
    lesion_arr = np.array(lesion_voxels_per_patch)
    pct_above_min = 100 * (lesion_arr >= MIN_LESION_VOXELS_PER_PATCH).mean()
 
    print(f"  Patches totaux vus                : {total_patches}")
    print(f"  Patches avec >=1 lesion           : {patches_with_lesion} "
          f"({pct_with_lesion:.1f} %)")
    print(f"  Patches avec >={MIN_LESION_VOXELS_PER_PATCH} voxels lesion    : "
          f"{int((lesion_arr >= MIN_LESION_VOXELS_PER_PATCH).sum())} "
          f"({pct_above_min:.1f} %)")
    print(f"  Voxels lesion par patch :")
    print(f"    min     : {int(lesion_arr.min())}")
    print(f"    max     : {int(lesion_arr.max())}")
    print(f"    mediane : {int(np.median(lesion_arr))}")
    print(f"    moyenne : {int(lesion_arr.mean())}")
    print(f"  Ratio lesion global sur l'epoch   : {ratio_global:.3f} %")
    print(f"  (Rappel : 0.21 % dans le volume complet)")
 
    # ---- Diagnostic ----
    print("\n" + "=" * 70)
    print("DIAGNOSTIC")
    print("=" * 70)
    if pct_with_lesion >= 45:
        print(f"  [OK] {pct_with_lesion:.0f}% des patches contiennent "
              f"au moins une lesion")
    else:
        print(f"  [!!] Seulement {pct_with_lesion:.0f}% des patches "
              f"contiennent une lesion")
 
    if ratio_global >= 1.0:
        print(f"  [OK] Ratio global {ratio_global:.2f}% : bon signal")
    else:
        print(f"  [!!] Ratio global {ratio_global:.2f}% trop faible")
 
    if debug_mode:
        save_debug_patches(train_loader.dataset, n_patches=8)
 
    print("\n" + "=" * 70)
    print("DATASET v2 OK")
    if not debug_mode:
        print("Relance avec --debug pour sauvegarder des patches en PNG :")
        print("  python dataset_isbi.py --debug")
    print("=" * 70)
 