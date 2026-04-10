import torch
import torch.optim as optim
from torch.utils.data import DataLoader, ConcatDataset
import numpy as np
import os

from ai.models.unet_attention import AttentionUNet, combined_loss
from ai.data.dataset import MSSEGDataset, MSLSCDataset, split_dataset


def dice_score(pred, target, threshold=0.5, smooth=1e-6):
    pred_bin = (pred > threshold).float()
    intersection = (pred_bin * target).sum()
    return (2 * intersection + smooth) / (pred_bin.sum() + target.sum() + smooth)


def train_v2(
    msseg_dir="data/msseg",
    mslsc_dir="data/mslsc",
    save_dir="ai/checkpoints",
    epochs=50,
    batch_size=8,
    lr=1e-4,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    # Charger les deux datasets
    print("\n📂 Chargement des datasets...")
    ds_msseg = MSSEGDataset(msseg_dir, augment=True)
    ds_mslsc = MSLSCDataset(mslsc_dir) if os.path.exists(mslsc_dir) else None

    if ds_mslsc:
        dataset = ConcatDataset([ds_msseg, ds_mslsc])
        print(f"✅ Dataset fusionné : {len(ds_msseg)} MSSEG + {len(ds_mslsc)} MSLSC = {len(dataset)} coupes")
    else:
        dataset = ds_msseg
        print(f"⚠️  MSLSC non trouvé — entraînement sur MSSEG uniquement")

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

    for epoch in range(epochs):
        # ── Train ──
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

        scheduler.step()

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
            }, os.path.join(save_dir, "best_model_v2.pth"))
            print(f"  💾 Nouveau meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé ! Meilleur Dice : {best_dice:.4f}")
    print(f"   Amélioration vs v1 : +{best_dice - 0.648:.4f}")
    return best_dice


if __name__ == "__main__":
    train_v2(
        msseg_dir="data/msseg",
        mslsc_dir="data/mslsc",
        save_dir="ai/checkpoints",
        epochs=50,
        batch_size=8,
        lr=1e-4,
    )