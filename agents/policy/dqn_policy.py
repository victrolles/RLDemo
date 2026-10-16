import torch
import numpy as np

from agents.policy.policy import Policy

class DQNPolicy(Policy):
    @torch.inference_mode()
    def predict(
        self,
        observation: np.ndarray,
        deterministic: bool = True
    ) -> int:

        state = torch.as_tensor(
            observation,
            dtype=torch.float32,
            device=self.device
        ).unsqueeze(0)

        q_values = self.model(state)

        if deterministic:
            action = q_values.argmax(dim=-1)
        else:
            probabilities = torch.softmax(q_values, dim=-1)
            action = torch.multinomial(probabilities, num_samples=1)

        return int(action.item())