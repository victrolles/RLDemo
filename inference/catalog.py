"""Supported environments and checkpoint discovery without loading model weights."""

import random
from pathlib import Path

from inference.schemas import InferenceRequest, ModelSelection


MODELS_ROOT = Path(__file__).resolve().parents[1] / "models"
ENVIRONMENTS = {
    "CartPole-v1": {"label": "CartPole", "algorithms": ["dqn"]},
    "Pendulum-v1": {"label": "Pendulum", "algorithms": ["sac"]},
    "BipedalWalker-v3": {"label": "BipedalWalker", "algorithms": ["sac"]},
    "CarRacing-v3": {"label": "CarRacing", "algorithms": ["sac"]},
}


def model_directory(env_name: str, algorithm: str) -> Path:
    environment = ENVIRONMENTS.get(env_name)
    if environment is None or algorithm not in environment["algorithms"]:
        raise ValueError("This environment and algorithm combination is not supported.")
    directory = (MODELS_ROOT / env_name / algorithm).resolve()
    if not directory.is_relative_to(MODELS_ROOT.resolve()):
        raise ValueError("Invalid checkpoint directory.")
    return directory


def list_models(env_name: str, algorithm: str) -> list[str]:
    directory = model_directory(env_name, algorithm)
    if not directory.is_dir():
        return []
    return sorted(
        path.name for path in directory.glob("*.pt")
        if path.is_file() and path.resolve().is_relative_to(directory)
    )


def available_selections(models: list[str]) -> list[str]:
    selections = []
    if "best_model.pt" in models:
        selections.append("best")
    if "worst_model.pt" in models:
        selections.append("worst")
    if models:
        selections.extend(["random", "custom"])
    selections.append("random_actions")
    return selections


def validate_request(request: InferenceRequest) -> None:
    models = list_models(request.env_name, request.algorithm)
    if request.model_selection not in available_selections(models):
        raise ValueError("This model selection is unavailable for the selected game.")
    if request.model_selection == ModelSelection.CUSTOM and request.model_name not in models:
        raise ValueError("The selected checkpoint is unavailable. Refresh the model list.")


def resolve_model_path(request: InferenceRequest) -> Path:
    validate_request(request)
    directory = model_directory(request.env_name, request.algorithm)
    if request.model_selection == ModelSelection.BEST:
        name = "best_model.pt"
    elif request.model_selection == ModelSelection.WORST:
        name = "worst_model.pt"
    elif request.model_selection == ModelSelection.RANDOM:
        name = random.choice(list_models(request.env_name, request.algorithm))
    elif request.model_selection == ModelSelection.CUSTOM:
        name = request.model_name
    else:
        raise ValueError("Random actions do not use a checkpoint.")
    return directory / name
