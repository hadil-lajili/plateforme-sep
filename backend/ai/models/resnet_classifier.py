import torch
import torch.nn as nn
import torchvision.models as models


class ResNetSEPClassifier(nn.Module):
    """
    Classificateur SEP basé sur ResNet-50 pré-entraîné
    - Encodeur : ResNet-50 (poids ImageNet)
    - Tête : classification SEP/Sain
    - Input : (B, N, 1, H, W) — N coupes par patient
    - Output : (B, 1) — probabilité SEP
    """
    def __init__(self, n_coupes=5, freeze_backbone=False):
        super().__init__()

        # ResNet-50 pré-entraîné
        resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)

        # Adapter le premier conv pour 1 canal (IRM) au lieu de 3 (RGB)
        resnet.conv1 = nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3, bias=False)
        # Initialiser avec la moyenne des 3 canaux originaux
        with torch.no_grad():
            resnet.conv1.weight = nn.Parameter(
                resnet.conv1.weight.mean(dim=1, keepdim=True)
            )

        # Garder tout sauf la dernière couche FC
        self.backbone = nn.Sequential(*list(resnet.children())[:-1])  # → (B, 2048, 1, 1)

        # Geler le backbone si demandé (fine-tuning progressif)
        if freeze_backbone:
            for param in self.backbone.parameters():
                param.requires_grad = False

        # Attention sur les coupes
        self.slice_attention = nn.Sequential(
            nn.Linear(2048, 256),
            nn.Tanh(),
            nn.Linear(256, 1)
        )

        # Tête classification
        self.classifier = nn.Sequential(
            nn.Linear(2048, 512),
            nn.ReLU(),
            nn.Dropout(0.7),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x : (B, N, 1, H, W)
        B, N, C, H, W = x.shape

        # Encoder chaque coupe avec ResNet
        x = x.view(B * N, C, H, W)
        features = self.backbone(x)          # (B*N, 2048, 1, 1)
        features = features.view(B, N, 2048) # (B, N, 2048)

        # Attention — quelles coupes sont importantes ?
        attn = self.slice_attention(features)        # (B, N, 1)
        attn = torch.softmax(attn, dim=1)            # (B, N, 1)
        aggregated = (features * attn).sum(dim=1)    # (B, 2048)

        return self.classifier(aggregated)           # (B, 1)

    def unfreeze_backbone(self):
        """Dégeler le backbone pour fine-tuning complet"""
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("✅ Backbone dégelé — fine-tuning complet activé")