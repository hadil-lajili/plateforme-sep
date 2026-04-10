"""
Entrainement du U-Net 3D sur ISBI 2015
========================================

Composants :
  - DiceLoss              : loss adaptee au desequilibre extreme (99.8% fond)
  - ComboLoss             : Dice + BCE (stabilise le debut de l'entrainement)
  - dice_score()          : metrique d'evaluation standard en segmentation
  - train_one_epoch()     : boucle d'entrainement sur une epoch
  - validate()            : evaluation sur le set de validation
  - main()                : orchestre tout, sauvegarde le meilleur modele

Usage :
    python train.py                 # entrainement 10 epochs (test)
    python train.py --epochs 100    # entrainement complet
    python train.py --epochs 50 --batch_size 2  # si VRAM serree
"""

import argparse
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from dataset_isbi import get_dataloaders
from unet3d import UNet3D


# =============================================================================
# CONFIGURATION
# =============================================================================
CHECKPOINTS_DIR = Path("./checkpoints")
CHECKPOINTS_DIR.mkdir(exist_ok=True)

LOGS_DIR = Path("./logs")
LOGS_DIR.mkdir(exist_ok=True)


# =============================================================================
# LOSS FUNCTIONS
# =============================================================================
class DiceLoss(nn.Module):
    """
    Dice Loss pour segmentation binaire.

    Formule :
        dice = (2 * |P ∩ G|) / (|P| + |G|)
        loss = 1 - dice

    Pourquoi la Dice Loss ?
      - Elle traite directement le probleme du desequilibre de classes.
      - Avec seulement 0.2% de voxels lesion, la Cross Entropy classique
        ferait converger le modele vers "tout est fond" (99.8% d'accuracy...).
      - La Dice Loss, elle, ne regarde QUE le recouvrement entre prediction
        et verite terrain, sans se soucier du nombre de voxels de fond.

    Le smooth=1.0 est important :
      - Evite la division par zero si |P| + |G| = 0 (patch sans lesion
        ni fausse detection).
      - Rend le gradient plus lisse au debut de l'entrainement.
    """
    def __init__(self, smooth: float = 1.0):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, target: torch.Tensor
                ) -> torch.Tensor:
        # logits : (B, 1, D, H, W) - sorties brutes du reseau
        # target : (B, 1, D, H, W) - masque binaire 0/1
        probs = torch.sigmoid(logits)

        # On calcule le Dice par element du batch puis on moyenne
        # (pour eviter qu'un gros volume domine la loss)
        probs = probs.view(probs.size(0), -1)
        target = target.view(target.size(0), -1)

        intersection = (probs * target).sum(dim=1)
        union = probs.sum(dim=1) + target.sum(dim=1)

        dice = (2 * intersection + self.smooth) / (union + self.smooth)
        return 1 - dice.mean()


class ComboLoss(nn.Module):
    """
    Combinaison Dice Loss + Binary Cross Entropy.

    Pourquoi combiner ?
      - La Dice Loss seule peut etre instable en debut d'entrainement
        (gradients faibles quand les predictions sont nulles partout).
      - La BCE fournit un gradient fort des le debut, meme si le modele
        ne prevoit encore rien de correct, ce qui lance l'apprentissage.
      - Une fois que le modele commence a prevoir, la Dice prend le relais
        et le force a optimiser le bon recouvrement spatial.

    Le ratio 0.5 / 0.5 est un choix classique. Certains papiers utilisent
    plutot 0.4 Dice / 0.6 BCE ou l'inverse. On commence simple.
    """
    def __init__(self, dice_weight: float = 0.5, bce_weight: float = 0.5):
        super().__init__()
        self.dice = DiceLoss()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight

    def forward(self, logits: torch.Tensor, target: torch.Tensor
                ) -> torch.Tensor:
        dice_loss = self.dice(logits, target)
        bce_loss = F.binary_cross_entropy_with_logits(logits, target)
        return self.dice_weight * dice_loss + self.bce_weight * bce_loss


