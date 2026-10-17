import threading
from typing import Iterator

import torch

from inference.environment_maker import EnvironmentMaker
from inference.model_factory import ModelFactory
from inference.schemas import (
    InferenceRequest,
    InferenceResponse,
    ModelSelection,
)

class InferenceRunner:
    def __init__(self, config: InferenceRequest):
        self.config = config

        if self.config.model_selection == ModelSelection.RANDOM_ACTIONS:
            # No model is needed for random actions, so we set policy to None
            self.policy = None

            # Create the environment with random actions
            environment_maker = EnvironmentMaker(
                env_name=config.env_name,
                random_actions=True
            )
        else:

            # Device
            if torch.cuda.is_available():
                self.device = torch.device("cuda")
            else:
                self.device = torch.device("cpu")

            # Load the model and policy
            model_factory = ModelFactory(config, self.device)
            self.policy = model_factory.get_policy()

            # Create the environment
            environment_maker = EnvironmentMaker(
                env_name=config.env_name,
                normalize=model_factory.normalize
            )
        
        self.env = environment_maker.get_env()

    def run(
        self,
        stop_event: threading.Event | None = None,
        max_steps: int = 3000
    ) -> Iterator[InferenceResponse]:

        try:
            obs, _ = self.env.reset(seed=self.config.seed)
            total_reward = 0.0

            for step in range(1, max_steps + 1):
                # Interrupt the loop if the user is disconnected or switches to another inference session
                if stop_event is not None and stop_event.is_set():
                    break

                if self.policy is None:
                    action = self.env.action_space.sample()
                else:
                    action = self.policy.predict(obs)

                obs, reward, terminated, truncated, _ = self.env.step(action)
                total_reward += float(reward)

                frame = self.env.render()

                yield InferenceResponse(
                    frame=frame,
                    step=step,
                    reward=reward,
                    total_reward=total_reward,
                    terminated=terminated,
                    truncated=truncated
                )

                if terminated or truncated:
                    break
        finally:
            self.env.close()