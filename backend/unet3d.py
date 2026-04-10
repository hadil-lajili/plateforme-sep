"""
U-Net 3D pour la segmentation de lesions SEP
=============================================

Architecture adaptee a une GTX 1650 (4 Go VRAM) :
  - 4 niveaux de profondeur (au lieu de 5 dans l'original)
  - Base features = 16 (au lieu de 32 ou 64) -> divise la VRAM par 2-4
  - Upsampling par interpolation trilineaire + conv 1x1x1
    (plus leger que ConvTranspose3D et evite les artefacts en damier)
  - BatchNorm3d + ReLU entre chaque convolution
  - Skip connections classiques

Entree  : (B, 1, 64, 64, 64)   - patch FLAIR 3D normalise
Sortie  : (B, 1, 64, 64, 64)   - logits (pas de sigmoid, car la Dice Loss
                                 et BCEWithLogitsLoss l'appliquent en interne,
                                 c'est plus stable numeriquement)

Usage :
    python unet3d.py   # test de forward pass + comptage parametres
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# =============================================================================
# BRIQUE DE BASE : DoubleConv
# =============================================================================
class DoubleConv(nn.Module):
    """
    Bloc standard du U-Net :
        Conv3D -> BatchNorm -> ReLU -> Conv3D -> BatchNorm -> ReLU

    C'est la brique qui fait le gros du calcul. Elle double souvent le
    nombre de canaux entre l'entree et la sortie.
    """
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.block = nn.Sequential(
            # Premiere conv : kernel 3x3x3, padding 1 pour conserver la taille
            nn.Conv3d(in_channels, out_channels, kernel_size=3,
                      padding=1, bias=False),
            nn.BatchNorm3d(out_channels),
            nn.ReLU(inplace=True),
            # Deuxieme conv : meme nb de canaux, kernel 3x3x3
            nn.Conv3d(out_channels, out_channels, kernel_size=3,
                      padding=1, bias=False),
            nn.BatchNorm3d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


# =============================================================================
# BLOC DESCENDANT : Down
# =============================================================================
class Down(nn.Module):
    """
    Bloc de la partie encodeur (partie descendante du U) :
        MaxPool3D 2x2x2  ->  DoubleConv

    Le MaxPool divise les dimensions spatiales par 2.
    La DoubleConv augmente le nombre de canaux (generalement x2).
    """
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.pool_conv = nn.Sequential(
            nn.MaxPool3d(kernel_size=2),
            DoubleConv(in_channels, out_channels),
        )

    def forward(self, x):
        return self.pool_conv(x)


# =============================================================================
# BLOC MONTANT : Up
# =============================================================================
class Up(nn.Module):
    """
    Bloc de la partie decodeur (partie montante du U) :
        1. Upsample trilineaire (x2 sur chaque dimension spatiale)
        2. Conv 1x1x1 pour reduire les canaux (remplace ConvTranspose3D)
        3. Concat avec la skip connection venant de l'encodeur
        4. DoubleConv pour fusionner les features

    Pourquoi upsample + conv plutot que ConvTranspose3D ?
      - Moins de parametres (la conv 1x1x1 est tres legere)
      - Pas d'artefacts en damier (probleme connu des ConvTranspose)
      - Plus stable sur les petits datasets
    """
    def __init__(self, in_channels: int, skip_channels: int,
                 out_channels: int):
        super().__init__()
        # Upsample x2 puis reduit les canaux avec une conv 1x1x1
        self.upsample = nn.Upsample(scale_factor=2, mode="trilinear",
                                    align_corners=False)
        self.reduce = nn.Conv3d(in_channels, in_channels // 2,
                                kernel_size=1)
        # Apres concat avec la skip, on fusionne
        self.conv = DoubleConv(in_channels // 2 + skip_channels, out_channels)

    def forward(self, x, skip):
        """
        x    : feature map du niveau inferieur (plus petite spatialement)
        skip : feature map de l'encodeur au meme niveau (skip connection)
        """
        x = self.upsample(x)
        x = self.reduce(x)

        # Au cas ou les tailles ne matchent pas exactement (arrondis
        # d'upsampling), on pad x pour qu'il matche skip
        diff_z = skip.shape[2] - x.shape[2]
        diff_y = skip.shape[3] - x.shape[3]
        diff_x = skip.shape[4] - x.shape[4]
        if diff_x or diff_y or diff_z:
            x = F.pad(x, [diff_x // 2, diff_x - diff_x // 2,
                          diff_y // 2, diff_y - diff_y // 2,
                          diff_z // 2, diff_z - diff_z // 2])

        # Concatenation le long de la dimension canaux (dim=1)
        x = torch.cat([skip, x], dim=1)
        return self.conv(x)


# =============================================================================
# MODELE COMPLET : UNet3D
# =============================================================================
class UNet3D(nn.Module):
    """
    U-Net 3D allege pour la segmentation binaire de lesions SEP.

    Architecture :
        Input (1, 64, 64, 64)
          |
        DoubleConv(1 -> 16)                 [enc1 : 16 canaux, 64^3]
          |                                  skip1
          v
        Down(16 -> 32)                      [enc2 : 32 canaux, 32^3]
          |                                  skip2
          v
        Down(32 -> 64)                      [enc3 : 64 canaux, 16^3]
          |                                  skip3
          v
        Down(64 -> 128)                     [bottleneck : 128 canaux, 8^3]
          |
          v
        Up(128 -> 64) + skip3               [dec3 : 64 canaux, 16^3]
          |
          v
        Up(64 -> 32) + skip2                [dec2 : 32 canaux, 32^3]
          |
          v
        Up(32 -> 16) + skip1                [dec1 : 16 canaux, 64^3]
          |
          v
        Conv1x1x1(16 -> 1)                  [Output : 1 canal, 64^3]
    """
    def __init__(self, in_channels: int = 1, out_channels: int = 1,
                 base_features: int = 16):
        super().__init__()
        f = base_features  # raccourci

        # --- Encodeur ---
        self.enc1 = DoubleConv(in_channels, f)          # 1 -> 16
        self.enc2 = Down(f, f * 2)                      # 16 -> 32
        self.enc3 = Down(f * 2, f * 4)                  # 32 -> 64
        self.bottleneck = Down(f * 4, f * 8)            # 64 -> 128

        # --- Decodeur ---
        # Up prend (in_channels, skip_channels, out_channels)
        self.dec3 = Up(f * 8, f * 4, f * 4)             # 128 + 64 -> 64
        self.dec2 = Up(f * 4, f * 2, f * 2)             # 64  + 32 -> 32
        self.dec1 = Up(f * 2, f, f)                     # 32  + 16 -> 16

        # --- Tete de sortie ---
        # Conv 1x1x1 qui reduit a out_channels (1 pour binaire)
        # Pas de sigmoid ici : on sort des logits, la loss s'en charge
        self.head = nn.Conv3d(f, out_channels, kernel_size=1)

    def forward(self, x):
        # Encodeur : on garde les skip connections
        s1 = self.enc1(x)                     # (B, 16,  64, 64, 64)
        s2 = self.enc2(s1)                    # (B, 32,  32, 32, 32)
        s3 = self.enc3(s2)                    # (B, 64,  16, 16, 16)
        b = self.bottleneck(s3)               # (B, 128, 8,  8,  8)

        # Decodeur : on remonte en injectant les skips
        d3 = self.dec3(b, s3)                 # (B, 64,  16, 16, 16)
        d2 = self.dec2(d3, s2)                # (B, 32,  32, 32, 32)
        d1 = self.dec1(d2, s1)                # (B, 16,  64, 64, 64)

        # Sortie
        return self.head(d1)                  # (B, 1,   64, 64, 64)


# =============================================================================
# HELPERS DE DIAGNOSTIC
# =============================================================================
def count_parameters(model: nn.Module) -> int:
    """Compte le nombre de parametres entrainables."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def estimate_memory(model: nn.Module, input_shape: tuple,
                    device: str = "cuda") -> dict:
    """
    Estime la VRAM consommee par un forward + backward.

    Attention : cette estimation est approximative. La vraie conso depend
    aussi des tenseurs intermediaires, du cache PyTorch, etc.
    """
    if device == "cuda" and not torch.cuda.is_available():
        return {"error": "CUDA non disponible"}

    model = model.to(device)
    torch.cuda.reset_peak_memory_stats(device)
    torch.cuda.empty_cache()

    x = torch.randn(*input_shape, device=device, requires_grad=True)

    # Forward
    y = model(x)
    forward_mb = torch.cuda.max_memory_allocated(device) / 1024**2

    # Backward (simule une loss)
    loss = y.mean()
    loss.backward()
    total_mb = torch.cuda.max_memory_allocated(device) / 1024**2

    return {
        "forward_mb": round(forward_mb, 1),
        "total_mb (forward+backward)": round(total_mb, 1),
    }