# =============================================================================
# METRIQUES
# =============================================================================
@torch.no_grad()
def dice_score(logits: torch.Tensor, target: torch.Tensor,
               threshold: float = 0.5, smooth: float = 1.0) -> float:
    """
    Calcule le Dice score (pas la loss) sur un batch.
    C'est la metrique standard en segmentation medicale.

    Range : [0, 1]
      - 0   = aucun recouvrement (modele completement faux)
      - 1   = recouvrement parfait
      - 0.7 = environ le plafond theorique sur ISBI (accord inter-experts)
    """
    probs = torch.sigmoid(logits)
    preds = (probs > threshold).float()

    preds = preds.view(preds.size(0), -1)
    target = target.view(target.size(0), -1)

    intersection = (preds * target).sum(dim=1)
    union = preds.sum(dim=1) + target.sum(dim=1)
    dice = (2 * intersection + smooth) / (union + smooth)
    return dice.mean().item()


@torch.no_grad()
def sensitivity_precision(logits: torch.Tensor, target: torch.Tensor,
                          threshold: float = 0.5) -> tuple:
    """
    Sensibilite (rappel)  : TP / (TP + FN)  - "le modele rate-t-il des lesions ?"
    Precision             : TP / (TP + FP)  - "le modele sur-detecte-t-il ?"

    Utile pour diagnostiquer si le modele est trop conservateur
    (sensibilite faible) ou trop agressif (precision faible).
    """
    probs = torch.sigmoid(logits)
    preds = (probs > threshold).float()

    tp = (preds * target).sum().item()
    fp = (preds * (1 - target)).sum().item()
    fn = ((1 - preds) * target).sum().item()

    sens = tp / (tp + fn + 1e-8)
    prec = tp / (tp + fp + 1e-8)
    return sens, prec


# =============================================================================
# BOUCLE D'ENTRAINEMENT
# =============================================================================
def train_one_epoch(model, loader, optimizer, criterion, device,
                    epoch: int, total_epochs: int) -> dict:
    """Entraine le modele sur une epoch et retourne les metriques moyennes."""
    model.train()
    total_loss = 0.0
    total_dice = 0.0
    n_batches = 0

    t_start = time.time()
    for batch_idx, (flair, mask) in enumerate(loader):
        flair = flair.to(device, non_blocking=True)
        mask = mask.to(device, non_blocking=True)

        # Forward
        logits = model(flair)
        loss = criterion(logits, mask)

        # Backward
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        # Metriques
        total_loss += loss.item()
        total_dice += dice_score(logits, mask)
        n_batches += 1

        # Affichage en temps reel (une ligne qui s'ecrase)
        if batch_idx % 5 == 0:
            elapsed = time.time() - t_start
            print(f"\r  Epoch {epoch}/{total_epochs}  "
                  f"batch {batch_idx + 1}/{len(loader)}  "
                  f"loss={loss.item():.4f}  "
                  f"time={elapsed:.0f}s", end="", flush=True)

    elapsed = time.time() - t_start
    print(f"\r  Epoch {epoch}/{total_epochs}  "
          f"[TRAIN] loss={total_loss / n_batches:.4f}  "
          f"dice={total_dice / n_batches:.4f}  "
          f"time={elapsed:.0f}s")

    return {
        "loss": total_loss / n_batches,
        "dice": total_dice / n_batches,
        "time": elapsed,
    }


@torch.no_grad()
def validate(model, loader, criterion, device) -> dict:
    """Evalue le modele sur le set de validation."""
    model.eval()
    total_loss = 0.0
    total_dice = 0.0
    total_sens = 0.0
    total_prec = 0.0
    n_batches = 0

    for flair, mask in loader:
        flair = flair.to(device, non_blocking=True)
        mask = mask.to(device, non_blocking=True)

        logits = model(flair)
        loss = criterion(logits, mask)

        total_loss += loss.item()
        total_dice += dice_score(logits, mask)
        sens, prec = sensitivity_precision(logits, mask)
        total_sens += sens
        total_prec += prec
        n_batches += 1

    return {
        "loss": total_loss / n_batches,
        "dice": total_dice / n_batches,
        "sensitivity": total_sens / n_batches,
        "precision": total_prec / n_batches,
    }


