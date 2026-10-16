import torch
import torch.nn as nn

from agents.networks import PolicyNetwork

class CNNEncoder(nn.Module):
    def __init__(self, num_channels: int, hidden_size: int):
        super().__init__()

        # Input: (batch, 4, 84, 84)
        self.network = nn.Sequential(
            nn.Conv2d(num_channels, 32, kernel_size=8, stride=4),
            nn.ReLU(),

            nn.Conv2d(32, 64, kernel_size=4, stride=2),
            nn.ReLU(),

            nn.Conv2d(64, 64, kernel_size=3, stride=1),
            nn.ReLU(),

            nn.Flatten(),

            nn.Linear(64 * 7 * 7, hidden_size),
            nn.ReLU()
        )

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        # Pixels: [0, 255] -> [0, 1]
        state = state.float() / 255.0

        return self.network(state)

class CNNPolicyNetwork(PolicyNetwork):
    def __init__(
        self,
        num_channels: int,
        hidden_size: int,
        num_actions: int
    ):
        super().__init__(
            num_inputs=hidden_size,
            hidden_size=hidden_size,
            num_actions=num_actions
        )

        self.encoder = CNNEncoder(
            num_channels=num_channels,
            hidden_size=hidden_size
        )

    def forward(self, state: torch.Tensor):
        features = self.encoder(state)
        return super().forward(features)
