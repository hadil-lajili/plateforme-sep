"""
LSTM - Prediction du risque de progression SEP a partir de sequences temporelles
==================================================================================

Difference avec XGBoost :
  - XGBoost voit un SNAPSHOT (1 timepoint = 1 vecteur de features)
  - LSTM voit une SEQUENCE (N timepoints = N vecteurs ordonnes dans le temps)
  - Le LSTM apprend a reconnaitre des patterns d'EVOLUTION qui predisent
    la progression (ex: volume lesionnel qui augmente a chaque visite)

Pipeline :
  1. Construction de sequences temporelles par patient
  2. Augmentation de donnees (perturbations, sous-sequences)
  3. Architecture LSTM simple
  4. Entrainement avec cross-validation
  5. Comparaison XGBoost vs LSTM
  6. Ensemble (moyenne des deux modeles)

Usage :
    python train_lstm.py
"""

from pathlib import Path
from typing import List, Tuple, Dict
import pickle
import json

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, TensorDataset
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report
import matplotlib.pyplot as plt

from dataset_isbi import list_flair_files_for_patients, DATA_ROOT
from train_xgboost import (
    extract_irm_features, generate_clinical_features,
    generate_progression_label, extract_longitudinal_features,
    ALL_PATIENTS,
)

# =============================================================================
# CONFIGURATION
# =============================================================================
MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)

FIGURES_DIR = Path("./figures")
FIGURES_DIR.mkdir(exist_ok=True)

SEED = 42
np.random.seed(SEED)
torch.manual_seed(SEED)

# LSTM hyperparametres
HIDDEN_SIZE = 32        # Petit : on a tres peu de donnees
NUM_LAYERS = 1          # Une seule couche LSTM suffit
DROPOUT = 0.3
LEARNING_RATE = 1e-3
EPOCHS = 100
BATCH_SIZE = 8


# =============================================================================
# ETAPE 1 : CONSTRUCTION DES SEQUENCES TEMPORELLES
# =============================================================================
def build_patient_sequences() -> Tuple[List[np.ndarray], List[int],
                                        List[str], List[str]]:
    """
    Construit une sequence temporelle par patient.

    Chaque sequence = [features_tp01, features_tp02, ..., features_tpN]
    Le label = progression (0/1) du patient.

    Retourne :
      sequences : list de np.ndarray, chacun de shape (n_timepoints, n_features)
      labels    : list de int (0 ou 1)
      feature_names : noms des features
      patient_ids : identifiants
    """
    print("=" * 70)
    print("CONSTRUCTION DES SEQUENCES TEMPORELLES")
    print("=" * 70)

    sequences = []
    labels = []
    patient_ids = []
    feature_names = None

    for patient_id in ALL_PATIENTS:
        flair_paths = list_flair_files_for_patients([patient_id])
        print(f"\n  [{patient_id}] {len(flair_paths)} timepoints")

        # Extraire les features pour chaque timepoint
        tp_features_list = []
        tp_vectors = []

        for i, fp in enumerate(flair_paths):
            irm_feat = extract_irm_features(fp)
            clinical = generate_clinical_features(
                f"{patient_id}_tp{i}", irm_feat)

            # Pour le LSTM on n'inclut PAS les features longitudinales
            # (elles sont calculees sur toute la sequence, ce serait du leak)
            # Le LSTM apprendra lui-meme les patterns temporels
            combined = {}
            combined.update(irm_feat)
            combined.update(clinical)

            if feature_names is None:
                feature_names = list(combined.keys())

            vector = [combined[k] for k in feature_names]
            tp_vectors.append(vector)
            tp_features_list.append(irm_feat)

            print(f"    tp{i + 1}: vol={irm_feat['lesion_volume_ml']:.1f}mL  "
                  f"n_les={irm_feat['n_lesions']}")

        # Construire la sequence : (n_timepoints, n_features)
        sequence = np.array(tp_vectors, dtype=np.float32)
        sequences.append(sequence)

        # Label : on utilise les features longitudinales pour generer
        # un label coherent avec la trajectoire du patient
        long_feat = extract_longitudinal_features(tp_features_list)
        # On utilise le dernier timepoint pour les features cliniques
        last_clinical = generate_clinical_features(
            f"{patient_id}_tp{len(flair_paths) - 1}", tp_features_list[-1])
        label = generate_progression_label(
            tp_features_list[-1], last_clinical, long_feat,
            f"{patient_id}_seq")
        labels.append(label)
        patient_ids.append(patient_id)

        print(f"    -> label: {'Progression' if label else 'Stable'}")

    print(f"\n  Patients : {len(sequences)}")
    print(f"  Features par timepoint : {len(feature_names)}")
    print(f"  Longueurs des sequences : "
          f"{[s.shape[0] for s in sequences]}")
    print(f"  Labels : {labels}")

    return sequences, labels, feature_names, patient_ids


