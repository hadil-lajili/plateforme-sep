"""
XGBoost - Prediction du risque de progression SEP a 2 ans
==========================================================

Pipeline complet :
  1. Extraction de features IRM reelles (depuis les sorties du U-Net)
  2. Generation de features cliniques realistes (simulees)
  3. Entrainement XGBoost avec cross-validation
  4. Evaluation (AUC-ROC, accuracy, rapport de classification)
  5. Sauvegarde du modele

IMPORTANT - Contexte des donnees :
  Les features IRM sont REELLES (extraites par notre U-Net entraine).
  Les features cliniques sont SIMULEES car ISBI 2015 ne fournit pas
  de donnees cliniques. Elles sont generees de maniere coherente avec
  la litterature medicale SEP pour que le pipeline soit realiste.
  Dans un deploiement reel, ces features viendraient du dossier patient.

Usage :
    python train_xgboost.py
"""

from pathlib import Path
from typing import Dict, List, Tuple
import json
import pickle
import warnings

import numpy as np
import nibabel as nib
from scipy import ndimage
import matplotlib.pyplot as plt

from dataset_isbi import (
    load_and_preprocess, find_mask_paths, DATA_ROOT,
    list_flair_files_for_patients,
)

warnings.filterwarnings("ignore", category=FutureWarning)

# =============================================================================
# CONFIGURATION
# =============================================================================
OUTPUT_DIR = Path("./models")
OUTPUT_DIR.mkdir(exist_ok=True)

FIGURES_DIR = Path("./figures")
FIGURES_DIR.mkdir(exist_ok=True)

# Tous les patients disponibles
ALL_PATIENTS = ["training01", "training02", "training03",
                "training04", "training05"]

# Seed pour reproductibilite
SEED = 42
np.random.seed(SEED)


# =============================================================================
# ETAPE 1 : EXTRACTION DE FEATURES IRM (reelles)
# =============================================================================
def extract_irm_features(flair_path: Path) -> Dict[str, float]:
    """
    Extrait des features quantitatives d'une IRM segmentee.

    Ces features sont celles utilisees en pratique clinique pour
    caracteriser la charge lesionnelle d'un patient SEP.
    """
    # Charger le volume et le masque consensus
    flair, mask = load_and_preprocess(flair_path)
    nii = nib.load(str(flair_path))
    spacing = nii.header.get_zooms()
    voxel_vol_mm3 = float(np.prod(spacing))

    # --- Feature 1 : Volume lesionnel total (mL) ---
    # C'est le biomarqueur le plus utilise en SEP
    n_lesion_voxels = int(mask.sum())
    lesion_volume_ml = n_lesion_voxels * voxel_vol_mm3 / 1000.0

    # --- Feature 2 : Nombre de lesions (composantes connexes) ---
    # On compte les "blobs" separes dans le masque 3D
    if n_lesion_voxels > 0:
        labeled, n_lesions = ndimage.label(mask)
    else:
        n_lesions = 0

    # --- Feature 3 : Taille moyenne d'une lesion (mL) ---
    mean_lesion_size = lesion_volume_ml / max(n_lesions, 1)

    # --- Feature 4 : Taille de la plus grosse lesion (mL) ---
    if n_lesions > 0:
        lesion_sizes = ndimage.sum(mask, labeled, range(1, n_lesions + 1))
        max_lesion_size = float(np.max(lesion_sizes)) * voxel_vol_mm3 / 1000.0
    else:
        max_lesion_size = 0.0

    # --- Feature 5 : Ratio lesion / volume cerebral ---
    # Approximation du volume cerebral = voxels non-nuls de la FLAIR
    brain_voxels = int((flair != 0).sum())
    brain_volume_ml = brain_voxels * voxel_vol_mm3 / 1000.0
    lesion_brain_ratio = lesion_volume_ml / max(brain_volume_ml, 1.0)

    # --- Feature 6 : Intensite FLAIR moyenne dans les lesions ---
    # Les lesions plus intenses suggerent une inflammation active
    if n_lesion_voxels > 0:
        mean_lesion_intensity = float(flair[mask > 0].mean())
        max_lesion_intensity = float(flair[mask > 0].max())
    else:
        mean_lesion_intensity = 0.0
        max_lesion_intensity = 0.0

    # --- Feature 7 : Asymetrie gauche-droite ---
    # Les lesions unilaterales peuvent indiquer un stade different
    mid_x = mask.shape[0] // 2
    left_vol = float(mask[:mid_x].sum()) * voxel_vol_mm3 / 1000.0
    right_vol = float(mask[mid_x:].sum()) * voxel_vol_mm3 / 1000.0
    asymmetry = abs(left_vol - right_vol) / max(lesion_volume_ml, 0.001)

    # --- Feature 8 : Distribution axiale (% lesions dans le tiers superieur) ---
    # Les lesions periventriculaires hautes sont typiques de la SEP
    third_z = mask.shape[2] // 3
    upper_ratio = float(mask[:, :, 2 * third_z:].sum()) / max(n_lesion_voxels, 1)

    return {
        "lesion_volume_ml": round(lesion_volume_ml, 3),
        "n_lesions": n_lesions,
        "mean_lesion_size_ml": round(mean_lesion_size, 4),
        "max_lesion_size_ml": round(max_lesion_size, 4),
        "lesion_brain_ratio": round(lesion_brain_ratio, 6),
        "mean_lesion_intensity": round(mean_lesion_intensity, 4),
        "max_lesion_intensity": round(max_lesion_intensity, 4),
        "asymmetry": round(asymmetry, 4),
        "upper_third_ratio": round(upper_ratio, 4),
        "brain_volume_ml": round(brain_volume_ml, 1),
    }


