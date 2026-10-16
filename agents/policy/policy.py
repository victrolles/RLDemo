from abc import ABC, abstractmethod

import torch
import numpy as np

class Policy(ABC):
    def __init__(self, model: torch.nn.Module, device: torch.device):
        self.model = model
        self.device = device

    @abstractmethod
    def predict(
        self,
        observation: np.ndarray,
        deterministic: bool = True
    ) -> np.ndarray | int:
        pass