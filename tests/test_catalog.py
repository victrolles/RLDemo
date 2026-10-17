import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from inference.catalog import available_selections, list_models, resolve_model_path, validate_request
from inference.schemas import InferenceRequest, ModelSelection


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        patcher = patch("inference.catalog.MODELS_ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.models = self.root / "Pendulum-v1" / "sac"
        self.models.mkdir(parents=True)
        for name in ["best_model.pt", "worst_model.pt", "checkpoint.pt", "notes.txt"]:
            (self.models / name).touch()
        (self.models / "directory.pt").mkdir()

    def test_lists_only_checkpoint_files(self):
        self.assertEqual(list_models("Pendulum-v1", "sac"), ["best_model.pt", "checkpoint.pt", "worst_model.pt"])

    def test_missing_checkpoints_allow_only_random_actions(self):
        self.assertEqual(available_selections(list_models("CartPole-v1", "dqn")), ["random_actions"])
        validate_request(InferenceRequest("CartPole-v1", "dqn", ModelSelection.RANDOM_ACTIONS))
        with self.assertRaises(ValueError):
            validate_request(InferenceRequest("CartPole-v1", "dqn", ModelSelection.BEST))

    def test_custom_checkpoint_is_resolved_inside_model_directory(self):
        request = InferenceRequest("Pendulum-v1", "sac", ModelSelection.CUSTOM, "checkpoint.pt")
        self.assertEqual(resolve_model_path(request), self.models / "checkpoint.pt")

    def test_rejects_unsupported_algorithms_and_path_traversal(self):
        for env_name, algorithm in [("../Pendulum-v1", "sac"), ("Pendulum-v1", "../sac"), ("Pendulum-v1", "dqn")]:
            with self.assertRaises(ValueError):
                list_models(env_name, algorithm)
        for name in ["../checkpoint.pt", "C:/checkpoint.pt", "missing.pt"]:
            with self.assertRaises(ValueError):
                resolve_model_path(InferenceRequest("Pendulum-v1", "sac", ModelSelection.CUSTOM, name))

    def test_default_request_has_optional_seed(self):
        self.assertIsNone(InferenceRequest("Pendulum-v1", "sac", ModelSelection.BEST).seed)


if __name__ == "__main__":
    unittest.main()
