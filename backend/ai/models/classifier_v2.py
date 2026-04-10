import torch
import torch.nn as nn
import torch.nn.functional as F


class SliceEncoder(nn.Module):
    """Encodeur CNN pour une coupe 2D"""
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(),
            nn.AdaptiveAvgPool2d(4),
        )
        self.fc = nn.Linear(256 * 4 * 4, 256)

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        return F.relu(self.fc(x))


class SEPClassifierV2(nn.Module):
    """
    Classificateur SEP/Sain niveau patient
    Agrège les features de N coupes par attention
    Input  : (B, N, 1, H, W) — N coupes par patient
    Output : (B, 1) — probabilité SEP
    """
    def __init__(self, n_coupes=10):
        super().__init__()
        self.encoder = SliceEncoder()

        # Attention sur les coupes
        self.attention = nn.Sequential(
            nn.Linear(256, 64),
            nn.Tanh(),
            nn.Linear(64, 1),
        )

        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        B, N, C, H, W = x.shape

        # Encoder chaque coupe
        x = x.view(B * N, C, H, W)
        features = self.encoder(x)  # (B*N, 256)
        features = features.view(B, N, 256)  # (B, N, 256)

        # Attention — quelles coupes sont importantes ?
        attn_weights = self.attention(features)  # (B, N, 1)
        attn_weights = torch.softmax(attn_weights, dim=1)

        # Agrégation pondérée
        aggregated = (features * attn_weights).sum(dim=1)  # (B, 256)

        return self.classifier(aggregated)