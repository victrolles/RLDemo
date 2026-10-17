import base64
import json
import unittest

import cv2
import numpy as np
import torch

from agents.networks import CNNPolicyNetwork, DQN, PolicyNetwork
from agents.policy import DQNPolicy, SACPolicy
from inference.network_inspector import NetworkInspector


class NetworkInspectorTests(unittest.TestCase):
    def verify_output_sum(self, definition, snapshot):
        values = np.asarray(snapshot["activations"][definition["output_source"]])
        weights = np.asarray(definition["output_weights"])
        bias = np.asarray(definition["output_bias"])
        np.testing.assert_allclose(weights @ values + bias, snapshot["output"]["raw"], atol=0.00002)
        json.dumps({"definition": definition, "snapshot": snapshot}, allow_nan=False)

    def test_dqn_captures_same_forward_pass_without_changing_action(self):
        torch.manual_seed(1)
        model = DQN(4, 8, 2).eval()
        policy = DQNPolicy(model, torch.device("cpu"))
        observation = np.array([0.1, -0.2, 0.3, -0.4], dtype=np.float32)
        expected = policy.predict(observation)
        inspector = NetworkInspector(model, "dqn", "CartPole-v1")
        self.addCleanup(inspector.close)
        calls = []
        handle = model.register_forward_hook(lambda *_: calls.append(1))
        inspector.begin()
        action = policy.predict(observation)
        handle.remove()
        snapshot = inspector.snapshot(observation, action)
        self.assertEqual(len(calls), 1)
        self.assertEqual(action, expected)
        self.assertEqual(snapshot["output"]["rule"], "argmax")
        self.assertEqual(action, int(np.argmax(snapshot["output"]["raw"])))
        np.testing.assert_allclose(snapshot["input"]["values"], observation, atol=0.000001)
        self.verify_output_sum(inspector.definition, snapshot)
        inspector.close()
        self.assertTrue(all(not module._forward_hooks for module in model.modules()))

    def test_sac_output_is_tanh_of_actual_mean_and_weights_stay_fixed(self):
        torch.manual_seed(2)
        model = PolicyNetwork(3, 8, 1).eval()
        policy = SACPolicy(model, torch.device("cpu"))
        observation = np.array([0.5, -0.5, 1.5], dtype=np.float32)
        expected = policy.predict(observation)
        inspector = NetworkInspector(model, "sac", "Pendulum-v1")
        self.addCleanup(inspector.close)
        definition = json.dumps(inspector.definition)
        inspector.begin()
        action = policy.predict(observation)
        snapshot = inspector.snapshot(observation, action)
        np.testing.assert_array_equal(action, expected)
        np.testing.assert_allclose(np.tanh(snapshot["output"]["raw"]), action, atol=0.000001)
        self.assertEqual(snapshot["input"]["labels"], ["cos θ", "sin θ", "Angular velocity"])
        self.verify_output_sum(inspector.definition, snapshot)
        inspector.begin()
        another_action = policy.predict(-observation)
        another = inspector.snapshot(-observation, another_action)
        self.assertNotEqual(snapshot["activations"], another["activations"])
        self.assertEqual(json.dumps(inspector.definition), definition)

    def test_cnn_input_strip_and_channel_summaries_match_real_input(self):
        torch.manual_seed(3)
        model = CNNPolicyNetwork(4, 16, 3).eval()
        policy = SACPolicy(model, torch.device("cpu"))
        observation = np.stack([np.full((84, 84), value, dtype=np.uint8) for value in [0, 64, 128, 255]])
        expected = policy.predict(observation)
        inspector = NetworkInspector(model, "sac", "CarRacing-v3")
        self.addCleanup(inspector.close)
        inspector.begin()
        action = policy.predict(observation)
        snapshot = inspector.snapshot(observation, action)
        np.testing.assert_array_equal(action, expected)
        self.assertEqual(snapshot["input"]["shape"], [4, 84, 84])
        encoded = base64.b64decode(snapshot["input"]["image"].split(",", 1)[1])
        strip = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
        np.testing.assert_array_equal(strip, np.concatenate(list(observation), axis=1))
        for layer in inspector.definition["layers"]:
            self.assertEqual(len(snapshot["activations"][layer["id"]]), layer["units"])
        self.assertEqual(len(snapshot["activations"]["conv1"]), 32)
        self.assertEqual(len(snapshot["activations"]["conv3"]), 64)
        self.assertTrue(any(edge["aggregate"] for edge in inspector.definition["edges"]))
        self.verify_output_sum(inspector.definition, snapshot)


if __name__ == "__main__":
    unittest.main()