# =============================================================================
# ETAPE 2 : AUGMENTATION ET PADDING
# =============================================================================
def normalize_sequences(sequences: List[np.ndarray]
                        ) -> Tuple[List[np.ndarray], np.ndarray, np.ndarray]:
    """Normalise les features en z-score (par feature, sur tout le dataset)."""
    # Concatener tous les timepoints pour calculer mean/std globaux
    all_vectors = np.vstack(sequences)
    mean = all_vectors.mean(axis=0)
    std = all_vectors.std(axis=0) + 1e-8

    normalized = []
    for seq in sequences:
        normalized.append((seq - mean) / std)

    return normalized, mean, std


def augment_sequences(sequences: List[np.ndarray], labels: List[int],
                      n_augmented: int = 50, noise_scale: float = 0.05
                      ) -> Tuple[List[np.ndarray], List[int]]:
    """
    Augmente le dataset de sequences.

    Strategies :
      1. Ajout de bruit gaussien (simule la variabilite de mesure)
      2. Sous-sequences (simule des patients avec moins de visites)
      3. Reversal temporel (pour les sequences stables uniquement)
    """
    rng = np.random.RandomState(SEED)
    aug_seqs = []
    aug_labels = []

    for _ in range(n_augmented):
        idx = rng.randint(0, len(sequences))
        seq = sequences[idx].copy()
        label = labels[idx]

        # Strategie 1 : bruit gaussien (toujours)
        noise = rng.normal(0, noise_scale, size=seq.shape)
        seq_noisy = seq + noise

        aug_seqs.append(seq_noisy.astype(np.float32))
        aug_labels.append(label)

        # Strategie 2 : sous-sequence (si la sequence a >= 3 timepoints)
        if len(seq) >= 3 and rng.random() < 0.5:
            # Prendre les N-1 derniers timepoints
            start = rng.randint(0, len(seq) - 2)
            sub_seq = seq[start:] + rng.normal(0, noise_scale, size=seq[start:].shape)
            aug_seqs.append(sub_seq.astype(np.float32))
            aug_labels.append(label)

    return aug_seqs, aug_labels


def pad_sequences(sequences: List[np.ndarray], max_len: int = None
                  ) -> Tuple[np.ndarray, np.ndarray]:
    """
    Pad toutes les sequences a la meme longueur (necessaire pour le batching).

    Retourne aussi un masque de longueur pour que le LSTM ignore le padding.
    """
    if max_len is None:
        max_len = max(len(s) for s in sequences)

    n_features = sequences[0].shape[1]
    padded = np.zeros((len(sequences), max_len, n_features), dtype=np.float32)
    lengths = np.zeros(len(sequences), dtype=np.int64)

    for i, seq in enumerate(sequences):
        actual_len = min(len(seq), max_len)
        padded[i, :actual_len, :] = seq[:actual_len]
        lengths[i] = actual_len

    return padded, lengths


# =============================================================================
# ETAPE 3 : ARCHITECTURE LSTM
# =============================================================================
class LSTMRiskPredictor(nn.Module):
    """
    LSTM pour la prediction de risque a partir de sequences temporelles.

    Architecture :
      Input (batch, seq_len, n_features)
        |
      LSTM (hidden_size=32, 1 couche)
        |
      On prend le DERNIER hidden state (= resume de toute la sequence)
        |
      Linear(32 -> 16) + ReLU + Dropout
        |
      Linear(16 -> 1)   -> logit
        |
      Sigmoid (dans la loss) -> probabilite

    Pourquoi le dernier hidden state ?
      Parce qu'on veut une seule prediction par sequence (pas une prediction
      par timepoint). Le dernier hidden state encode l'information de TOUS
      les timepoints precedents grace a la memoire du LSTM.
    """
    def __init__(self, input_size: int, hidden_size: int = HIDDEN_SIZE,
                 num_layers: int = NUM_LAYERS, dropout: float = DROPOUT):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, x: torch.Tensor, lengths: torch.Tensor = None
                ) -> torch.Tensor:
        """
        x       : (batch, seq_len, n_features)
        lengths : (batch,) longueurs reelles (avant padding)
        """
        # Si on a les longueurs, on pack la sequence pour efficacite
        if lengths is not None and lengths.min() > 0:
            # Trier par longueur decroissante (requis par pack_padded_sequence)
            sorted_lengths, sort_idx = lengths.sort(descending=True)
            x_sorted = x[sort_idx]

            packed = nn.utils.rnn.pack_padded_sequence(
                x_sorted, sorted_lengths.cpu(), batch_first=True,
                enforce_sorted=True)
            _, (h_n, _) = self.lstm(packed)

            # Remettre dans l'ordre original
            _, unsort_idx = sort_idx.sort()
            h_last = h_n[-1][unsort_idx]  # (batch, hidden_size)
        else:
            _, (h_n, _) = self.lstm(x)
            h_last = h_n[-1]

        return self.classifier(h_last).squeeze(-1)  # (batch,)


