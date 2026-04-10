import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.resnet_classifier import ResNetSEPClassifier
from ai.data.dataset_augmented import AugmentedSEPDataset


def accuracy(preds, targets, threshold=0.5):
    preds_bin = (preds > threshold).float()
    return (preds_bin == targets).float().mean().item()


def train_resnet(
    augmented_dir="data/augmented",
    save_dir="ai/checkpoints",
    epochs=60,
    batch_size=16,
    lr=1e-4,
    n_coupes=5,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Dataset
    print("\n📂 Chargement dataset...")
    dataset = AugmentedSEPDataset(augmented_dir=augmented_dir)

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

    # ResNet-50 — Phase 1 : backbone gelé
    print("\n🧠 Phase 1 : Backbone gelé — entraîner seulement la tête")
    model = ResNetSEPClassifier(n_coupes=n_coupes, freeze_backbone=True).to(device)
    n_params_total = sum(p.numel() for p in model.parameters())
    n_params_train = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"   Paramètres total    : {n_params_total:,}")
    print(f"   Paramètres entraînés: {n_params_train:,}")

    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=lr, weight_decay=1e-4
    )
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', patience=5, factor=0.5
    )
    criterion = torch.nn.BCELoss()

    os.makedirs(save_dir, exist_ok=True)
    best_acc = 0.0
    patience = 10
    patience_counter = 0


    history = {
        'train_loss': [], 'val_loss': [],
        'train_acc': [], 'val_acc': [],
        'val_sens': [], 'val_spec': []
    }

    for epoch in range(epochs):
        # Phase 2 : dégeler le backbone après 10 epochs
        if epoch == 20:
            model.unfreeze_backbone()
            print(f"\n🔓 Epoch {epoch+1} — Backbone dégelé, fine-tuning complet")
            optimizer = optim.AdamW(model.parameters(), lr=lr/10, weight_decay=1e-3)
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode='max', patience=5, factor=0.5
            )

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

        scheduler.step(val_acc)

        history['train_loss'].append(float(train_loss))
        history['val_loss'].append(float(val_loss))
        history['train_acc'].append(float(train_acc))
        history['val_acc'].append(float(val_acc))
        history['val_sens'].append(float(sensibilite))
        history['val_spec'].append(float(specificite))

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Loss: {val_loss:.4f} | "
              f"Acc: {val_acc:.4f} | "
              f"Sens: {sensibilite:.4f} | "
              f"Spec: {specificite:.4f} | "
              f"LR: {optimizer.param_groups[0]['lr']:.2e}")

        if val_acc > best_acc:
            best_acc = val_acc
            patience_counter = 0
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_acc': val_acc,
                'sensibilite': sensibilite,
                'specificite': specificite,
                'architecture': 'ResNet50-SEP'
            }, os.path.join(save_dir, "resnet_classifier.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Acc={val_acc:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n⏹️ Early stopping à l'epoch {epoch+1}")
                break
    print(f"\n✅ Entraînement terminé ! Meilleure Accuracy : {best_acc:.4f}")

    # Sauvegarder historique
    with open(os.path.join(save_dir, "history_resnet.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('ResNet-50 SEP Classifier — Transfer Learning', fontsize=14, fontweight='bold')
    epochs_range = range(1, len(history['train_loss']) + 1)


    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, label='Val Loss')
    axes[0].axvline(x=10, color='green', linestyle='--', label='Unfreeze backbone')
    axes[0].set_title('Loss par Epoch')
    axes[0].set_xlabel('Epoch')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, history['val_acc'], 'b-o', markersize=3, label='Accuracy')
    axes[1].plot(epochs_range, history['val_sens'], color='orange', marker='o', markersize=3, label='Sensibilité')
    axes[1].plot(epochs_range, history['val_spec'], 'g-o', markersize=3, label='Spécificité')
    axes[1].axhline(y=0.9, color='gray', linestyle='--', label='Seuil 90%')
    axes[1].axvline(x=10, color='green', linestyle='--', label='Unfreeze backbone')
    axes[1].set_title('Métriques par Epoch')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs("ai/plots", exist_ok=True)
    plt.savefig("ai/plots/resnet_curves.png", dpi=150, bbox_inches='tight')
    plt.show()

    return best_acc


if __name__ == "__main__":
    train_resnet(
        augmented_dir="data/augmented",
        save_dir="ai/checkpoints",
        epochs=60,
        batch_size=16,
        n_coupes=5,
        lr=1e-4,
    )