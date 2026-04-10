import torch
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import os

from ai.models.classifier import SEPClassifier
from ai.data.dataset_classification import SEPClassificationDataset
from torch.utils.data import DataLoader


def plot_training_classifier(save_path="ai/plots"):
    """Réentraîne et sauvegarde les courbes loss/accuracy"""
    os.makedirs(save_path, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    dataset = SEPClassificationDataset(
        'data/msseg', 'data/mslsc', 'data/oasis',
        target_size=(128, 128), max_sains=385, augment=True
    )

    total = len(dataset)
    train_size = int(total * 0.7)
    val_size = int(total * 0.15)
    test_size = total - train_size - val_size

    train_set, val_set, test_set = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )

    train_loader = DataLoader(train_set, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False)

    model = SEPClassifier().to(device)

    # Charger le meilleur modèle
    checkpoint = torch.load("ai/checkpoints/classifier_sep.pth",
                           map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])

    print(f"✅ Modèle chargé — Val Acc sauvegardée : {checkpoint['val_acc']:.4f}")
    print(f"   Sensibilité : {checkpoint['sensibilite']:.4f}")
    print(f"   Spécificité : {checkpoint['specificite']:.4f}")

    # Évaluation sur test set
    model.eval()
    test_preds, test_labels = [], []
    with torch.no_grad():
        for imgs, labels in DataLoader(test_set, batch_size=16):
            imgs = imgs.to(device)
            preds = model(imgs)
            test_preds.extend(preds.cpu().numpy())
            test_labels.extend(labels.numpy())

    test_preds = np.array(test_preds)
    test_labels = np.array(test_labels)
    test_preds_bin = (test_preds > 0.5).astype(int)

    tp = ((test_preds_bin == 1) & (test_labels == 1)).sum()
    tn = ((test_preds_bin == 0) & (test_labels == 0)).sum()
    fp = ((test_preds_bin == 1) & (test_labels == 0)).sum()
    fn = ((test_preds_bin == 0) & (test_labels == 1)).sum()

    acc = (tp + tn) / len(test_labels)
    sens = tp / (tp + fn + 1e-6)
    spec = tn / (tn + fp + 1e-6)

    print(f"\n📊 Résultats sur Test Set ({len(test_set)} images) :")
    print(f"   Accuracy    : {acc:.4f} ({acc*100:.1f}%)")
    print(f"   Sensibilité : {sens:.4f} ({sens*100:.1f}%)")
    print(f"   Spécificité : {spec:.4f} ({spec*100:.1f}%)")

    # ── Figure 1 : Matrice de confusion ──
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle('SEP Classifier — Résultats', fontsize=16, fontweight='bold')

    # Matrice de confusion
    ax = axes[0]
    cm = np.array([[tn, fp], [fn, tp]])
    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.set_title('Matrice de Confusion', fontsize=13, fontweight='bold')
    ax.set_xlabel('Prédit', fontsize=11)
    ax.set_ylabel('Réel', fontsize=11)
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['Sain', 'SEP'], fontsize=11)
    ax.set_yticklabels(['Sain', 'SEP'], fontsize=11)
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha='center', va='center',
                   fontsize=20, fontweight='bold',
                   color='white' if cm[i, j] > cm.max()/2 else 'black')

    # Distribution des scores
    ax2 = axes[1]
    sain_scores = test_preds[test_labels == 0]
    sep_scores = test_preds[test_labels == 1]
    ax2.hist(sain_scores, bins=20, alpha=0.7, color='#22c55e', label='Sain')
    ax2.hist(sep_scores, bins=20, alpha=0.7, color='#ef4444', label='SEP')
    ax2.axvline(x=0.5, color='black', linestyle='--', linewidth=2, label='Seuil (0.5)')
    ax2.set_title('Distribution des Scores', fontsize=13, fontweight='bold')
    ax2.set_xlabel('Score SEP prédit', fontsize=11)
    ax2.set_ylabel('Nombre d\'images', fontsize=11)
    ax2.legend(fontsize=10)
    ax2.grid(True, alpha=0.3)

    # Métriques bar chart
    ax3 = axes[2]
    metriques = ['Accuracy', 'Sensibilité', 'Spécificité']
    valeurs = [acc, sens, spec]
    couleurs = ['#3b82f6', '#f59e0b', '#8b5cf6']
    bars = ax3.bar(metriques, valeurs, color=couleurs, edgecolor='white', linewidth=2)
    ax3.set_ylim(0, 1.1)
    ax3.set_title('Métriques de Performance', fontsize=13, fontweight='bold')
    ax3.set_ylabel('Score', fontsize=11)
    ax3.grid(True, alpha=0.3, axis='y')
    for bar, val in zip(bars, valeurs):
        ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f'{val*100:.1f}%', ha='center', fontweight='bold', fontsize=12)

    plt.tight_layout()
    plt.savefig(f"{save_path}/classifier_resultats.png", dpi=150, bbox_inches='tight')
    print(f"\n✅ Graphique sauvegardé : {save_path}/classifier_resultats.png")
    plt.show()


if __name__ == "__main__":
    plot_training_classifier()