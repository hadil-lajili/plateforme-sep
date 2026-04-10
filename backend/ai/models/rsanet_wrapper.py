import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'RSANet', 'src'))

import torch
import torch.nn as nn
from RSANet import RSANet


class RSANetWrapper(nn.Module):
    """
    Wrapper RSANet pour notre pipeline
    Adapte RSANet 3D pour travailler avec nos volumes NIfTI
    Input  : (B, 1, D, H, W) — volume 3D complet
    Output : (B, 1, D, H, W) — masque segmentation
    """
    def __init__(self):
        super().__init__()
        self.rsanet = RSANet(
            n_classes=2,
            in_channels=1,  # ← 1 canal (FLAIR)
            norm_type='GN_8'
        )
        # Tête classification (rechute oui/non)
        self.cls_head = nn.Sequential(
            nn.AdaptiveAvgPool3d(2),
            nn.Flatten(),
            nn.Linear(512 * 8, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x : (B, 1, D, H, W)
        logits = self.rsanet(x)  # (B, 2, D, H, W)
        seg = torch.softmax(logits, dim=1)[:, 1:2, :, :, :]  # (B, 1, D, H, W)
        return seg