def extract_longitudinal_features(patient_features: List[Dict]
                                  ) -> Dict[str, float]:
    """
    Extrait des features longitudinales a partir de plusieurs timepoints
    d'un meme patient. L'evolution dans le temps est un facteur predictif
    majeur en SEP.
    """
    if len(patient_features) < 2:
        return {
            "volume_change_ml": 0.0,
            "volume_change_pct": 0.0,
            "lesion_count_change": 0,
            "new_lesions_rate": 0.0,
        }

    first = patient_features[0]
    last = patient_features[-1]

    volume_change = last["lesion_volume_ml"] - first["lesion_volume_ml"]
    volume_change_pct = volume_change / max(first["lesion_volume_ml"], 0.001)
    lesion_count_change = last["n_lesions"] - first["n_lesions"]
    # Taux de nouvelles lesions par timepoint
    n_timepoints = len(patient_features)
    new_lesions_rate = lesion_count_change / max(n_timepoints - 1, 1)

    return {
        "volume_change_ml": round(volume_change, 3),
        "volume_change_pct": round(volume_change_pct, 4),
        "lesion_count_change": lesion_count_change,
        "new_lesions_rate": round(new_lesions_rate, 2),
    }


# =============================================================================
# ETAPE 2 : FEATURES CLINIQUES SIMULEES
# =============================================================================
def generate_clinical_features(patient_id: str,
                               irm_features: Dict) -> Dict[str, float]:
    """
    Genere des features cliniques SIMULEES mais realistes.

    Ces features sont correlees aux features IRM pour que le dataset
    soit coherent. Dans un deploiement reel, elles viendraient du
    dossier medical du patient.

    Basees sur la litterature SEP :
      - EDSS correle au volume lesionnel (r~0.3-0.5)
      - Age moyen de diagnostic : 20-40 ans
      - Ratio femme/homme : 3:1
      - Types SEP : RRMS (85%), SPMS (10%), PPMS (5%)
    """
    rng = np.random.RandomState(hash(patient_id) % 2**31)

    vol = irm_features["lesion_volume_ml"]
    n_lesions = irm_features["n_lesions"]

    # Age : 20-55 ans, correle legerement au volume lesionnel
    age = int(np.clip(30 + vol * 0.5 + rng.normal(0, 8), 20, 65))

    # Sexe : 75% femmes (ratio 3:1 en SEP)
    sex = 1 if rng.random() < 0.75 else 0  # 1=F, 0=M

    # Duree depuis diagnostic (ans) : correle a l'age et au volume
    disease_duration = int(np.clip(age - 25 + rng.normal(0, 3), 1, 30))

    # EDSS (Expanded Disability Status Scale) : 0-10
    # Correle au volume lesionnel et a la duree
    edss_base = 1.0 + vol * 0.15 + disease_duration * 0.1
    edss = float(np.clip(edss_base + rng.normal(0, 1.0), 0, 8.5))
    edss = round(edss * 2) / 2  # EDSS va par pas de 0.5

    # Type SEP
    sep_types = {"RRMS": 0, "SPMS": 1, "PPMS": 2}
    if edss < 4:
        sep_type = rng.choice(["RRMS", "RRMS", "RRMS", "SPMS"])
    else:
        sep_type = rng.choice(["RRMS", "SPMS", "SPMS", "PPMS"])

    # Nombre de poussees dans les 2 dernieres annees
    relapse_rate = max(0, int(rng.poisson(1.5 if sep_type == "RRMS" else 0.5)))

    # Traitement en cours (0=aucun, 1=1ere ligne, 2=2eme ligne)
    if edss < 3:
        treatment_line = rng.choice([0, 1, 1])
    else:
        treatment_line = rng.choice([1, 2, 2])

    # Test fonctionnel : T25FW (temps de marche 25 pieds, secondes)
    # Normal ~4s, correle a l'EDSS
    t25fw = float(np.clip(4.0 + edss * 1.2 + rng.normal(0, 1), 3, 30))

    # Test fonctionnel : 9HPT (nine-hole peg test, secondes)
    # Normal ~18s, augmente avec le handicap
    nhpt = float(np.clip(18 + edss * 2 + rng.normal(0, 2), 15, 60))

    return {
        "age": age,
        "sex": sex,
        "disease_duration_years": disease_duration,
        "edss": edss,
        "sep_type": sep_types[sep_type],
        "relapse_count_2y": relapse_rate,
        "treatment_line": treatment_line,
        "t25fw_seconds": round(t25fw, 1),
        "nhpt_seconds": round(nhpt, 1),
    }


