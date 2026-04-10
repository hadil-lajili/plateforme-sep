import torch
import torch.nn as nn
import torch.nn.functional as F


class DoubleConv(nn.Module):
    """Deux convolutions 3x3 avec BatchNorm et ReLU"""
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)


class UNet(nn.Module):
    """
    U-Net adapté pour la segmentation des lésions SEP
    Input  : (B, 1, 256, 256) — une coupe FLAIR en niveaux de gris
    Output : (B, 1, 256, 256) — masque binaire des lésions
    """
    def __init__(self, in_channels=1, out_channels=1, features=[64, 128, 256, 512]):
        super().__init__()
        self.encoder = nn.ModuleList()
        self.decoder = nn.ModuleList()
        self.pool = nn.MaxPool2d(2, 2)

        # Encodeur (chemin descendant)
        for feature in features:
            self.encoder.append(DoubleConv(in_channels, feature))
            in_channels = feature

        # Bottleneck
        self.bottleneck = DoubleConv(features[-1], features[-1] * 2)

        # Décodeur (chemin ascendant)
        for feature in reversed(features):
            self.decoder.append(
                nn.ConvTranspose2d(feature * 2, feature, kernel_size=2, stride=2)
            )
            self.decoder.append(DoubleConv(feature * 2, feature))

        # Couche finale
        self.final_conv = nn.Conv2d(features[0], out_channels, kernel_size=1)

    def forward(self, x):
        skip_connections = []

        # Encodeur
        for enc in self.encoder:
            x = enc(x)
            skip_connections.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)
        skip_connections = skip_connections[::-1]

        # Décodeur
        for i in range(0, len(self.decoder), 2):
            x = self.decoder[i](x)
            skip = skip_connections[i // 2]

            # Ajuster la taille si nécessaire
            if x.shape != skip.shape:
                x = F.interpolate(x, size=skip.shape[2:])

            x = torch.cat([skip, x], dim=1)
            x = self.decoder[i + 1](x)

        return torch.sigmoid(self.final_conv(x))


def dice_loss(pred, target, smooth=1e-6):
    """Loss Dice — meilleure que BCE pour les lésions rares"""
    pred = pred.view(-1)
    target = target.view(-1)
    intersection = (pred * target).sum()
    return 1 - (2 * intersection + smooth) / (pred.sum() + target.sum() + smooth)


def combined_loss(pred, target):
    """BCE + Dice — combinaison standard pour segmentation médicale"""
    bce = F.binary_cross_entropy(pred, target)
    dice = dice_loss(pred, target)
    return bce + dice