# =============================================================================
# ETAPE 4 : ENTRAINEMENT
# =============================================================================
def train_lstm_model(X_padded: np.ndarray, lengths: np.ndarray,
                     y: np.ndarray, n_features: int) -> dict:
    """Entraine le LSTM avec cross-validation."""
    print("\n" + "=" * 70)
    print("ENTRAINEMENT LSTM")
    print("=" * 70)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Device : {device}")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    all_probs = np.zeros(len(y))
    all_preds = np.zeros(len(y), dtype=int)
    fold_aucs = []

    for fold, (train_idx, val_idx) in enumerate(cv.split(X_padded, y)):
        # Preparer les donnees
        X_train = torch.FloatTensor(X_padded[train_idx]).to(device)
        X_val = torch.FloatTensor(X_padded[val_idx]).to(device)
        y_train = torch.FloatTensor(y[train_idx]).to(device)
        y_val = torch.FloatTensor(y[val_idx]).to(device)
        len_train = torch.LongTensor(lengths[train_idx]).to(device)
        len_val = torch.LongTensor(lengths[val_idx]).to(device)

        # Modele
        model = LSTMRiskPredictor(input_size=n_features).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE,
                                     weight_decay=1e-4)
        criterion = nn.BCEWithLogitsLoss()

        # Mini-batches
        train_ds = TensorDataset(X_train, len_train, y_train)
        train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE,
                                  shuffle=True, drop_last=False)

        # Entrainement
        best_val_auc = 0
        patience_counter = 0
        for epoch in range(EPOCHS):
            model.train()
            for batch_x, batch_len, batch_y in train_loader:
                logits = model(batch_x, batch_len)
                loss = criterion(logits, batch_y)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            # Evaluation
            model.eval()
            with torch.no_grad():
                val_logits = model(X_val, len_val)
                val_probs = torch.sigmoid(val_logits).cpu().numpy()
                val_auc = roc_auc_score(y[val_idx], val_probs) \
                    if len(np.unique(y[val_idx])) > 1 else 0.5

            if val_auc > best_val_auc:
                best_val_auc = val_auc
                best_state = {k: v.cpu().clone()
                              for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= 15:
                    break

        # Predictions finales du meilleur modele
        model.load_state_dict(best_state)
        model.eval()
        with torch.no_grad():
            val_logits = model(X_val, len_val)
            val_probs = torch.sigmoid(val_logits).cpu().numpy()

        all_probs[val_idx] = val_probs
        all_preds[val_idx] = (val_probs >= 0.5).astype(int)
        fold_aucs.append(best_val_auc)
        print(f"  Fold {fold + 1}/5 : AUC = {best_val_auc:.4f}  "
              f"(early stop epoch {epoch + 1 - patience_counter})")

    # Metriques globales
    overall_auc = roc_auc_score(y, all_probs) \
        if len(np.unique(y)) > 1 else 0.5
    overall_acc = accuracy_score(y, all_preds)

    print(f"\n  [Resultats cross-validation 5-fold LSTM]")
    print(f"  AUC-ROC moyen par fold : {np.mean(fold_aucs):.4f} "
          f"(+/- {np.std(fold_aucs):.4f})")
    print(f"  AUC-ROC global         : {overall_auc:.4f}")
    print(f"  Accuracy               : {overall_acc:.4f}")
    print(f"\n  Rapport de classification :")
    print(classification_report(y, all_preds,
          target_names=["Stable", "Progression"]))

    # Entrainer le modele final sur toutes les donnees
    X_all = torch.FloatTensor(X_padded).to(device)
    y_all = torch.FloatTensor(y).to(device)
    len_all = torch.LongTensor(lengths).to(device)

    final_model = LSTMRiskPredictor(input_size=n_features).to(device)
    optimizer = torch.optim.Adam(final_model.parameters(), lr=LEARNING_RATE,
                                 weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()
    train_ds = TensorDataset(X_all, len_all, y_all)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)

    final_model.train()
    for epoch in range(EPOCHS):
        for batch_x, batch_len, batch_y in train_loader:
            logits = final_model(batch_x, batch_len)
            loss = criterion(logits, batch_y)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

    return {
        "model": final_model,
        "probs": all_probs,
        "preds": all_preds,
        "auc": overall_auc,
        "accuracy": overall_acc,
        "fold_aucs": fold_aucs,
    }


# =============================================================================
# ETAPE 5 : COMPARAISON XGBOOST vs LSTM vs ENSEMBLE
# =============================================================================
def compare_models(lstm_probs: np.ndarray, y: np.ndarray):
    """Compare LSTM, XGBoost et l'ensemble des deux."""
    print("\n" + "=" * 70)
    print("COMPARAISON DES MODELES")
    print("=" * 70)

    # Charger les predictions XGBoost
    xgb_model_path = MODELS_DIR / "xgboost_risk.pkl"
    if not xgb_model_path.exists():
        print("  [!] Modele XGBoost non trouve, comparaison impossible")
        return None

    with open(xgb_model_path, "rb") as f:
        xgb_data = pickle.load(f)

    # Pour la comparaison, on a besoin des probs XGBoost sur les memes
    # donnees. Comme on a des datasets differents (XGBoost = snapshots,
    # LSTM = sequences), on compare sur les metriques globales.
    # On va aussi creer un ensemble simple.

    results = {
        "LSTM": {
            "auc": roc_auc_score(y, lstm_probs) if len(np.unique(y)) > 1 else 0.5,
            "accuracy": accuracy_score(y, (lstm_probs >= 0.5).astype(int)),
        },
        "XGBoost": {
            "auc": xgb_data.get("auc", "N/A"),
            "accuracy": xgb_data.get("accuracy", "N/A"),
        },
    }

    # Ensemble : moyenne des probabilites LSTM et d'une prediction XGBoost
    # sur le dernier timepoint de chaque sequence
    # (On utilise les probs LSTM directement et les probs XGBoost du modele
    # sauvegarde)

    print(f"\n  {'Modele':<15} {'AUC-ROC':>10} {'Accuracy':>10}")
    print(f"  {'-' * 37}")
    for name, metrics in results.items():
        auc = metrics['auc']
        acc = metrics['accuracy']
        auc_str = f"{auc:.4f}" if isinstance(auc, float) else str(auc)
        acc_str = f"{acc:.4f}" if isinstance(acc, float) else str(acc)
        print(f"  {name:<15} {auc_str:>10} {acc_str:>10}")

    # Note sur l'ensemble
    print(f"\n  Note sur l'ensemble :")
    print(f"  Dans un deploiement reel, l'ensemble combinerait les")
    print(f"  probabilites des deux modeles : p_final = 0.5*p_xgb + 0.5*p_lstm")
    print(f"  Cela est generalement plus robuste que chaque modele seul.")

    return results


# =============================================================================
# ETAPE 6 : VISUALISATIONS
# =============================================================================
def plot_results(lstm_results: dict, y: np.ndarray):
    """Genere les graphiques de resultats du LSTM."""
    from sklearn.metrics import roc_curve

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # --- Courbe ROC du LSTM ---
    fpr, tpr, _ = roc_curve(y, lstm_results["probs"])
    axes[0].plot(fpr, tpr, color="coral", linewidth=2,
                 label=f"LSTM (AUC = {lstm_results['auc']:.3f})")
    axes[0].plot([0, 1], [0, 1], color="gray", linestyle="--",
                 label="Aleatoire (AUC = 0.5)")
    axes[0].set_xlabel("Taux de faux positifs")
    axes[0].set_ylabel("Taux de vrais positifs")
    axes[0].set_title("Courbe ROC - LSTM")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # --- AUC par fold ---
    folds = range(1, len(lstm_results["fold_aucs"]) + 1)
    axes[1].bar(folds, lstm_results["fold_aucs"], color="coral", alpha=0.7)
    axes[1].axhline(np.mean(lstm_results["fold_aucs"]), color="red",
                    linestyle="--", label=f"Moyenne = "
                    f"{np.mean(lstm_results['fold_aucs']):.3f}")
    axes[1].set_xlabel("Fold")
    axes[1].set_ylabel("AUC-ROC")
    axes[1].set_title("AUC par fold (cross-validation)")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3, axis="y")
    axes[1].set_ylim(0, 1)

    plt.tight_layout()
    fig_path = FIGURES_DIR / "lstm_results.png"
    plt.savefig(fig_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"\n  Graphiques sauves : {fig_path}")

    # --- Comparaison visuelle LSTM vs XGBoost ---
    xgb_path = MODELS_DIR / "xgboost_risk.pkl"
    if xgb_path.exists():
        with open(xgb_path, "rb") as f:
            xgb_data = pickle.load(f)
        xgb_auc = xgb_data.get("auc", 0)

        fig, ax = plt.subplots(figsize=(6, 4))
        models = ["XGBoost", "LSTM"]
        aucs = [xgb_auc, lstm_results["auc"]]
        colors = ["steelblue", "coral"]
        bars = ax.bar(models, aucs, color=colors, width=0.5)

        for bar, auc in zip(bars, aucs):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                    f"{auc:.3f}", ha="center", fontweight="bold")

        ax.set_ylabel("AUC-ROC")
        ax.set_title("Comparaison XGBoost vs LSTM")
        ax.set_ylim(0, 1.1)
        ax.grid(True, alpha=0.3, axis="y")

        plt.tight_layout()
        cmp_path = FIGURES_DIR / "model_comparison.png"
        plt.savefig(cmp_path, dpi=100, bbox_inches="tight")
        plt.close()
        print(f"  Comparaison sauvee : {cmp_path}")


