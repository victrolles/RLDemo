import torch
import numpy as np
from torch.distributions import Normal

from agents.policy.policy import Policy


class SACPolicy(Policy):
    @torch.inference_mode()
    def predict(
        self,
        observation: np.ndarray,
        deterministic: bool = True
    ) -> np.ndarray:

        state = torch.as_tensor(
            observation,
            dtype=torch.float32,
            device=self.device
        ).unsqueeze(0)

        mean, log_std = self.model(state)

        if deterministic:
            action = torch.tanh(mean)
        else:
            std = log_std.exp()
            distribution = Normal(mean, std)
            action = torch.tanh(distribution.sample())

        return action.squeeze(0).cpu().numpy()