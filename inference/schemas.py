from dataclasses import dataclass
from enum import Enum

import numpy as np

class ModelSelection(str, Enum):
    BEST = "best"
    WORST = "worst"
    RANDOM = "random"
    CUSTOM = "custom"
    RANDOM_ACTIONS = "random_actions"


@dataclass
class InferenceRequest:
    """Configuration for an inference request."""

    env_name: str
    algorithm: str
    model_selection: ModelSelection
    model_name: str | None = None
    seed: int | None = None

    def __post_init__(self) -> None:
        if self.model_selection == ModelSelection.CUSTOM:
            if not self.model_name:
                raise ValueError(
                    "model_name is required when model_selection is CUSTOM."
                )
        elif self.model_name is not None:
            raise ValueError(
                "model_name must be None unless model_selection is CUSTOM."
            )

@dataclass
class InferenceResponse:
    """Represents the response from an inference request."""
    frame: np.ndarray
    step: int
    reward: float
    total_reward: float
    terminated: bool
    truncated: bool