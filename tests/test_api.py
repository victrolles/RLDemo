"""Integration tests against a local FastAPI server, including real rendered frames.

Run from the repository root: python -m unittest discover -s tests -p "test_api.py"
"""

import json
import socket
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

import cv2
import numpy as np
import uvicorn
from websockets.sync.client import connect

from server.app import app


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.listener = socket.socket()
        cls.listener.bind(("127.0.0.1", 0))
        cls.port = cls.listener.getsockname()[1]
        cls.http = f"http://127.0.0.1:{cls.port}"
        cls.ws = f"ws://127.0.0.1:{cls.port}/inference"
        cls.server = uvicorn.Server(uvicorn.Config(app, log_level="warning"))
        cls.thread = threading.Thread(target=cls.server.run, kwargs={"sockets": [cls.listener]}, daemon=True)
        cls.thread.start()
        for _ in range(100):
            if cls.server.started:
                return
            time.sleep(0.1)
        raise RuntimeError("Test server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(timeout=10)
        cls.listener.close()

    def get_json(self, path):
        with urlopen(self.http + path, timeout=5) as response:
            return json.load(response)

    def start_session(self, ws, **overrides):
        request = {"env_name": "Pendulum-v1", "algorithm": "sac", "model_selection": "random_actions", "seed": 42}
        request.update(overrides)
        ws.send(json.dumps(request))
        self.assertEqual(json.loads(ws.recv(timeout=10))["type"], "started")

    def receive_step(self, ws):
        metadata = json.loads(ws.recv(timeout=15))
        self.assertEqual(metadata["type"], "step", metadata)
        frame = ws.recv(timeout=5)
        self.assertIsInstance(frame, bytes)
        image = cv2.imdecode(np.frombuffer(frame, dtype=np.uint8), cv2.IMREAD_COLOR)
        self.assertIsNotNone(image)
        self.assertGreater(image.shape[0], 0)
        return metadata

    def stop_session(self, ws):
        ws.send(json.dumps({"type": "stop"}))
        for _ in range(100):
            message = ws.recv(timeout=10)
            if isinstance(message, str) and json.loads(message)["type"] == "stopped":
                return
        self.fail("Server did not confirm stop")

    def test_catalog_and_invalid_environment(self):
        self.assertEqual(len(self.get_json("/environments")["environments"]), 4)
        catalog = self.get_json("/models?env_name=Pendulum-v1&algorithm=sac")
        self.assertIn("random_actions", catalog["selections"])
        self.assertTrue(all(item["name"].endswith(".pt") for item in catalog["models"]))
        with self.assertRaises(HTTPError) as error:
            self.get_json("/models?env_name=Pendulum-v1&algorithm=dqn")
        self.assertEqual(error.exception.code, 422)

    def test_custom_model_renders_and_stops(self):
        catalog = self.get_json("/models?env_name=Pendulum-v1&algorithm=sac")
        if not catalog["models"]:
            self.skipTest("No Pendulum checkpoint installed")
        with connect(self.ws) as ws:
            self.start_session(ws, model_selection="custom", model_name=catalog["models"][0]["name"])
            step = self.receive_step(ws)
            self.assertGreater(step["step"], 0)
            self.assertIsInstance(step["reward"], float)
            self.assertEqual(len(step["action"]), 1)
            ws.send(json.dumps({"type": "heartbeat"}))
            self.stop_session(ws)

    def test_carracing_actor_checkpoint_renders(self):
        catalog = self.get_json("/models?env_name=CarRacing-v3&algorithm=sac")
        if not catalog["models"]:
            self.skipTest("No CarRacing checkpoint installed")
        with connect(self.ws) as ws:
            self.start_session(ws, env_name="CarRacing-v3", model_selection="custom", model_name=catalog["models"][0]["name"])
            step = self.receive_step(ws)
            self.assertEqual(len(step["action"]), 3)
            self.stop_session(ws)

    def test_discrete_actions_are_json_integers(self):
        with connect(self.ws) as ws:
            self.start_session(ws, env_name="CartPole-v1", algorithm="dqn")
            step = self.receive_step(ws)
            self.assertIsInstance(step["action"], int)
            self.assertIn(step["action"], [0, 1])
            self.stop_session(ws)

    def test_completed_episode_sends_final_metrics_and_finished(self):
        with connect(self.ws) as ws:
            self.start_session(ws)
            started_at = time.monotonic()
            previous = 0
            total = 0
            while True:
                message = json.loads(ws.recv(timeout=15))
                if message["type"] == "finished":
                    break
                self.assertEqual(message["type"], "step", message)
                self.assertEqual(message["step"], previous + 1)
                self.assertAlmostEqual(message["total_reward"], total + message["reward"])
                self.assertEqual(len(message["action"]), 1)
                total = message["total_reward"]
                self.assertIsInstance(ws.recv(timeout=5), bytes)
                previous = message["step"]
                final = message
            self.assertEqual(previous, 200)
            self.assertTrue(final["truncated"])
            self.assertGreater(time.monotonic() - started_at, 4, "Frames should stream at a watchable pace")

    def test_rejects_busy_client_then_accepts_new_session_after_stop(self):
        with connect(self.ws) as first:
            self.start_session(first)
            self.receive_step(first)
            with connect(self.ws) as second:
                second.send(json.dumps({"env_name": "Pendulum-v1", "algorithm": "sac", "model_selection": "random_actions"}))
                message = json.loads(second.recv(timeout=5))
                self.assertEqual(message["type"], "error")
                self.assertIn("busy", message["message"])
            self.stop_session(first)
        with connect(self.ws) as next_session:
            self.start_session(next_session)
            self.receive_step(next_session)
            self.stop_session(next_session)

    def test_rejects_unknown_custom_checkpoint(self):
        with connect(self.ws) as ws:
            ws.send(json.dumps({"env_name": "Pendulum-v1", "algorithm": "sac", "model_selection": "custom", "model_name": "../outside.pt"}))
            message = json.loads(ws.recv(timeout=5))
            self.assertEqual(message["type"], "error")
            self.assertIn("unavailable", message["message"])


if __name__ == "__main__":
    unittest.main()
