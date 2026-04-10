import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Dropout2d(0.1),
        )

    def forward(self, x):
        return self.conv(x)


class AttentionGate(nn.Module):
    """
    Attention Gate — focus sur les régions pertinentes (lésions)
    Filtre les features skip pour ne garder que ce qui est utile
    """
    def __init__(self, F_g, F_l, F_int):
        super().__init__()
        self.W_g = nn.Sequential(
            nn.Conv2d(F_g, F_int, 1, bias=True),
            nn.BatchNorm2d(F_int)
        )
        self.W_x = nn.Sequential(
            nn.Conv2d(F_l, F_int, 1, bias=True),
            nn.BatchNorm2d(F_int)
        )
        self.psi = nn.Sequential(
            nn.Conv2d(F_int, 1, 1, bias=True),
            nn.BatchNorm2d(1),
            nn.Sigmoid()
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, g, x):
        g1 = self.W_g(g)
        x1 = self.W_x(x)
        if g1.shape != x1.shape:
            g1 = F.interpolate(g1, size=x1.shape[2:])
        psi = self.relu(g1 + x1)
        psi = self.psi(psi)
        return x * psi


class AttentionUNet(nn.Module):
    """
    Attention U-Net pour segmentation des lésions SEP
    Meilleur que U-Net standard car il se concentre sur les petites lésions
    Input  : (B, 1, 256, 256)
    Output : (B, 1, 256, 256)
    """
    def __init__(self, in_channels=1, out_channels=1, features=[64, 128, 256, 512]):
        super().__init__()
        self.encoder = nn.ModuleList()
        self.decoder_up = nn.ModuleList()
        self.decoder_conv = nn.ModuleList()
        self.attention = nn.ModuleList()
        self.pool = nn.MaxPool2d(2, 2)

        # Encodeur
        in_ch = in_channels
        for f in features:
            self.encoder.append(ConvBlock(in_ch, f))
            in_ch = f

        # Bottleneck
        self.bottleneck = ConvBlock(features[-1], features[-1] * 2)

        # Décodeur avec attention
        for i, f in enumerate(reversed(features)):
            self.decoder_up.append(
                nn.ConvTranspose2d(f * 2, f, kernel_size=2, stride=2)
            )
            self.attention.append(
                AttentionGate(F_g=f, F_l=f, F_int=f // 2)
            )
            self.decoder_conv.append(ConvBlock(f * 2, f))

        self.final = nn.Conv2d(features[0], out_channels, 1)

    def forward(self, x):
        skips = []

        # Encodeur
        for enc in self.encoder:
            x = enc(x)
            skips.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)
        skips = skips[::-1]

        # Décodeur avec attention gates
        for i in range(len(self.decoder_up)):
            x = self.decoder_up[i](x)
            skip = skips[i]

            if x.shape != skip.shape:
                x = F.interpolate(x, size=skip.shape[2:])

            # Attention gate — filtre le skip
            skip = self.attention[i](g=x, x=skip)

            x = torch.cat([skip, x], dim=1)
            x = self.decoder_conv[i](x)

        return torch.sigmoid(self.final(x))


def dice_loss(pred, target, smooth=1e-6):
    pred = pred.view(-1)
    target = target.view(-1)
    intersection = (pred * target).sum()
    return 1 - (2 * intersection + smooth) / (pred.sum() + target.sum() + smooth)


def focal_loss(pred, target, alpha=0.8, gamma=2):
    """Focal loss — pénalise plus les faux négatifs (lésions manquées)"""
    bce = F.binary_cross_entropy(pred, target, reduction='none')
    pt = torch.exp(-bce)
    focal = alpha * (1 - pt) ** gamma * bce
    return focal.mean()


def combined_loss(pred, target):
    """Dice + Focal — optimal pour lésions rares et petites"""
    return dice_loss(pred, target) + focal_loss(pred, target)