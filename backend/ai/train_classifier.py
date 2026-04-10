import torch
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.classifier import SEPClassifier
from ai.data.dataset_classification import SEPClassificationDataset


def accuracy(preds, targets, threshold=0.5):
    preds_bin = (preds > threshold).float()
    return (preds_bin == targets).float().mean().item()


def plot_courbes(history, save_dir="ai/plots"):
    os.makedirs(save_dir, exist_ok=True)
    epochs_range = range(1, len(history['train_loss']) + 1)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('SEP Classifier — Courbes d\'entraînement', fontsize=14, fontweight='bold')

    # ── Courbe Loss ──
    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, linewidth=2, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, linewidth=2, label='Val Loss')
    axes[0].set_title('Loss par Epoch', fontsize=12, fontweight='bold')
    axes[0].set_xlabel('Epoch', fontsize=11)
    axes[0].set_ylabel('Loss (BCE)', fontsize=11)
    axes[0].legend(fontsize=10)
    axes[0].grid(True, alpha=0.3)

    # Zone overfitting
    train_arr = np.array(history['train_loss'])
    val_arr = np.array(history['val_loss'])
    overfit_start = None
    for i in range(5, len(train_arr)):
        if val_arr[i] > val_arr[i-1] and train_arr[i] < train_arr[i-1]:
            overfit_start = i
            break
    if overfit_start:
        axes[0].axvline(x=overfit_start+1, color='orange', linestyle='--',
                       linewidth=2, label=f'Overfitting ~epoch {overfit_start+1}')
        axes[0].legend(fontsize=10)

    # ── Courbe Accuracy / Sensibilité / Spécificité ──
    axes[1].plot(epochs_range, history['val_acc'], 'b-o', markersize=3, linewidth=2, label='Accuracy')
    axes[1].plot(epochs_range, history['val_sens'], color='orange', marker='o',
                markersize=3, linewidth=2, label='Sensibilité')
    axes[1].plot(epochs_range, history['val_spec'], 'g-o', markersize=3, linewidth=2, label='Spécificité')
    axes[1].plot(epochs_range, history['train_acc'], 'b--', markersize=2,
                linewidth=1, alpha=0.5, label='Train Acc')
    axes[1].axhline(y=0.9, color='gray', linestyle='--', alpha=0.5, label='Seuil 90%')

    # Marquer le meilleur point
    best_epoch = np.argmax(history['val_acc'])
    best_val = history['val_acc'][best_epoch]
    axes[1].scatter([best_epoch + 1], [best_val], color='red', s=100, zorder=5,
                   label=f'Meilleur (epoch {best_epoch+1}, {best_val:.3f})')

    axes[1].set_title('Métriques par Epoch', fontsize=12, fontweight='bold')
    axes[1].set_xlabel('Epoch', fontsize=11)
    axes[1].set_ylabel('Score', fontsize=11)
    axes[1].set_ylim(0, 1.05)
    axes[1].legend(fontsize=9)
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    path = os.path.join(save_dir, "training_curves_classifier.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    print(f"\n✅ Courbes sauvegardées : {path}")
    plt.show()


def train_classifier(
    msseg_dir="data/msseg",
    mslsc_dir="data/mslsc",
    oasis_dir="data/oasis",
    save_dir="ai/checkpoints",
    epochs=30,
    batch_size=16,
    lr=1e-4,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Dataset
    dataset = SEPClassificationDataset(
        msseg_dir, mslsc_dir, oasis_dir,
        target_size=(128, 128), max_sains=385, augment=True
    )

    # Split 70/15/15
    total = len(dataset)
    train_size = int(total * 0.7)
    val_size = int(total * 0.15)
    test_size = total - train_size - val_size

    train_set, val_set, test_set = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    print(f"📊 Train: {train_size} | Val: {val_size} | Test: {test_size}")

    # WeightedSampler
    labels_train = [dataset.samples[i][2] for i in train_set.indices]
    class_counts = [labels_train.count(0), labels_train.count(1)]
    weights = [1.0 / class_counts[l] for l in labels_train]
    sampler = WeightedRandomSampler(weights, len(weights))

    train_loader = DataLoader(train_set, batch_size=batch_size, sampler=sampler)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False)

    # Modèle
    model = SEPClassifier().to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 SEP Classifier : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = torch.nn.BCELoss()

    os.makedirs(save_dir, exist_ok=True)
    best_acc = 0.0

    history = {
        'train_loss': [], 'val_loss': [],
        'train_acc': [], 'val_acc': [],
        'val_sens': [], 'val_spec': []
    }

    for epoch in range(epochs):
        # ── Train ──
        model.train()
        train_losses, train_accs = [], []
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device).unsqueeze(1)
            optimizer.zero_grad()
            preds = model(imgs)
            loss = criterion(preds, labels)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())
            train_accs.append(accuracy(preds, labels))

        # ── Validation ──
        model.eval()
        val_losses, val_accs = [], []
        val_preds_all, val_labels_all = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device).unsqueeze(1)
                preds = model(imgs)
                val_losses.append(criterion(preds, labels).item())
                val_accs.append(accuracy(preds, labels))
                val_preds_all.extend(preds.cpu().numpy())
                val_labels_all.extend(labels.cpu().numpy())

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        val_acc = np.mean(val_accs)
        train_acc = np.mean(train_accs)

        # Sensibilité et spécificité
        preds_bin = (np.array(val_preds_all) > 0.5).astype(int)
        labels_arr = np.array(val_labels_all).astype(int)
        tp = ((preds_bin == 1) & (labels_arr == 1)).sum()
        tn = ((preds_bin == 0) & (labels_arr == 0)).sum()
        fp = ((preds_bin == 1) & (labels_arr == 0)).sum()
        fn = ((preds_bin == 0) & (labels_arr == 1)).sum()
        sensibilite = tp / (tp + fn + 1e-6)
        specificite = tn / (tn + fp + 1e-6)

        scheduler.step()

        # Sauvegarder historique
        history['train_loss'].append(float(train_loss))
        history['val_loss'].append(float(val_loss))
        history['train_acc'].append(float(train_acc))
        history['val_acc'].append(float(val_acc))
        history['val_sens'].append(float(sensibilite))
        history['val_spec'].append(float(specificite))

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Acc: {val_acc:.4f} | "
              f"Sens: {sensibilite:.4f} | "
              f"Spec: {specificite:.4f}")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'sensibilite': sensibilite,
                'specificite': specificite,
            }, os.path.join(save_dir, "classifier_sep.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Acc={val_acc:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleure Accuracy : {best_acc:.4f}")

    # Sauvegarder historique JSON
    with open(os.path.join(save_dir, "history_classifier.json"), "w") as f:
        json.dump(history, f, indent=2)
    print(f"✅ Historique sauvegardé : {save_dir}/history_classifier.json")

    # Tracer les courbes
    plot_courbes(history)

    return best_acc


if __name__ == "__main__":
    train_classifier(
        msseg_dir="data/msseg",
        mslsc_dir="data/mslsc",
        oasis_dir="data/oasis",
        save_dir="ai/checkpoints",
        epochs=30,
        batch_size=16,
    )