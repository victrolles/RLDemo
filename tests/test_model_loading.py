import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import torch

from agents.networks import CNNPolicyNetwork
from inference.model_factory import ModelFactory
from inference.schemas import InferenceRequest, ModelSelection


class ImageCheckpointTests(unittest.TestCase):
    def test_raw_and_metadata_image_checkpoints_produce_the_same_action(self):
        actor = CNNPolicyNetwork(num_channels=4, hidden_size=16, num_actions=3).eval()
        state_dict = actor.state_dict()
        wrapped = {
            "env_name": "CarRacing-v3", "algorithm": "sac", "state_size": (4, 84, 84),
            "hidden_size": 16, "action_size": 3, "normalize": True, "reward": 1.0,
            "model_state_dict": state_dict,
        }
        with tempfile.TemporaryDirectory() as temporary, patch("inference.catalog.MODELS_ROOT", Path(temporary)):
            directory = Path(temporary) / "CarRacing-v3" / "sac"
            directory.mkdir(parents=True)
            torch.save(state_dict, directory / "raw.pt")
            torch.save(wrapped, directory / "wrapped.pt")
            outputs = []
            observation = np.zeros((4, 84, 84), dtype=np.uint8)
            for name in ["raw.pt", "wrapped.pt"]:
                request = InferenceRequest("CarRacing-v3", "sac", ModelSelection.CUSTOM, name)
                factory = ModelFactory(request, torch.device("cpu"))
                self.assertTrue(factory.normalize)
                action = factory.get_policy().predict(observation)
                self.assertEqual(action.shape, (3,))
                self.assertTrue(np.isfinite(action).all())
                outputs.append(action)
            np.testing.assert_allclose(outputs[0], outputs[1])


if __name__ == "__main__":
    unittest.main()
