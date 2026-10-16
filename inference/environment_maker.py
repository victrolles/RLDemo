import gymnasium as gym
from gymnasium.wrappers import (
    RescaleAction,
    GrayscaleObservation,
    ResizeObservation,
    FrameStackObservation,
)


class EnvironmentMaker:
    def __init__(self,
                 env_name: str = "Pendulum-v1",
                 random_actions: bool = False,
                 normalize: bool = False):

        self.env = gym.make(
            env_name,
            render_mode="rgb_array"
        )
        
        if not random_actions:
            # Preprocessing for image observations
            if env_name == "CarRacing-v3":
                self.env = GrayscaleObservation(self.env, keep_dim=False)
                self.env = ResizeObservation(self.env, shape=(84, 84))
                self.env = FrameStackObservation(self.env, stack_size=4)

            # Normalize actions to [-1, 1]
            if normalize:
                self.env = RescaleAction(
                    self.env,
                    min_action=-1.0,
                    max_action=1.0
                )

    def get_env(self):
        return self.env

