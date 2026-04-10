import torch
import torch.nn as nn
import torch.nn.functional as F


class DoubleConv(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)


class UNetPredictor(nn.Module):
    """
    U-Net avec double tête :
    - Tête segmentation : masque des nouvelles lésions
    - Tête classification : y aura-t-il des lésions ? (oui/non)
    
    Input  : (B, 1, 256, 256) — FLAIR T0
    Output : masque (B, 1, 256, 256) + proba (B, 1)
    """
    def __init__(self,in_channels=2, features=[32, 64, 128, 256]):
        super().__init__()
        self.encoder = nn.ModuleList()
        self.decoder = nn.ModuleList()
        self.pool = nn.MaxPool2d(2, 2)

        # Encodeur
        in_ch = in_channels
        for f in features:
            self.encoder.append(DoubleConv(in_ch, f))
            in_ch = f

        # Bottleneck
        self.bottleneck = DoubleConv(features[-1], features[-1] * 2)

        # Décodeur segmentation
        for f in reversed(features):
            self.decoder.append(nn.ConvTranspose2d(f * 2, f, 2, 2))
            self.decoder.append(DoubleConv(f * 2, f))

        # Tête segmentation
        self.seg_head = nn.Conv2d(features[0], 1, 1)

        # Tête classification (sur le bottleneck)
        self.cls_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(4),
            nn.Flatten(),
            nn.Linear(features[-1] * 2 * 4 * 4, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        skips = []

        # Encodeur
        for enc in self.encoder:
            x = enc(x)
            skips.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)

        # Classification depuis bottleneck
        cls_out = self.cls_head(x)

        # Décodeur segmentation
        skips = skips[::-1]
        for i in range(0, len(self.decoder), 2):
            x = self.decoder[i](x)
            skip = skips[i // 2]
            if x.shape != skip.shape:
                x = F.interpolate(x, size=skip.shape[2:])
            x = torch.cat([skip, x], dim=1)
            x = self.decoder[i + 1](x)

        seg_out = torch.sigmoid(self.seg_head(x))

        return seg_out, cls_out