# =============================================================================
# TEST
# =============================================================================
if __name__ == "__main__":
    print("=" * 70)
    print("TEST DU U-NET 3D")
    print("=" * 70)

    # --- 1. Creation du modele ---
    model = UNet3D(in_channels=1, out_channels=1, base_features=16)
    n_params = count_parameters(model)
    print(f"\n[Architecture]")
    print(f"  Parametres entrainables : {n_params:,} "
          f"({n_params / 1e6:.2f} M)")

    # --- 2. Forward pass sur CPU (pour verifier la logique) ---
    print(f"\n[Test forward CPU]")
    x = torch.randn(1, 1, 64, 64, 64)
    print(f"  Input shape  : {tuple(x.shape)}")
    with torch.no_grad():
        y = model(x)
    print(f"  Output shape : {tuple(y.shape)}")
    assert y.shape == x.shape, "La shape de sortie doit matcher l'entree !"
    print(f"  [OK] Les shapes correspondent")

    # --- 3. Test avec batch_size=2 ---
    print(f"\n[Test forward CPU batch_size=2]")
    x = torch.randn(2, 1, 64, 64, 64)
    with torch.no_grad():
        y = model(x)
    print(f"  Input shape  : {tuple(x.shape)}")
    print(f"  Output shape : {tuple(y.shape)}")

    # --- 4. Test GPU + estimation VRAM ---
    if torch.cuda.is_available():
        print(f"\n[Test GPU]")
        print(f"  GPU detecte : {torch.cuda.get_device_name(0)}")
        print(f"  VRAM totale : "
              f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} Go")

        # Estimation pour batch_size=1
        print(f"\n  --- batch_size=1 ---")
        mem = estimate_memory(model, (1, 1, 64, 64, 64), device="cuda")
        for k, v in mem.items():
            print(f"    {k}: {v} MB")

        # Estimation pour batch_size=2
        torch.cuda.empty_cache()
        print(f"\n  --- batch_size=2 ---")
        mem = estimate_memory(model, (2, 1, 64, 64, 64), device="cuda")
        for k, v in mem.items():
            print(f"    {k}: {v} MB")

        # Estimation pour batch_size=4 (pour voir si on peut pousser)
        torch.cuda.empty_cache()
        print(f"\n  --- batch_size=4 ---")
        try:
            mem = estimate_memory(model, (4, 1, 64, 64, 64), device="cuda")
            for k, v in mem.items():
                print(f"    {k}: {v} MB")
        except torch.cuda.OutOfMemoryError:
            print(f"    [OOM] batch_size=4 ne passe pas, on restera a 2")
    else:
        print(f"\n[!] CUDA non disponible, pas de test GPU")

    # --- 5. Sanity check : gradient qui passe ---
    print(f"\n[Test backward CPU]")
    model.train()
    x = torch.randn(2, 1, 64, 64, 64)
    target = torch.zeros(2, 1, 64, 64, 64)
    y = model(x)
    loss = F.binary_cross_entropy_with_logits(y, target)
    loss.backward()
    # Verifie qu'au moins un parametre a recu un gradient
    has_grad = any(p.grad is not None and p.grad.abs().sum() > 0
                   for p in model.parameters())
    print(f"  Loss initiale : {loss.item():.4f}")
    print(f"  Gradients presents : {has_grad}")
    assert has_grad, "Aucun gradient calcule !"
    print(f"  [OK] Backward pass fonctionne")

    print("\n" + "=" * 70)
    print("U-NET 3D OK - pret pour l'entrainement")
    print("=" * 70)