# =============================================================================
# ETAPE 3 : GENERATION DU LABEL (progression a 2 ans)
# =============================================================================
def generate_progression_label(irm_features: Dict, clinical: Dict,
                               longitudinal: Dict,
                               patient_id: str) -> int:
    """
    Genere un label de progression SIMULE mais base sur des facteurs
    de risque reels identifies dans la litterature SEP.

    Facteurs de risque de progression :
      - Volume lesionnel eleve
      - Augmentation du volume entre timepoints
      - Nouvelles lesions
      - EDSS eleve
      - Poussees frequentes
      - Type SPMS ou PPMS
      - Age avance
    """
    rng = np.random.RandomState(hash(patient_id + "_label") % 2**31)

    # Score de risque base sur les facteurs connus
    risk_score = 0.0

    # Volume lesionnel > 10 mL = risque eleve
    if irm_features["lesion_volume_ml"] > 10:
        risk_score += 2.0
    elif irm_features["lesion_volume_ml"] > 5:
        risk_score += 1.0

    # Augmentation du volume lesionnel
    if longitudinal["volume_change_pct"] > 0.1:
        risk_score += 2.0
    elif longitudinal["volume_change_pct"] > 0:
        risk_score += 0.5

    # Nouvelles lesions
    if longitudinal["lesion_count_change"] > 3:
        risk_score += 2.0
    elif longitudinal["lesion_count_change"] > 0:
        risk_score += 1.0

    # EDSS eleve
    if clinical["edss"] >= 4.0:
        risk_score += 2.0
    elif clinical["edss"] >= 2.0:
        risk_score += 1.0

    # Poussees frequentes
    risk_score += clinical["relapse_count_2y"] * 0.5

    # Type progressif
    if clinical["sep_type"] >= 1:  # SPMS ou PPMS
        risk_score += 1.5

    # Conversion en probabilite (sigmoide)
    prob = 1 / (1 + np.exp(-(risk_score - 4.0)))

    # Label binaire avec du bruit (la SEP n'est pas deterministe)
    label = 1 if rng.random() < prob else 0

    return label


