import torch
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
import os
import json
import matplotlib.pyplot as plt

from ai.models.unet_predictor import UNetPredictor
from ai.data.dataset_prediction import MSLesionPredictionDataset


def dice_loss(pred, target, smooth=1e-6):
    pred = pred.view(-1)
    target = target.view(-1)
    intersection = (pred * target).sum()
    return 1 - (2 * intersection + smooth) / (pred.sum() + target.sum() + smooth)


def dice_score(pred, target, threshold=0.5, smooth=1e-6):
    pred_bin = (pred > threshold).float()
    intersection = (pred_bin * target).sum()
    return (2 * intersection + smooth) / (pred_bin.sum() + target.sum() + smooth)


def tversky_loss(pred, target, alpha=0.3, beta=0.7, smooth=1e-6):
    pred = pred.view(-1)
    target = target.view(-1)
    tp = (pred * target).sum()
    fp = (pred * (1 - target)).sum()
    fn = ((1 - pred) * target).sum()
    return 1 - (tp + smooth) / (tp + alpha * fp + beta * fn + smooth)


def focal_tversky_loss(pred, target, gamma=0.75):
    tversky = tversky_loss(pred, target)
    return tversky ** gamma


def combined_loss(seg_pred, seg_target, cls_pred, cls_target):
    loss_seg = focal_tversky_loss(seg_pred, seg_target)
    smooth = 0.1
    cls_target_smooth = cls_target * (1 - smooth) + smooth / 2
    loss_cls = torch.nn.functional.binary_cross_entropy(
        cls_pred, cls_target_smooth.unsqueeze(1)
    )
    return loss_seg + 0.3 * loss_cls, loss_seg.item(), loss_cls.item()


def train_predictor(
    msseg2_dir="data/msseg2/training",
    save_dir="ai/checkpoints",
    epochs=150,
    batch_size=4,
    lr=1e-4,
    resume=None,
    device=None
):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device : {device}")

    print("\n📂 Chargement dataset prédiction...")
    dataset = MSLesionPredictionDataset(msseg2_dir, augment=True)

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

    model = UNetPredictor().to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"🧠 U-Net Predictor : {n_params:,} paramètres")

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    
    # ← Ajoute cette ligne ici
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='max', patience=10, factor=0.5
    )

    # Reprendre depuis checkpoint
    start_epoch = 0
    best_dice = 0.0
    if resume and os.path.exists(resume):
        checkpoint = torch.load(resume, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        best_dice = checkpoint['val_dice']
        start_epoch = checkpoint['epoch'] + 1
        print(f"✅ Reprise depuis epoch {start_epoch} | Dice={best_dice:.4f}")

    os.makedirs(save_dir, exist_ok=True)

    history = {
        'train_loss': [], 'val_loss': [],
        'val_dice': [], 'val_cls_acc': []
    }

    for epoch in range(start_epoch, epochs):
        # Train
        model.train()
        train_losses = []
        for flair, masque, label in train_loader:
            flair = flair.to(device)
            masque = masque.to(device)
            label = label.to(device)

            optimizer.zero_grad()
            seg_pred, cls_pred = model(flair)
            loss, _, _ = combined_loss(seg_pred, masque, cls_pred, label)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        # Validation
        model.eval()
        val_losses, val_dices, val_cls_accs = [], [], []
        with torch.no_grad():
            for flair, masque, label in val_loader:
                flair = flair.to(device)
                masque = masque.to(device)
                label = label.to(device)

                seg_pred, cls_pred = model(flair)
                loss, _, _ = combined_loss(seg_pred, masque, cls_pred, label)
                val_losses.append(loss.item())
                val_dices.append(dice_score(seg_pred, masque).item())

                cls_bin = (cls_pred > 0.5).float().squeeze()
                val_cls_accs.append((cls_bin == label).float().mean().item())

        train_loss = np.mean(train_losses)
        val_loss = np.mean(val_losses)
        val_dice = np.mean(val_dices)
        val_cls_acc = np.mean(val_cls_accs)

        # ReduceLROnPlateau sur le Dice
        scheduler.step(val_dice)

        history['train_loss'].append(float(train_loss))
        history['val_loss'].append(float(val_loss))
        history['val_dice'].append(float(val_dice))
        history['val_cls_acc'].append(float(val_cls_acc))

        print(f"Epoch {epoch+1:3d}/{epochs} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Dice: {val_dice:.4f} | "
              f"Cls Acc: {val_cls_acc:.4f} | "
              f"LR: {optimizer.param_groups[0]['lr']:.2e}")

        if val_dice > best_dice:
            best_dice = val_dice
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_dice': val_dice,
                'val_cls_acc': val_cls_acc,
                'architecture': 'UNetPredictor'
            }, os.path.join(save_dir, "predictor_lesions.pth"))
            print(f"  💾 Meilleur modèle sauvegardé (Dice={val_dice:.4f})")

    print(f"\n✅ Entraînement terminé !")
    print(f"   Meilleur Dice : {best_dice:.4f}")

    with open(os.path.join(save_dir, "history_predictor.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Courbes
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle('U-Net Predictor — Courbes d\'entraînement', fontsize=14, fontweight='bold')
    epochs_range = range(start_epoch + 1, start_epoch + len(history['train_loss']) + 1)

    axes[0].plot(epochs_range, history['train_loss'], 'b-o', markersize=3, label='Train Loss')
    axes[0].plot(epochs_range, history['val_loss'], 'r-o', markersize=3, label='Val Loss')
    axes[0].set_title('Loss par Epoch')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Loss')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, history['val_dice'], 'g-o', markersize=3, linewidth=2)
    axes[1].axhline(y=0.5, color='orange', linestyle='--', label='Seuil 0.5')
    axes[1].axhline(y=0.7, color='red', linestyle='--', label='Objectif 0.7')
    best_epoch = np.argmax(history['val_dice'])
    best_val = history['val_dice'][best_epoch]
    axes[1].scatter([start_epoch + best_epoch + 1], [best_val], color='red', s=100, zorder=5,
                   label=f'Meilleur (epoch {start_epoch + best_epoch+1}, {best_val:.3f})')
    axes[1].set_title('Dice Segmentation par Epoch')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Dice Score')
    axes[1].set_ylim(0, 1.05)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    axes[2].plot(epochs_range, history['val_cls_acc'], 'purple', marker='o', markersize=3, linewidth=2)
    axes[2].axhline(y=0.9, color='gray', linestyle='--', label='Seuil 90%')
    axes[2].set_title('Accuracy Classification par Epoch')
    axes[2].set_xlabel('Epoch')
    axes[2].set_ylabel('Accuracy')
    axes[2].set_ylim(0, 1.05)
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)

    plt.tight_layout()
    os.makedirs("ai/plots", exist_ok=True)
    plt.savefig("ai/plots/predictor_curves_v3.png", dpi=150, bbox_inches='tight')
    plt.show()

    return best_dice


if __name__ == "__main__":
    train_predictor(
        msseg2_dir="data/msseg2/training",
        save_dir="ai/checkpoints",
        epochs=150,
        batch_size=4,
        lr=1e-4,
        resume=None,  # ← repartir de zéro
    )