"""
Script d'exploration du dataset ISBI 2015 (MSLSC)
--------------------------------------------------
But : comprendre la structure et les caracteristiques des donnees
      avant de construire le pipeline d'entrainement du U-Net 3D.

Usage :
    python explore_isbi.py

Sortie :
    - Affichage console : infos techniques sur les volumes
    - Dossier ./exploration_output/ : visualisations PNG
"""

from pathlib import Path
import numpy as np
import nibabel as nib
import matplotlib.pyplot as plt
from collections import defaultdict

# =============================================================================
# CONFIGURATION - adapte ce chemin si besoin
# =============================================================================
DATA_ROOT = Path(r"Z:\PROJET_SEP\backend\data\mslsc")
OUTPUT_DIR = Path("./exploration_output")
OUTPUT_DIR.mkdir(exist_ok=True)


# =============================================================================
# ETAPE 1 : Inventaire du dataset
# =============================================================================
def inventory_dataset(root: Path):
    """Parcourt le dataset et recense tous les couples (flair, masks) disponibles."""
    print("=" * 70)
    print("ETAPE 1 : INVENTAIRE DU DATASET")
    print("=" * 70)

    # Collecte tous les fichiers FLAIR preprocessees (training01 est a la racine,
    # les autres sont dans leur propre sous-dossier)
    flair_files = []
    flair_files.extend(root.glob("preprocessed/*_flair_pp.nii"))
    flair_files.extend(root.glob("training*/preprocessed/*_flair_pp.nii"))

    # Regroupe par patient
    patients = defaultdict(list)
    for f in sorted(flair_files):
        # Nom type : training01_02_flair_pp.nii  ->  patient='training01', timepoint='02'
        stem = f.stem.replace("_flair_pp", "")
        parts = stem.split("_")
        patient_id = parts[0]
        timepoint = parts[1]
        patients[patient_id].append((timepoint, f))

    total_volumes = 0
    for patient_id in sorted(patients.keys()):
        timepoints = patients[patient_id]
        print(f"  {patient_id} : {len(timepoints)} timepoint(s) -> "
              f"{[tp for tp, _ in sorted(timepoints)]}")
        total_volumes += len(timepoints)

    print(f"\n  >>> Total : {len(patients)} patients, {total_volumes} volumes FLAIR")
    return patients


# =============================================================================
# ETAPE 2 : Inspection detaillee d'un volume
# =============================================================================
def find_mask_for_flair(flair_path: Path):
    """Trouve les deux masks correspondant a un fichier FLAIR."""
    # training01_01_flair_pp.nii  ->  training01_01
    base = flair_path.stem.replace("_flair_pp", "")
    patient_id = base.split("_")[0]

    # Les masks sont soit a data/mslsc/masks/ (pour training01)
    # soit a data/mslsc/trainingXX/masks/ (pour les autres)
    if patient_id == "training01":
        mask_dir = DATA_ROOT / "masks"
    else:
        mask_dir = DATA_ROOT / patient_id / "masks"

    mask1 = mask_dir / f"{base}_mask1.nii"
    mask2 = mask_dir / f"{base}_mask2.nii"
    return mask1, mask2


