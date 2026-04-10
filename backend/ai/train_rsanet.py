import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'RSANet', 'src'))

import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import json
import matplotlib.pyplot as plt

from RSANet import RSANet
from ai.data.dataset_rsanet import MSSEG2Dataset3D


def dice_loss(pred, target, smooth=1e-6):
    pred = pred.reshape(-1)
    target = target.reshape(-1)
    intersection = (pred * target).sum()
    return 1 - (2 * intersection + smooth) / (pred.sum() + target.sum() + smooth)


def dice_score(pred, target, threshold=0.5, smooth=1e-6):
    pred_bin = (pred > threshold).float()
    intersection = (pred_bin * target).sum()
    return (2 * intersection + smooth) / (pred_bin.sum() + target.sum() + smooth)


def tversky_loss(pred, target, alpha=0.3, beta=0.7, smooth=1e-6):
    pred = pred.reshape(-1)
    target = target.reshape(-1)
    tp = (pred * target).sum()
    fp = (pred * (1 - target)).sum()
    fn = ((1 - pred) * target).sum()
    return 1 - (tp + smooth) / (tp + alpha * fp + beta * fn + smooth)


def focal_tversky_loss(pred, target, gamma=0.75):
    return tversky_loss(pred, target) ** gamma


def train_rsanet(
    msseg2_dir="data/msseg2/training",
    save_dir="ai/checkpoints",
    epochs=50,
    batch_size=2,
    lr=1e-4,
    target_size=(32, 128, 128),
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Dataset 3D
    print("\n📂 Chargement dataset 3D...")
    dataset = MSSEG2Dataset3D(msseg2_dir, patch_size=target_size, augment=True)

    train_size = int(len(dataset) * 0.7)
    val_size = int(len(dataset) * 0.15)
    test_size = len(dataset) - train_size - val_size

    train_set, val_set, test_set = torch.utils.data.random_split(
        dataset, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(42)
    )
    print(f"📊 Train: {train_size} | Val: {val_size} | Test: {test_size}")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    # Modèle RSANet
    model = RSANet(n_classes=2, in_channels=1, norm_type='GN_8').to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 RSANet : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', patience=8, factor=0.5
    )

    os.makedirs(save_dir, exist_ok=True)
    best_dice = 0.0
    history = {'train_loss': [], 'val_loss': [], 'val_dice': []}

    for epoch in range(epochs):
        # Train
        model.train()
        train_losses = []
        for flair, masque in train_loader:
            flair = flair.to(device)
            masque = masque.to(device)

            optimizer.zero_grad()
            logits = model(flair)  # (B, 2, D, H, W)
            pred = torch.softmax(logits, dim=1)[:, 1:2]  # classe lésion

            loss = focal_tversky_loss(pred, masque)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            if torch.isnan(loss):
                continue  # skip le batch problématique
            optimizer.step()
            train_losses.append(loss.item())

        # Validation
        model.eval()
        val_losses, val_dices = [], []
        with torch.no_grad():
            for flair, masque in val_loader:
                flair = flair.to(device)
                masque = masque.to(device)

                logits = model(flair)
                pred = torch.softmax(logits, dim=1)[:, 1:2]

                val_losses.append(focal_tversky_loss(pred, masque).item())
                val_dices.append(dice_score(pred, masque).item())

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        val_dice = np.mean(val_dices)

        scheduler.step(val_dice)

        history['train_loss'].append(float(train_loss))
        history['val_loss'].append(float(val_loss))
        history['val_dice'].append(float(val_dice))

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Val Dice: {val_dice:.4f} | "
              f"LR: {optimizer.param_groups[0]['lr']:.2e}")

        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_dice': val_dice,
                'architecture': 'RSANet',
                'target_size': target_size,
            }, os.path.join(save_dir, "rsanet.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé !")
    print(f"   RSANet Dice     : {best_dice:.4f}")
    print(f"   U-Net Predictor : 0.5071")
    print(f"   Amélioration    : {best_dice - 0.5071:+.4f}")

    # Sauvegarder historique
    with open(os.path.join(save_dir, "history_rsanet.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('RSANet vs U-Net Predictor', fontsize=14, fontweight='bold')
    epochs_range = range(1, len(history['train_loss']) + 1)

    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, label='Val Loss')
    axes[0].set_title('Loss par Epoch')
    axes[0].set_xlabel('Epoch')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, history['val_dice'], 'g-o', markersize=3, linewidth=2, label='RSANet')
    axes[1].axhline(y=0.5071, color='orange', linestyle='--', linewidth=2, label='U-Net Predictor (0.507)')
    axes[1].axhline(y=0.648, color='blue', linestyle='--', linewidth=2, label='U-Net Seg (0.648)')
    axes[1].axhline(y=0.7, color='red', linestyle='--', linewidth=1, label='Objectif 0.7')
    axes[1].set_title('Dice Score — Comparaison')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Dice Score')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs("ai/plots", exist_ok=True)
    plt.savefig("ai/plots/rsanet_curves.png", dpi=150, bbox_inches='tight')
    plt.show()

    return best_dice


if __name__ == "__main__":
    train_rsanet(
        msseg2_dir="data/msseg2/training",
        save_dir="ai/checkpoints",
        epochs=50,
        batch_size=2,
        lr=1e-4,
        target_size=(32, 128, 128),
    )