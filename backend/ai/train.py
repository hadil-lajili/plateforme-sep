import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
from pathlib import Path

from ai.models.unet import UNet, combined_loss
from ai.data.dataset import MSSEGDataset, split_dataset


def dice_score(pred, target, threshold=0.5, smooth=1e-6):
    pred_bin = (pred > threshold).float()
    intersection = (pred_bin * target).sum()
    return (2 * intersection + smooth) / (pred_bin.sum() + target.sum() + smooth)


def train(
    data_dir="data/msseg",
    save_dir="ai/checkpoints",
    epochs=50,
    batch_size=8,
    lr=1e-4,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Dataset
    dataset = MSSEGDataset(data_dir)
    train_set, val_set, test_set = split_dataset(dataset)
    print(f"📊 Train: {len(train_set)} | Val: {len(val_set)} | Test: {len(test_set)}")

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False, num_workers=0)

    # Modèle
    model = UNet(in_channels=1, out_channels=1).to(device)
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    os.makedirs(save_dir, exist_ok=True)
    best_dice = 0.0
    history = {"train_loss": [], "val_loss": [], "val_dice": []}

    for epoch in range(epochs):
        # ── Entraînement ──
        model.train()
        train_losses = []
        for imgs, masks in train_loader:
            imgs, masks = imgs.to(device), masks.to(device)
            optimizer.zero_grad()
            preds = model(imgs)
            loss = combined_loss(preds, masks)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())

        # ── Validation ──
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

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_dice"].append(val_dice)

        scheduler.step(val_loss)

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Val Dice: {val_dice:.4f}")

        # Sauvegarder le meilleur modèle
        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_dice': val_dice,
            }, os.path.join(save_dir, "best_model.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleur Dice : {best_dice:.4f}")
    return history


if __name__ == "__main__":
    train(
        data_dir="data/msseg",
        save_dir="ai/checkpoints",
        epochs=50,
        batch_size=8,
    )