def inspect_volume(flair_path: Path):
    """Charge un volume FLAIR + ses masks et affiche toutes les infos utiles."""
    print("\n" + "=" * 70)
    print(f"ETAPE 2 : INSPECTION DETAILLEE")
    print(f"Volume analyse : {flair_path.name}")
    print("=" * 70)

    # --- Chargement de la FLAIR ---
    flair_nii = nib.load(str(flair_path))
    flair = flair_nii.get_fdata()

    print("\n[FLAIR]")
    print(f"  Shape           : {flair.shape}")
    print(f"  Dtype           : {flair.dtype}")
    print(f"  Voxel spacing   : {flair_nii.header.get_zooms()} mm")
    print(f"  Orientation     : {nib.aff2axcodes(flair_nii.affine)}")
    print(f"  Min / Max       : {flair.min():.2f} / {flair.max():.2f}")
    print(f"  Mean / Std      : {flair.mean():.2f} / {flair.std():.2f}")
    print(f"  Median          : {np.median(flair):.2f}")
    # Percentiles : utile pour decider du clipping lors du preprocessing
    p01, p99 = np.percentile(flair, [1, 99])
    print(f"  P1  / P99       : {p01:.2f} / {p99:.2f}")

    # --- Chargement des masks ---
    mask1_path, mask2_path = find_mask_for_flair(flair_path)
    if not mask1_path.exists() or not mask2_path.exists():
        print(f"\n  [!] Masks introuvables pour ce volume")
        print(f"      Cherche : {mask1_path}")
        print(f"      Cherche : {mask2_path}")
        return None

    mask1 = nib.load(str(mask1_path)).get_fdata().astype(np.uint8)
    mask2 = nib.load(str(mask2_path)).get_fdata().astype(np.uint8)

    print("\n[MASKS]")
    print(f"  Mask1 shape     : {mask1.shape}")
    print(f"  Mask2 shape     : {mask2.shape}")
    print(f"  Mask1 valeurs   : {np.unique(mask1)}")
    print(f"  Mask2 valeurs   : {np.unique(mask2)}")

    # --- Statistiques des lesions ---
    total_voxels = mask1.size
    lesion_vox_m1 = int(mask1.sum())
    lesion_vox_m2 = int(mask2.sum())
    ratio_m1 = 100 * lesion_vox_m1 / total_voxels
    ratio_m2 = 100 * lesion_vox_m2 / total_voxels

    print("\n[STATISTIQUES LESIONS]")
    print(f"  Voxels totaux        : {total_voxels:,}")
    print(f"  Voxels lesion mask1  : {lesion_vox_m1:,} ({ratio_m1:.3f} %)")
    print(f"  Voxels lesion mask2  : {lesion_vox_m2:,} ({ratio_m2:.3f} %)")

    # Volume physique en mL (1 mL = 1000 mm3)
    voxel_vol_mm3 = np.prod(flair_nii.header.get_zooms())
    vol_m1_ml = lesion_vox_m1 * voxel_vol_mm3 / 1000
    vol_m2_ml = lesion_vox_m2 * voxel_vol_mm3 / 1000
    print(f"  Volume lesion mask1  : {vol_m1_ml:.2f} mL")
    print(f"  Volume lesion mask2  : {vol_m2_ml:.2f} mL")

    # --- Accord inter-experts (Dice entre mask1 et mask2) ---
    intersection = np.logical_and(mask1, mask2).sum()
    union = mask1.sum() + mask2.sum()
    dice_inter_rater = (2 * intersection) / union if union > 0 else 0
    print(f"\n[ACCORD INTER-EXPERTS]")
    print(f"  Dice mask1 vs mask2  : {dice_inter_rater:.4f}")
    print(f"  (c'est le plafond theorique que notre modele peut atteindre)")

    # --- Consensus : union des deux experts ---
    consensus = np.logical_or(mask1, mask2).astype(np.uint8)

    return {
        "flair": flair,
        "mask1": mask1,
        "mask2": mask2,
        "consensus": consensus,
        "affine": flair_nii.affine,
        "name": flair_path.stem,
    }


