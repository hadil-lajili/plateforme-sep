import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.convlstm_predictor import ConvLSTMPredictor
from ai.data.dataset_temporal import MSLSCTemporalDataset


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


def train_temporal(
    mslsc_dir="data/mslsc",
    save_dir="ai/checkpoints",
    epochs=100,
    batch_size=4,
    lr=1e-3,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    print("\n📂 Chargement dataset temporel...")
    dataset = MSLSCTemporalDataset(mslsc_dir, target_size=(128, 128), augment=True)
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

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    # ConvLSTM
    model = ConvLSTMPredictor(in_channels=1, hidden_channels=32, n_timesteps=3).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 ConvLSTM Predictor : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', patience=10, factor=0.5
    )

    os.makedirs(save_dir, exist_ok=True)
    best_dice = 0.0
    history = {'train_loss': [], 'val_loss': [], 'val_dice': []}

    for epoch in range(epochs):
        # Train
        model.train()
        train_losses = []
        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            preds = model(inputs)
            loss = focal_tversky_loss(preds, targets)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        # Validation
        model.eval()
        val_losses, val_dices = [], []
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs = inputs.to(device)
                targets = targets.to(device)
                preds = model(inputs)
                val_losses.append(focal_tversky_loss(preds, targets).item())
                val_dices.append(dice_score(preds, targets).item())

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
                'architecture': 'ConvLSTM'
            }, os.path.join(save_dir, "convlstm_predictor_aug.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleur Dice : {best_dice:.4f}")

    with open(os.path.join(save_dir, "history_convlstm.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle('ConvLSTM Predictor — Prédiction Temporelle Lésions SEP',
                 fontsize=14, fontweight='bold')
    epochs_range = range(1, len(history['train_loss']) + 1)

    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, label='Val Loss')
    axes[0].set_title('Loss par Epoch')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Focal Tversky Loss')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, history['val_dice'], 'g-o', markersize=3, linewidth=2)
    axes[1].axhline(y=0.5, color='orange', linestyle='--', label='Seuil 0.5')
    axes[1].axhline(y=0.7, color='red', linestyle='--', label='Objectif 0.7')
    best_epoch = np.argmax(history['val_dice'])
    best_val = history['val_dice'][best_epoch]
    axes[1].scatter([best_epoch + 1], [best_val], color='red', s=100, zorder=5,
                   label=f'Meilleur (epoch {best_epoch+1}, {best_val:.3f})')
    axes[1].set_title('Dice Score — Prédiction Lésions Futures')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Dice Score')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs("ai/plots", exist_ok=True)
    plt.savefig("ai/plots/convlstm_curves.png", dpi=150, bbox_inches='tight')
    plt.show()

    return best_dice


if __name__ == "__main__":
    train_temporal(
        mslsc_dir="data/mslsc",
        save_dir="ai/checkpoints",
        epochs=100,
        batch_size=4,
        lr=1e-3,
    )