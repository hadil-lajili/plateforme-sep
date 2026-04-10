import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.unet_attention import AttentionUNet, combined_loss
from ai.data.dataset import MSSEG2Dataset, split_dataset


def dice_score(pred, target, threshold=0.5, smooth=1e-6):
    pred_bin = (pred > threshold).float()
    intersection = (pred_bin * target).sum()
    return (2 * intersection + smooth) / (pred_bin.sum() + target.sum() + smooth)


def plot_courbes_segmentation(history, save_dir="ai/plots"):
    os.makedirs(save_dir, exist_ok=True)
    epochs_range = range(1, len(history['train_loss']) + 1)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('Attention U-Net MSSEG-2 — Courbes d\'entraînement', fontsize=14, fontweight='bold')

    # Loss
    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, linewidth=2, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, linewidth=2, label='Val Loss')
    axes[0].set_title('Loss par Epoch', fontsize=12, fontweight='bold')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Loss')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Dice
    axes[1].plot(epochs_range, history['val_dice'], 'g-o', markersize=3, linewidth=2, label='Val Dice')
    axes[1].axhline(y=0.648, color='orange', linestyle='--', linewidth=2, label='U-Net v1 (0.648)')
    axes[1].axhline(y=0.80, color='red', linestyle='--', linewidth=2, label='Objectif (0.80)')

    best_epoch = np.argmax(history['val_dice'])
    best_dice = history['val_dice'][best_epoch]
    axes[1].scatter([best_epoch + 1], [best_dice], color='red', s=100, zorder=5,
                   label=f'Meilleur (epoch {best_epoch+1}, {best_dice:.3f})')

    axes[1].set_title('Dice Score par Epoch', fontsize=12, fontweight='bold')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Dice Score')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    path = os.path.join(save_dir, "training_curves_v3.png")
    plt.savefig(path, dpi=150, bbox_inches='tight')
    print(f"✅ Courbes sauvegardées : {path}")
    plt.show()


def train_v3(
    msseg2_dir="data/msseg2/training",
    save_dir="ai/checkpoints",
    epochs=50,
    batch_size=8,
    lr=1e-4,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Dataset MSSEG-2
    print("\n📂 Chargement MSSEG-2...")
    dataset = MSSEG2Dataset(msseg2_dir, target_size=(256, 256), augment=True)

    train_set, val_set, test_set = split_dataset(dataset)
    print(f"📊 Train: {len(train_set)} | Val: {len(val_set)} | Test: {len(test_set)}")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    # Attention U-Net
    model = AttentionUNet(in_channels=1, out_channels=1).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 Attention U-Net : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    os.makedirs(save_dir, exist_ok=True)
    best_dice = 0.0

    history = {'train_loss': [], 'val_loss': [], 'val_dice': []}

    for epoch in range(epochs):
        # Train
        model.train()
        train_losses = []
        for imgs, masks in train_loader:
            imgs, masks = imgs.to(device), masks.to(device)
            optimizer.zero_grad()
            preds = model(imgs)
            loss = combined_loss(preds, masks)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        # Validation
        model.eval()
        val_losses, val_dices = [], []
        with torch.no_grad():
            for imgs, masks in val_loader:
                imgs, masks = imgs.to(device), masks.to(device)
                preds = model(imgs)
                val_losses.append(combined_loss(preds, masks).item())
                val_dices.append(dice_score(preds, masks).item())

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        val_dice = np.mean(val_dices)

        scheduler.step()

        history['train_loss'].append(float(train_loss))
        history['val_loss'].append(float(val_loss))
        history['val_dice'].append(float(val_dice))

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Val Dice: {val_dice:.4f}")

        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_dice': val_dice,
                'architecture': 'AttentionUNet',
            }, os.path.join(save_dir, "best_model_v3.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleur Dice : {best_dice:.4f}")
    print(f"   vs U-Net v1 : {'✅ Amélioration' if best_dice > 0.648 else '❌ Pas mieux'} ({best_dice - 0.648:+.4f})")

    # Sauvegarder historique
    with open(os.path.join(save_dir, "history_v3.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    plot_courbes_segmentation(history)

    return best_dice


if __name__ == "__main__":
    train_v3(
        msseg2_dir="data/msseg2/training",
        save_dir="ai/checkpoints",
        epochs=50,
        batch_size=8,
        lr=1e-4,
    )