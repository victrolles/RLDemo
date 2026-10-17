import torch

from agents.networks import DQN, PolicyNetwork, CNNPolicyNetwork
from agents.policy import Policy, DQNPolicy, SACPolicy
from inference.schemas import InferenceRequest
from inference.catalog import resolve_model_path


class ModelFactory:
    def __init__(self,
                 inference_request: InferenceRequest,
                 device: torch.device):
        self.inference_request = inference_request
        self.device = device

        self._load_config()
        self.model = self._instantiate_model()
        self.model.load_state_dict(self.model_state_dict)
        self.model.to(self.device)
        self.model.eval()  # Set the model to evaluation mode

    def _load_config(self):
        model_path = resolve_model_path(self.inference_request)

        model_data = torch.load(
            model_path,
            map_location=self.device,
            weights_only=True
        )

        # The existing CarRacing exports are actor state dicts without metadata.
        # Their training configuration uses 4x84x84 images and normalized actions.
        if "model_state_dict" not in model_data:
            if (
                self.inference_request.env_name != "CarRacing-v3"
                or self.inference_request.algorithm != "sac"
                or "encoder.network.0.weight" not in model_data
            ):
                raise ValueError("This checkpoint needs environment and network metadata.")
            self.state_size = (model_data["encoder.network.0.weight"].shape[1], 84, 84)
            self.hidden_size = model_data["backbone.0.weight"].shape[0]
            self.action_size = model_data["mean_head.weight"].shape[0]
            self.normalize = True
            self.reward = None
            self.model_state_dict = model_data
            return

        env_name = model_data["env_name"]
        if env_name != self.inference_request.env_name:
            raise ValueError(
                f"Environment name mismatch: {env_name} != {self.inference_request.env_name}"
            )

        algorithm = model_data["algorithm"]
        if algorithm != self.inference_request.algorithm:
            raise ValueError(
                f"Algorithm mismatch: {algorithm} != {self.inference_request.algorithm}"
            )

        self.state_size = model_data["state_size"]
        self.action_size = model_data["action_size"]
        self.hidden_size = model_data["hidden_size"]
        self.normalize = model_data["normalize"]
        self.reward = model_data["reward"]
        self.model_state_dict = model_data["model_state_dict"]

    def _instantiate_model(self):

        if self.inference_request.algorithm == "dqn":
            model = DQN(
                input_size=self.state_size,
                hidden_size=self.hidden_size,
                output_size=self.action_size
            )

        elif self.inference_request.algorithm == "sac":
            # Detect image observations
            is_image = isinstance(self.state_size, (tuple, list))

            if is_image:
                model = CNNPolicyNetwork(
                    num_channels=self.state_size[0],
                    hidden_size=self.hidden_size,
                    num_actions=self.action_size
                )
            else:
                model = PolicyNetwork(
                    num_inputs=self.state_size,
                    hidden_size=self.hidden_size,
                    num_actions=self.action_size
                )

        else:
            raise ValueError(
                f"Unsupported algorithm: {self.inference_request.algorithm}"
            )
        
        return model

    def get_policy(self) -> Policy:

        algorithm = self.inference_request.algorithm

        if algorithm == "dqn":
            return DQNPolicy(self.model, self.device)

        elif algorithm == "sac":
            return SACPolicy(self.model, self.device)

        raise ValueError(f"Unsupported algorithm: {algorithm}")
