import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.classifier_v2 import SEPClassifierV2
from ai.data.dataset_v2 import SEPPatientDataset


def accuracy(preds, targets, threshold=0.5):
    preds_bin = (preds > threshold).float()
    return (preds_bin == targets).float().mean().item()


def train_classifier_v2(
    msseg_dir="data/msseg",
    msseg2_dir="data/msseg2/training",
    mslsc_dir="data/mslsc",
    save_dir="ai/checkpoints",
    epochs=40,
    batch_size=8,
    lr=1e-4,
    n_coupes=10,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    dataset = SEPPatientDataset(
        msseg_dir=msseg_dir,
        msseg2_dir=msseg2_dir,
        mslsc_dir=mslsc_dir,
        target_size=(128, 128),
        augment=True,
        n_coupes_par_patient=n_coupes
    )

    total = len(dataset)
    train_size = int(total * 0.7)
    val_size = int(total * 0.15)
    test_size = total - train_size - val_size

    train_set, val_set, test_set = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    print(f"📊 Train: {train_size} | Val: {val_size} | Test: {test_size}")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    model = SEPClassifierV2(n_coupes=n_coupes).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 SEP Classifier V2 : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = torch.nn.BCELoss()

    os.makedirs(save_dir, exist_ok=True)
    best_acc = 0.0
    history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': [], 'val_sens': [], 'val_spec': []}

    for epoch in range(epochs):
        # Train
        model.train()
        train_losses, train_accs = [], []
        for imgs, labels in train_loader:
            imgs = imgs.to(device)
            labels = labels.to(device).unsqueeze(1)
            optimizer.zero_grad()
            preds = model(imgs)
            loss = criterion(preds, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())
            train_accs.append(accuracy(preds, labels))

        # Validation
        model.eval()
        val_losses, val_accs = [], []
        val_preds_all, val_labels_all = [], []
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs = imgs.to(device)
                labels = labels.to(device).unsqueeze(1)
                preds = model(imgs)
                val_losses.append(criterion(preds, labels).item())
                val_accs.append(accuracy(preds, labels))
                val_preds_all.extend(preds.cpu().numpy())
                val_labels_all.extend(labels.cpu().numpy())

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        val_acc = np.mean(val_accs)
        train_acc = np.mean(train_accs)

        preds_bin = (np.array(val_preds_all) > 0.5).astype(int)
        labels_arr = np.array(val_labels_all).astype(int)
        tp = ((preds_bin == 1) & (labels_arr == 1)).sum()
        tn = ((preds_bin == 0) & (labels_arr == 0)).sum()
        fp = ((preds_bin == 1) & (labels_arr == 0)).sum()
        fn = ((preds_bin == 0) & (labels_arr == 1)).sum()
        sensibilite = tp / (tp + fn + 1e-6)
        specificite = tn / (tn + fp + 1e-6)

        scheduler.step()

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
                'val_acc': val_acc,
                'sensibilite': sensibilite,
                'specificite': specificite,
            }, os.path.join(save_dir, "classifier_v2.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Acc={val_acc:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleure Accuracy : {best_acc:.4f}")

    # Sauvegarder historique et courbes
    with open(os.path.join(save_dir, "history_classifier_v2.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('SEP Classifier V2 — Courbes', fontsize=14, fontweight='bold')
    epochs_range = range(1, epochs + 1)

    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, label='Val Loss')
    axes[0].set_title('Loss par Epoch')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Loss')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, history['val_acc'], 'b-o', markersize=3, label='Accuracy')
    axes[1].plot(epochs_range, history['val_sens'], color='orange', marker='o', markersize=3, label='Sensibilité')
    axes[1].plot(epochs_range, history['val_spec'], 'g-o', markersize=3, label='Spécificité')
    axes[1].axhline(y=0.9, color='gray', linestyle='--', alpha=0.5, label='Seuil 90%')
    axes[1].set_title('Métriques par Epoch')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Score')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs("ai/plots", exist_ok=True)
    plt.savefig("ai/plots/classifier_v2_curves.png", dpi=150, bbox_inches='tight')
    plt.show()

    return best_acc


if __name__ == "__main__":
    train_classifier_v2(
        msseg_dir="data/msseg",
        msseg2_dir="data/msseg2/training",
        mslsc_dir="data/mslsc",
        save_dir="ai/checkpoints",
        epochs=40,
        batch_size=8,
        n_coupes=10,
    )