# =============================================================================
# ETAPE 7 : SAUVEGARDE
# =============================================================================
def save_lstm_model(model: nn.Module, feature_names: List[str],
                    mean: np.ndarray, std: np.ndarray,
                    results: dict, max_seq_len: int):
    """Sauvegarde le modele LSTM et ses metadonnees."""
    model_path = MODELS_DIR / "lstm_risk.pth"
    torch.save({
        "model_state_dict": model.cpu().state_dict(),
        "input_size": len(feature_names),
        "hidden_size": HIDDEN_SIZE,
        "num_layers": NUM_LAYERS,
        "feature_names": feature_names,
        "normalization_mean": mean.tolist(),
        "normalization_std": std.tolist(),
        "max_seq_len": max_seq_len,
        "auc": results["auc"],
        "accuracy": results["accuracy"],
    }, model_path)
    print(f"\n  Modele LSTM sauve   : {model_path}")

    # Metadonnees JSON
    meta = {
        "model_type": "LSTM",
        "input_size": len(feature_names),
        "hidden_size": HIDDEN_SIZE,
        "num_layers": NUM_LAYERS,
        "feature_names": feature_names,
        "max_seq_len": max_seq_len,
        "auc_roc": results["auc"],
        "accuracy": results["accuracy"],
    }
    meta_path = MODELS_DIR / "lstm_features.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Metadonnees sauvees : {meta_path}")


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    # 1. Construire les sequences
    sequences, labels, feature_names, patient_ids = build_patient_sequences()

    # 2. Normaliser
    sequences_norm, mean, std = normalize_sequences(sequences)

    # 3. Augmenter
    print(f"\n  Augmentation des sequences...")
    aug_seqs, aug_labels = augment_sequences(sequences_norm, labels,
                                             n_augmented=60)
    all_seqs = sequences_norm + aug_seqs
    all_labels = labels + aug_labels
    print(f"  Sequences totales : {len(all_seqs)}")
    print(f"  Distribution : {sum(1 for l in all_labels if l == 0)} stables / "
          f"{sum(1 for l in all_labels if l == 1)} progressifs")

    # 4. Padding
    X_padded, lengths = pad_sequences(all_seqs)
    y = np.array(all_labels, dtype=np.float32)
    print(f"  Shape apres padding : {X_padded.shape}")

    # 5. Entrainer
    lstm_results = train_lstm_model(X_padded, lengths, y,
                                    n_features=len(feature_names))

    # 6. Comparer
    comparison = compare_models(lstm_results["probs"], y)

    # 7. Visualiser
    plot_results(lstm_results, y)

    # 8. Sauvegarder
    max_seq_len = X_padded.shape[1]
    save_lstm_model(lstm_results["model"], feature_names, mean, std,
                    lstm_results, max_seq_len)

    print("\n" + "=" * 70)
    print("PIPELINE LSTM TERMINE")
    print("=" * 70)
    print(f"\n  Resume des modeles disponibles :")
    print(f"    U-Net 3D  : checkpoints/best_model.pth  (Dice 0.67)")
    print(f"    XGBoost   : models/xgboost_risk.pkl     (AUC ~0.92)")
    print(f"    LSTM      : models/lstm_risk.pth         "
          f"(AUC {lstm_results['auc']:.3f})")
    print(f"\n  Tous les modeles de la Personne 2 sont termines !")
    print("=" * 70)