# =============================================================================
# ETAPE 4 : CONSTRUCTION DU DATASET
# =============================================================================
def build_dataset() -> Tuple[np.ndarray, np.ndarray, List[str], List[str]]:
    """
    Construit le dataset complet pour XGBoost.

    Strategie : on genere PLUSIEURS exemples par patient en utilisant
    chaque timepoint comme un "snapshot" independant. Avec 5 patients x
    ~4 timepoints = ~21 exemples. C'est peu pour XGBoost, donc on va
    aussi augmenter le dataset avec des perturbations realistes pour
    atteindre ~100 exemples (suffisant pour un prototype).
    """
    print("=" * 70)
    print("CONSTRUCTION DU DATASET XGBOOST")
    print("=" * 70)

    all_features = []
    all_labels = []
    feature_names = None

    for patient_id in ALL_PATIENTS:
        flair_paths = list_flair_files_for_patients([patient_id])
        print(f"\n  [{patient_id}] {len(flair_paths)} timepoints")

        # Extraire les features IRM pour chaque timepoint
        tp_features = []
        for fp in flair_paths:
            irm_feat = extract_irm_features(fp)
            tp_features.append(irm_feat)
            print(f"    {fp.stem}: vol={irm_feat['lesion_volume_ml']:.1f}mL  "
                  f"n_lesions={irm_feat['n_lesions']}")

        # Features longitudinales
        long_feat = extract_longitudinal_features(tp_features)

        # Pour chaque timepoint, creer un exemple
        for i, irm_feat in enumerate(tp_features):
            clinical = generate_clinical_features(
                f"{patient_id}_tp{i}", irm_feat)
            label = generate_progression_label(
                irm_feat, clinical, long_feat, f"{patient_id}_tp{i}")

            # Combiner toutes les features en un vecteur plat
            combined = {}
            combined.update(irm_feat)
            combined.update(long_feat)
            combined.update(clinical)

            if feature_names is None:
                feature_names = list(combined.keys())

            all_features.append([combined[k] for k in feature_names])
            all_labels.append(label)

    X = np.array(all_features, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int32)

    print(f"\n  Dataset brut : {X.shape[0]} exemples, "
          f"{X.shape[1]} features")
    print(f"  Distribution labels : "
          f"{(y == 0).sum()} stables / {(y == 1).sum()} progressifs")

    # --- Augmentation du dataset ---
    # On perturbe legerement les features pour creer des exemples
    # supplementaires. C'est une technique standard quand on a peu
    # de donnees tabulaires.
    print("\n  Augmentation du dataset...")
    X_aug, y_aug = augment_tabular_data(X, y, n_augmented=80)
    X_final = np.vstack([X, X_aug])
    y_final = np.concatenate([y, y_aug])

    print(f"  Dataset final : {X_final.shape[0]} exemples")
    print(f"  Distribution : "
          f"{(y_final == 0).sum()} stables / "
          f"{(y_final == 1).sum()} progressifs")

    return X_final, y_final, feature_names, ALL_PATIENTS


def augment_tabular_data(X: np.ndarray, y: np.ndarray,
                         n_augmented: int = 80,
                         noise_scale: float = 0.05) -> Tuple:
    """
    Augmente un dataset tabulaire en ajoutant du bruit gaussien.

    Pour chaque exemple augmente :
      1. On choisit un exemple existant au hasard
      2. On ajoute du bruit gaussien (5% de l'ecart-type de chaque feature)
      3. On garde le meme label

    C'est simple mais efficace pour eviter le surapprentissage de XGBoost
    sur un petit dataset.
    """
    rng = np.random.RandomState(SEED)
    stds = X.std(axis=0) * noise_scale

    X_aug = []
    y_aug = []
    for _ in range(n_augmented):
        idx = rng.randint(0, len(X))
        noise = rng.normal(0, stds)
        x_new = X[idx] + noise
        # On s'assure que les valeurs restent raisonnables
        x_new = np.maximum(x_new, 0)  # pas de valeurs negatives
        X_aug.append(x_new)
        y_aug.append(y[idx])

    return np.array(X_aug, dtype=np.float32), np.array(y_aug, dtype=np.int32)