# =============================================================================
# ETAPE 3 : Visualisation
# =============================================================================
def visualize_volume(data: dict, out_dir: Path):
    """Sauvegarde des visualisations PNG avec overlay des lesions."""
    print("\n" + "=" * 70)
    print("ETAPE 3 : VISUALISATIONS")
    print("=" * 70)

    flair = data["flair"]
    mask = data["consensus"]
    name = data["name"]

    # Trouve les slices les plus interessantes : celles qui contiennent
    # le plus de lesions (axe axial = dernier axe generalement)
    lesions_per_slice = mask.sum(axis=(0, 1))
    if lesions_per_slice.sum() == 0:
        print("  [!] Aucune lesion dans ce volume, affichage de slices centrales")
        best_slices = [flair.shape[2] // 2 - 10,
                       flair.shape[2] // 2,
                       flair.shape[2] // 2 + 10]
    else:
        # Les 3 slices avec le plus de lesions
        best_slices = np.argsort(lesions_per_slice)[-3:][::-1]

    # Clipping pour un meilleur contraste d'affichage
    p1, p99 = np.percentile(flair, [1, 99])
    flair_display = np.clip(flair, p1, p99)

    fig, axes = plt.subplots(2, 3, figsize=(12, 8))
    for col, slice_idx in enumerate(best_slices):
        # Ligne 1 : FLAIR seule
        axes[0, col].imshow(flair_display[:, :, slice_idx].T,
                            cmap="gray", origin="lower")
        axes[0, col].set_title(f"FLAIR - slice {slice_idx}")
        axes[0, col].axis("off")

        # Ligne 2 : FLAIR + overlay mask
        axes[1, col].imshow(flair_display[:, :, slice_idx].T,
                            cmap="gray", origin="lower")
        mask_slice = mask[:, :, slice_idx].T
        # On masque les zeros pour que l'overlay soit transparent hors lesion
        mask_display = np.ma.masked_where(mask_slice == 0, mask_slice)
        axes[1, col].imshow(mask_display, cmap="autumn", alpha=0.6,
                            origin="lower")
        n_lesion = int(mask[:, :, slice_idx].sum())
        axes[1, col].set_title(f"+ lesions ({n_lesion} vx)")
        axes[1, col].axis("off")

    plt.suptitle(f"{name}  -  consensus (mask1 OR mask2)")
    plt.tight_layout()
    out_path = out_dir / f"{name}_overlay.png"
    plt.savefig(out_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"  [OK] Visualisation sauvee : {out_path}")

    # Histogramme des intensites FLAIR
    fig, ax = plt.subplots(figsize=(8, 4))
    # On enleve les zeros (fond) pour mieux voir la distribution du cerveau
    non_zero = flair[flair > 0]
    ax.hist(non_zero, bins=100, color="steelblue", edgecolor="black")
    ax.set_xlabel("Intensite FLAIR")
    ax.set_ylabel("Nombre de voxels")
    ax.set_title(f"Distribution des intensites (voxels non-nuls)  -  {name}")
    ax.axvline(p1, color="red", linestyle="--", label=f"P1 = {p1:.1f}")
    ax.axvline(p99, color="red", linestyle="--", label=f"P99 = {p99:.1f}")
    ax.legend()
    plt.tight_layout()
    hist_path = out_dir / f"{name}_histogram.png"
    plt.savefig(hist_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"  [OK] Histogramme sauve     : {hist_path}")


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    if not DATA_ROOT.exists():
        print(f"[ERREUR] Dossier introuvable : {DATA_ROOT}")
        raise SystemExit(1)

    # 1. Inventaire
    patients = inventory_dataset(DATA_ROOT)

    if not patients:
        print("[ERREUR] Aucun fichier FLAIR trouve")
        raise SystemExit(1)

    # 2. On inspecte le premier timepoint du premier patient
    first_patient = sorted(patients.keys())[0]
    first_timepoint, first_flair = sorted(patients[first_patient])[0]
    print(f"\n>>> Volume choisi pour l'inspection : "
          f"{first_patient} timepoint {first_timepoint}")

    data = inspect_volume(first_flair)

    if data is None:
        raise SystemExit(1)

    # 3. Visualisation
    visualize_volume(data, OUTPUT_DIR)

    # 4. Bonus : on calcule les stats moyennes sur TOUS les volumes
    print("\n" + "=" * 70)
    print("ETAPE 4 : STATISTIQUES GLOBALES (tous volumes)")
    print("=" * 70)
    all_ratios = []
    all_dice_inter = []
    all_shapes = set()
    all_spacings = set()

    for patient_id, timepoints in sorted(patients.items()):
        for tp, flair_path in sorted(timepoints):
            mask1_p, mask2_p = find_mask_for_flair(flair_path)
            if not (mask1_p.exists() and mask2_p.exists()):
                continue

            nii = nib.load(str(flair_path))
            all_shapes.add(nii.shape)
            all_spacings.add(tuple(round(z, 2) for z in nii.header.get_zooms()))

            m1 = nib.load(str(mask1_p)).get_fdata().astype(bool)
            m2 = nib.load(str(mask2_p)).get_fdata().astype(bool)
            consensus = m1 | m2
            ratio = 100 * consensus.sum() / consensus.size
            all_ratios.append(ratio)

            inter = (m1 & m2).sum()
            union = m1.sum() + m2.sum()
            if union > 0:
                all_dice_inter.append(2 * inter / union)

    print(f"  Shapes rencontrees    : {all_shapes}")
    print(f"  Spacings rencontres   : {all_spacings}")
    print(f"  Ratio lesion moyen    : {np.mean(all_ratios):.3f} % "
          f"(min {min(all_ratios):.3f}, max {max(all_ratios):.3f})")
    print(f"  Dice inter-experts    : {np.mean(all_dice_inter):.4f} "
          f"(min {min(all_dice_inter):.4f}, max {max(all_dice_inter):.4f})")

    print("\n" + "=" * 70)
    print("EXPLORATION TERMINEE")
    print(f"Ouvre le dossier '{OUTPUT_DIR}' pour voir les visualisations.")
    print("=" * 70)
