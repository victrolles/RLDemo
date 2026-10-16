import torch
import torch.nn as nn

from agents.networks import DQN, PolicyNetwork, CNNPolicyNetwork
from agents.policy import Policy, DQNPolicy, SACPolicy
from inference.schemas import InferenceRequest, ModelSelection
from inference.utils import get_random_model


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

    def _load_config(self, models_path: str = "models"):

        model_directory = f"{models_path}/{self.inference_request.env_name}/{self.inference_request.algorithm}"

        if self.inference_request.model_selection == ModelSelection.BEST:
            model_path = f"{model_directory}/best_model.pt"
        elif self.inference_request.model_selection == ModelSelection.WORST:
            model_path = f"{model_directory}/worst_model.pt"
        elif self.inference_request.model_selection == ModelSelection.RANDOM:
            model_path = get_random_model(model_directory)
        elif self.inference_request.model_selection == ModelSelection.CUSTOM:
            model_path = f"{model_directory}/{self.inference_request.model_name}"
        else:
            raise ValueError(
                f"Invalid model_selection: {self.inference_request.model_selection}"
            )

        model_data = torch.load(
            model_path,
            map_location=self.device,
            weights_only=True
        )

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
            is_image = isinstance(self.state_size, tuple)

            if is_image:
                actor_class = CNNPolicyNetwork
            else:
                actor_class = PolicyNetwork

            # Actor
            model = actor_class(
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