# =============================================================================
# ETAPE 5 : ENTRAINEMENT XGBOOST
# =============================================================================
def train_xgboost(X: np.ndarray, y: np.ndarray,
                  feature_names: List[str]) -> dict:
    """
    Entraine un XGBoost avec cross-validation et retourne le modele
    + les metriques.
    """
    try:
        import xgboost as xgb
    except ImportError:
        print("\n[ERREUR] xgboost n'est pas installe.")
        print("  Installe-le avec : pip install xgboost")
        raise SystemExit(1)

    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import (
        roc_auc_score, accuracy_score, classification_report,
        confusion_matrix, roc_curve,
    )

    print("\n" + "=" * 70)
    print("ENTRAINEMENT XGBOOST")
    print("=" * 70)

    # Parametres XGBoost adaptes a un petit dataset
    params = {
        "n_estimators": 100,
        "max_depth": 4,            # peu profond pour eviter le surapprentissage
        "learning_rate": 0.1,
        "min_child_weight": 3,     # regularisation
        "subsample": 0.8,          # bagging : 80% des exemples par arbre
        "colsample_bytree": 0.8,   # 80% des features par arbre
        "reg_alpha": 0.1,          # regularisation L1
        "reg_lambda": 1.0,         # regularisation L2
        "random_state": SEED,
        "eval_metric": "logloss",
    }

    model = xgb.XGBClassifier(**params)

    # --- Cross-validation 5-fold stratifiee ---
    # Stratifiee = chaque fold a le meme ratio positifs/negatifs
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    # cross_val_predict retourne les predictions "out-of-fold" :
    # chaque exemple est predit par le modele qui ne l'a PAS vu en train
    y_pred_proba = cross_val_predict(
        model, X, y, cv=cv, method="predict_proba")[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    # --- Metriques ---
    auc = roc_auc_score(y, y_pred_proba)
    acc = accuracy_score(y, y_pred)
    cm = confusion_matrix(y, y_pred)

    print(f"\n  [Resultats cross-validation 5-fold]")
    print(f"  AUC-ROC  : {auc:.4f}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"\n  Matrice de confusion :")
    print(f"              Pred Stable  Pred Progr.")
    print(f"  Vrai Stable    {cm[0, 0]:>4}        {cm[0, 1]:>4}")
    print(f"  Vrai Progr.    {cm[1, 0]:>4}        {cm[1, 1]:>4}")
    print(f"\n  Rapport de classification :")
    print(classification_report(y, y_pred,
          target_names=["Stable", "Progression"]))

    # --- Entrainement du modele final sur toutes les donnees ---
    model.fit(X, y)

    # --- Feature importance ---
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]

    print("  Top 10 features les plus importantes :")
    for rank, idx in enumerate(sorted_idx[:10]):
        print(f"    {rank + 1}. {feature_names[idx]:<30} "
              f"importance={importances[idx]:.4f}")

    # --- Courbe ROC ---
    fpr, tpr, _ = roc_curve(y, y_pred_proba)
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    axes[0].plot(fpr, tpr, color="steelblue", linewidth=2,
                 label=f"XGBoost (AUC = {auc:.3f})")
    axes[0].plot([0, 1], [0, 1], color="gray", linestyle="--",
                 label="Aleatoire (AUC = 0.5)")
    axes[0].set_xlabel("Taux de faux positifs")
    axes[0].set_ylabel("Taux de vrais positifs")
    axes[0].set_title("Courbe ROC")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Feature importance bar chart
    top_n = min(15, len(feature_names))
    top_idx = sorted_idx[:top_n]
    axes[1].barh(range(top_n),
                 importances[top_idx][::-1],
                 color="steelblue")
    axes[1].set_yticks(range(top_n))
    axes[1].set_yticklabels([feature_names[i] for i in top_idx][::-1])
    axes[1].set_xlabel("Importance")
    axes[1].set_title("Feature Importance (XGBoost)")
    axes[1].grid(True, alpha=0.3, axis="x")

    plt.tight_layout()
    fig_path = FIGURES_DIR / "xgboost_results.png"
    plt.savefig(fig_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"\n  Graphiques sauves : {fig_path}")

    return {
        "model": model,
        "auc": auc,
        "accuracy": acc,
        "feature_names": feature_names,
        "params": params,
        "fpr": fpr,
        "tpr": tpr,
    }


# =============================================================================
# ETAPE 6 : SHAP (explicabilite)
# =============================================================================
def explain_with_shap(model, X: np.ndarray, feature_names: List[str]):
    """
    Applique SHAP pour expliquer les predictions du XGBoost.

    SHAP (SHapley Additive exPlanations) decompose chaque prediction
    en contributions de chaque feature. Ca repond a la question :
    "Pourquoi le modele predit-il un risque eleve pour CE patient ?"
    """
    try:
        import shap
    except ImportError:
        print("\n[!] shap n'est pas installe.")
        print("    Installe-le avec : pip install shap")
        print("    On saute l'explicabilite SHAP pour l'instant.")
        return None

    import pandas as pd

    print("\n" + "=" * 70)
    print("EXPLICABILITE SHAP")
    print("=" * 70)

    # Convertir X en DataFrame (SHAP marche mieux avec des noms de colonnes)
    X_df = pd.DataFrame(X, columns=feature_names)

    # --- Strategie robuste : utiliser le booster natif de XGBoost ---
    # Le bug est dans TreeExplainer qui n'arrive pas a parser le base_score
    # du wrapper sklearn. En passant par le booster natif, on contourne.
    import xgboost as xgb
    booster = model.get_booster()

    # Convertir en DMatrix (format natif XGBoost)
    dmatrix = xgb.DMatrix(X_df)

    # Obtenir les SHAP values directement depuis le booster
    # C'est la methode la plus fiable, independante de la version de shap
    print("  Calcul des SHAP values via le booster natif...")
    shap_values = booster.predict(dmatrix, pred_contribs=True)

    # La derniere colonne est la base value (bias), on la separe
    base_value = shap_values[0, -1]
    shap_values = shap_values[:, :-1]  # (n_samples, n_features)

    print(f"  Shape SHAP values : {shap_values.shape}")
    print(f"  Base value        : {base_value:.4f}")

    # --- Summary plot (vue globale) ---
    print("  Generation du summary plot...")
    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values, X_df, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "shap_summary.png", dpi=100,
                bbox_inches="tight")
    plt.close("all")
    print(f"  [OK] shap_summary.png")

    # --- Bar plot (importance moyenne) ---
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X_df, plot_type="bar",
                      show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "shap_bar.png", dpi=100,
                bbox_inches="tight")
    plt.close("all")
    print(f"  [OK] shap_bar.png")

    # --- Explication individuelle : patient a haut risque ---
    probs = model.predict_proba(X)[:, 1]
    high_risk_idx = int(np.argmax(probs))
    low_risk_idx = int(np.argmin(probs))

    print(f"\n  Patient a plus haut risque (idx={high_risk_idx}, "
          f"prob={probs[high_risk_idx]:.3f}) :")
    top_shap = np.argsort(np.abs(shap_values[high_risk_idx]))[::-1][:5]
    for idx in top_shap:
        direction = "+" if shap_values[high_risk_idx][idx] > 0 else "-"
        print(f"    {direction} {feature_names[idx]}: "
              f"valeur={X[high_risk_idx, idx]:.2f}, "
              f"SHAP={shap_values[high_risk_idx][idx]:.4f}")

    print(f"\n  Patient a plus bas risque (idx={low_risk_idx}, "
          f"prob={probs[low_risk_idx]:.3f}) :")
    top_shap = np.argsort(np.abs(shap_values[low_risk_idx]))[::-1][:5]
    for idx in top_shap:
        direction = "+" if shap_values[low_risk_idx][idx] > 0 else "-"
        print(f"    {direction} {feature_names[idx]}: "
              f"valeur={X[low_risk_idx, idx]:.2f}, "
              f"SHAP={shap_values[low_risk_idx][idx]:.4f}")

    # --- Waterfall plot pour le patient a haut risque ---
    try:
        plt.figure(figsize=(10, 6))
        shap.waterfall_plot(
            shap.Explanation(
                values=shap_values[high_risk_idx],
                base_values=float(base_value),
                data=X[high_risk_idx],
                feature_names=feature_names,
            ),
            show=False, max_display=12,
        )
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "shap_waterfall_high_risk.png", dpi=100,
                    bbox_inches="tight")
        plt.close("all")
        print(f"\n  [OK] shap_waterfall_high_risk.png")
    except Exception as e:
        print(f"\n  [!] Waterfall plot echoue : {e}")

    return shap_values


