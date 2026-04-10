import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvLSTMCell(nn.Module):
    """
    Cellule ConvLSTM — combine CNN + LSTM
    Apprend les dépendances spatiales ET temporelles
    """
    def __init__(self, in_channels, hidden_channels, kernel_size=3):
        super().__init__()
        self.hidden_channels = hidden_channels
        padding = kernel_size // 2

        # 4 gates : input, forget, output, cell
        self.conv = nn.Conv2d(
            in_channels + hidden_channels,
            4 * hidden_channels,
            kernel_size, padding=padding, bias=True
        )

    def forward(self, x, h, c):
        # x : (B, C, H, W) — coupe actuelle
        # h : (B, hidden, H, W) — état caché
        # c : (B, hidden, H, W) — état cellule

        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)

        # Séparer les 4 gates
        i, f, o, g = gates.chunk(4, dim=1)

        i = torch.sigmoid(i)  # input gate
        f = torch.sigmoid(f)  # forget gate
        o = torch.sigmoid(o)  # output gate
        g = torch.tanh(g)     # cell gate

        # Mettre à jour état cellule et caché
        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)

        return h_next, c_next

    def init_hidden(self, batch_size, height, width, device):
        h = torch.zeros(batch_size, self.hidden_channels, height, width).to(device)
        c = torch.zeros(batch_size, self.hidden_channels, height, width).to(device)
        return h, c


class ConvLSTMPredictor(nn.Module):
    """
    Modèle de prédiction temporelle des lésions SEP
    
    Input  : (B, T, 1, H, W) — T=3 timepoints consécutifs
    Output : masque lésions T+1 (B, 1, H, W)
    
    Architecture :
    1. Encodeur CNN — extraire features spatiales
    2. ConvLSTM — apprendre la trajectoire temporelle
    3. Décodeur U-Net — reconstruire le masque futur
    """
    def __init__(self, in_channels=1, hidden_channels=32, n_timesteps=3):
        super().__init__()
        self.n_timesteps = n_timesteps
        self.hidden_channels = hidden_channels

        # ── Encodeur CNN ──
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 16, 3, padding=1), nn.BatchNorm2d(16), nn.ReLU(),
            nn.Conv2d(16, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.MaxPool2d(2),  # 64x64

            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.MaxPool2d(2),  # 32x32
        )

        # ── ConvLSTM — apprend la trajectoire temporelle ──
        self.convlstm = ConvLSTMCell(
            in_channels=64,
            hidden_channels=hidden_channels,
            kernel_size=3
        )

        # ── Décodeur — reconstruit le masque ──
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(hidden_channels, 64, 2, stride=2),  # 64x64
            nn.BatchNorm2d(64), nn.ReLU(),

            nn.Conv2d(64, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),

            nn.ConvTranspose2d(32, 16, 2, stride=2),  # 128x128
            nn.BatchNorm2d(16), nn.ReLU(),

            nn.Conv2d(16, 1, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x : (B, T, 1, H, W)
        B, T, C, H, W = x.shape

        # Encoder chaque timepoint
        features = []
        for t in range(T):
            feat = self.encoder(x[:, t])  # (B, 64, H/4, W/4)
            features.append(feat)

        _, _, Hf, Wf = features[0].shape

        # Initialiser état ConvLSTM
        h, c = self.convlstm.init_hidden(B, Hf, Wf, x.device)

        # Traiter la séquence temporelle
        for t in range(T):
            h, c = self.convlstm(features[t], h, c)

        # h contient la représentation temporelle complète
        # Décoder pour prédire T+1
        output = self.decoder(h)  # (B, 1, H, W)

        return output