# =============================================================================
# MAIN
# =============================================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--base_features", type=int, default=16)
    args = parser.parse_args()

    # --- Device ---
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("=" * 70)
    print(f"ENTRAINEMENT U-NET 3D  -  device: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print("=" * 70)
    print(f"  Epochs        : {args.epochs}")
    print(f"  Batch size    : {args.batch_size}")
    print(f"  Learning rate : {args.lr}")
    print(f"  Base features : {args.base_features}")
    print()

    # --- Data ---
    train_loader, val_loader = get_dataloaders(
        batch_size=args.batch_size, num_workers=0,
    )

    # --- Model ---
    model = UNet3D(
        in_channels=1, out_channels=1,
        base_features=args.base_features,
    ).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"\nModele : {n_params / 1e6:.2f} M parametres")

    # --- Loss, optimizer, scheduler ---
    criterion = ComboLoss(dice_weight=0.5, bce_weight=0.5)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    # Scheduler : reduit le LR quand le Dice de val stagne
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=5,
    )

    # --- Boucle d'entrainement ---
    history = {
        "train_loss": [], "train_dice": [],
        "val_loss": [], "val_dice": [],
        "val_sens": [], "val_prec": [],
    }
    best_val_dice = 0.0

    print("\n" + "=" * 70)
    print("DEBUT DE L'ENTRAINEMENT")
    print("=" * 70)

    for epoch in range(1, args.epochs + 1):
        # Train
        train_metrics = train_one_epoch(
            model, train_loader, optimizer, criterion, device,
            epoch, args.epochs,
        )
        # Val
        val_metrics = validate(model, val_loader, criterion, device)
        print(f"              [VAL]   loss={val_metrics['loss']:.4f}  "
              f"dice={val_metrics['dice']:.4f}  "
              f"sens={val_metrics['sensitivity']:.3f}  "
              f"prec={val_metrics['precision']:.3f}")

        # Scheduler
        scheduler.step(val_metrics["dice"])

        # Historique
        history["train_loss"].append(train_metrics["loss"])
        history["train_dice"].append(train_metrics["dice"])
        history["val_loss"].append(val_metrics["loss"])
        history["val_dice"].append(val_metrics["dice"])
        history["val_sens"].append(val_metrics["sensitivity"])
        history["val_prec"].append(val_metrics["precision"])

        # Sauvegarde du meilleur modele
        if val_metrics["dice"] > best_val_dice:
            best_val_dice = val_metrics["dice"]
            ckpt_path = CHECKPOINTS_DIR / "best_model.pth"
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_dice": best_val_dice,
                "args": vars(args),
            }, ckpt_path)
            print(f"              [!] Nouveau meilleur modele sauvegarde "
                  f"(dice={best_val_dice:.4f})")

    # --- Sauvegarde finale ---
    print("\n" + "=" * 70)
    print(f"ENTRAINEMENT TERMINE  -  meilleur Dice val : {best_val_dice:.4f}")
    print("=" * 70)

    # Sauvegarde de l'historique en numpy (pour analyse ulterieure)
    np.savez(LOGS_DIR / "history.npz", **history)
    print(f"  Historique sauve : {LOGS_DIR / 'history.npz'}")
    print(f"  Meilleur modele  : {CHECKPOINTS_DIR / 'best_model.pth'}")

    # --- Graphe des courbes ---
    try:
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))

        axes[0].plot(history["train_loss"], label="train")
        axes[0].plot(history["val_loss"], label="val")
        axes[0].set_xlabel("Epoch")
        axes[0].set_ylabel("Loss")
        axes[0].set_title("Loss (Dice + BCE)")
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(history["train_dice"], label="train")
        axes[1].plot(history["val_dice"], label="val")
        axes[1].axhline(0.73, color="red", linestyle="--",
                        label="plafond inter-experts")
        axes[1].set_xlabel("Epoch")
        axes[1].set_ylabel("Dice score")
        axes[1].set_title("Dice score")
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(LOGS_DIR / "training_curves.png", dpi=100,
                    bbox_inches="tight")
        plt.close()
        print(f"  Courbes sauvees  : {LOGS_DIR / 'training_curves.png'}")
    except Exception as e:
        print(f"  [!] Erreur generation graphe: {e}")


if __name__ == "__main__":
    main()