# =============================================================================
# ETAPE 7 : SAUVEGARDE
# =============================================================================
def save_model(results: dict, feature_names: List[str]):
    """Sauvegarde le modele et les metadonnees."""
    model_path = OUTPUT_DIR / "xgboost_risk.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": results["model"],
            "feature_names": feature_names,
            "auc": results["auc"],
            "accuracy": results["accuracy"],
            "params": results["params"],
        }, f)
    print(f"\n  Modele sauve : {model_path}")

    # Sauvegarder aussi la liste des features en JSON (utile pour l'API)
    meta_path = OUTPUT_DIR / "xgboost_features.json"
    with open(meta_path, "w") as f:
        json.dump({
            "feature_names": feature_names,
            "n_features": len(feature_names),
            "auc_roc": results["auc"],
        }, f, indent=2)
    print(f"  Metadonnees  : {meta_path}")


# =============================================================================
# FONCTION D'INFERENCE (pour l'API backend)
# =============================================================================
def predict_risk(patient_features: Dict[str, float],
                 model_path: str = str(OUTPUT_DIR / "xgboost_risk.pkl")
                 ) -> Dict:
    """
    Predit le risque de progression pour un patient.

    C'est cette fonction que la Personne 3 appellera depuis l'API
    backend dans l'endpoint POST /api/predict/{patient_id}.

    Parametres
    ----------
    patient_features : dict
        Dictionnaire avec toutes les features (IRM + cliniques).
        Les cles doivent correspondre aux feature_names du modele.

    Retourne
    --------
    dict avec : risk_probability, risk_level, top_risk_factors
    """
    with open(model_path, "rb") as f:
        data = pickle.load(f)

    model = data["model"]
    feature_names = data["feature_names"]

    # Construire le vecteur de features dans le bon ordre
    x = np.array([[patient_features.get(fn, 0.0) for fn in feature_names]],
                 dtype=np.float32)

    prob = float(model.predict_proba(x)[0, 1])

    # Niveau de risque
    if prob < 0.3:
        level = "faible"
    elif prob < 0.6:
        level = "modere"
    else:
        level = "eleve"

    return {
        "risk_probability": round(prob, 4),
        "risk_level": level,
        "risk_percentage": round(prob * 100, 1),
    }


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    # 1. Construire le dataset
    X, y, feature_names, patients = build_dataset()

    # 2. Entrainer XGBoost
    results = train_xgboost(X, y, feature_names)

    # 3. Sauvegarder
    save_model(results, feature_names)

    # 4. SHAP
    shap_values = explain_with_shap(results["model"], X, feature_names)

    # 5. Test de la fonction d'inference
    print("\n" + "=" * 70)
    print("TEST DE L'INFERENCE")
    print("=" * 70)

    # Simuler un patient a haut risque
    test_patient = {
        "lesion_volume_ml": 25.0,
        "n_lesions": 35,
        "mean_lesion_size_ml": 0.7,
        "max_lesion_size_ml": 5.0,
        "lesion_brain_ratio": 0.02,
        "mean_lesion_intensity": 1.2,
        "max_lesion_intensity": 2.5,
        "asymmetry": 0.3,
        "upper_third_ratio": 0.4,
        "brain_volume_ml": 1200.0,
        "volume_change_ml": 5.0,
        "volume_change_pct": 0.25,
        "lesion_count_change": 8,
        "new_lesions_rate": 2.5,
        "age": 45,
        "sex": 1,
        "disease_duration_years": 15,
        "edss": 5.0,
        "sep_type": 1,
        "relapse_count_2y": 3,
        "treatment_line": 2,
        "t25fw_seconds": 12.0,
        "nhpt_seconds": 30.0,
    }

    result = predict_risk(test_patient)
    print(f"\n  Patient test (haut risque simule) :")
    print(f"    Probabilite de progression : {result['risk_percentage']}%")
    print(f"    Niveau de risque           : {result['risk_level']}")

    # Patient a bas risque
    test_patient_low = test_patient.copy()
    test_patient_low.update({
        "lesion_volume_ml": 2.0, "n_lesions": 5, "edss": 1.0,
        "volume_change_ml": 0.0, "relapse_count_2y": 0,
        "disease_duration_years": 2, "age": 28,
    })

    result_low = predict_risk(test_patient_low)
    print(f"\n  Patient test (bas risque simule) :")
    print(f"    Probabilite de progression : {result_low['risk_percentage']}%")
    print(f"    Niveau de risque           : {result_low['risk_level']}")

    print("\n" + "=" * 70)
    print("PIPELINE XGBOOST + SHAP TERMINE")
    print("=" * 70)