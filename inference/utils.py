import os
import random

def get_random_model(model_directory: str) -> str:
    """
    Selects a random model from the specified directory.

    Args:
        model_directory (str): The directory containing the models.
        Returns:
        str: The name of the randomly selected model.
    """
    # List all files in the model directory
    model_files = [f for f in os.listdir(model_directory) if os.path.isfile(os.path.join(model_directory, f))]

    if not model_files:
        raise ValueError(f"No models found in directory: {model_directory}")

    # Randomly select a model file
    selected_model = random.choice(model_files)
    return f"{model_directory}/{selected_model}"