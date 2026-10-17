"""Small, replayable snapshots of the actual policy forward pass.

Weights describe local connections, not causal feature importance. CNN channels
are summarized spatially; final dense output contributions remain exact.
"""

import base64

import cv2
import numpy as np
import torch

from agents.networks import CNNPolicyNetwork


def numbers(values, decimals=6):
    array = np.asarray(values, dtype=np.float64)
    return np.round(np.nan_to_num(array, nan=0, posinf=0, neginf=0), decimals).tolist()


class NetworkInspector:
    def __init__(self, model, algorithm: str, env_name: str):
        self.model = model
        self.algorithm = algorithm
        self.env_name = env_name
        self.is_image = isinstance(model, CNNPolicyNetwork)
        self.handles = []
        self.activations = {}
        self.layers = []
        self.transitions = []

        if self.is_image:
            encoder = model.encoder.network
            self._layer("input", "Input", "input", encoder[0].in_channels)
            previous = "input"
            for index, position in enumerate([0, 2, 4], start=1):
                name = f"conv{index}"
                self._layer(name, f"Conv {index}", "conv", encoder[position].out_channels, encoder[position + 1])
                self._connection(previous, name, encoder[position].weight, aggregate=True)
                previous = name
            self._layer("features", "Features", "dense", encoder[7].out_features, encoder[8])
            self._connection(previous, "features", encoder[7].weight, aggregate=True)
            previous = "features"
        else:
            first = model.fully_connected_layers[0] if algorithm == "dqn" else model.backbone[0]
            self._layer("input", "Input", "input", first.in_features)
            previous = "input"

        backbone = model.fully_connected_layers if algorithm == "dqn" else model.backbone
        for index, position in enumerate([0, 2], start=1):
            name = f"hidden{index}"
            self._layer(name, f"Hidden {index}", "dense", backbone[position].out_features, backbone[position + 1])
            self._connection(previous, name, backbone[position].weight)
            previous = name

        head = backbone[4] if algorithm == "dqn" else model.mean_head
        self._layer("output", "Q values" if algorithm == "dqn" else "Mean", "output", head.out_features, head)
        self._connection(previous, "output", head.weight)
        self.definition = self._definition(head, previous)

    def _layer(self, name, label, kind, units, module=None):
        self.layers.append({"id": name, "label": label, "kind": kind, "units": units})
        if module is not None:
            def capture(_module, _inputs, output):
                tensor = output.detach()[0]
                if tensor.ndim > 1:
                    tensor = tensor.mean(dim=tuple(range(1, tensor.ndim)))
                self.activations[name] = numbers(tensor.float().cpu().numpy())
            self.handles.append(module.register_forward_hook(capture))

    def _connection(self, source, target, weight, aggregate=False):
        array = weight.detach().float().cpu().numpy()
        source_units = next(layer["units"] for layer in self.layers if layer["id"] == source)
        if array.ndim > 2:
            grouped = array.reshape(array.shape[0], array.shape[1], -1)
        elif array.shape[1] != source_units:
            grouped = array.reshape(array.shape[0], source_units, -1)
        else:
            grouped = array[:, :, None]
        signed = grouped.mean(axis=2)
        strength = np.abs(grouped).mean(axis=2)
        self.transitions.append((source, target, signed, strength, aggregate))

    def _definition(self, head, output_source):
        layers = []
        for layer in self.layers:
            outgoing = next((item[3].mean(axis=0) for item in self.transitions if item[0] == layer["id"]), np.zeros(layer["units"]))
            layers.append({**layer,
                "display_indices": np.linspace(0, layer["units"] - 1, min(6, layer["units"]), dtype=int).tolist(),
                "outgoing_strength": numbers(outgoing),
            })
        edges = []
        for source, target, signed, strength, aggregate in self.transitions:
            start = next(layer for layer in layers if layer["id"] == source)
            end = next(layer for layer in layers if layer["id"] == target)
            scale = float(strength.max()) or 1.0
            for source_index in start["display_indices"]:
                for target_index in end["display_indices"]:
                    edges.append({"source": source, "target": target,
                        "source_index": source_index, "target_index": target_index,
                        "weight": round(float(signed[target_index, source_index]), 7),
                        "strength": round(float(strength[target_index, source_index]) / scale, 5),
                        "aggregate": aggregate,
                    })
        return {
            "algorithm": self.algorithm,
            "architecture": "CNN actor" if self.is_image else "MLP Q-network" if self.algorithm == "dqn" else "MLP actor",
            "parameter_count": sum(parameter.numel() for parameter in self.model.parameters()),
            "layers": layers, "edges": edges,
            "output_source": output_source,
            "output_weights": numbers(head.weight.detach().float().cpu().numpy(), 7),
            "output_bias": numbers(head.bias.detach().float().cpu().numpy(), 7),
        }

    def begin(self):
        self.activations = {}

    def snapshot(self, observation, action):
        array = np.asarray(observation, dtype=np.float32)
        if self.is_image:
            # The four exact preprocessed input frames, oldest to newest.
            strip = np.concatenate([np.clip(channel, 0, 255).astype(np.uint8) for channel in array], axis=1)
            success, encoded = cv2.imencode(".png", strip)
            if not success:
                raise RuntimeError("Could not encode the network input")
            input_data = {"kind": "image", "shape": list(array.shape),
                "image": "data:image/png;base64," + base64.b64encode(encoded).decode("ascii"),
            }
            inputs = numbers(array.mean(axis=(1, 2)) / 255.0)
        else:
            inputs = numbers(array.reshape(-1))
            labels = {
                "Pendulum-v1": ["cos θ", "sin θ", "Angular velocity"],
                "CartPole-v1": ["Cart position", "Cart velocity", "Pole angle", "Angular velocity"],
            }.get(self.env_name, [f"Observation {index}" for index in range(len(inputs))])
            input_data = {"kind": "vector", "shape": list(array.shape), "values": inputs, "labels": labels}
        return {
            "input": input_data,
            "activations": {"input": inputs, **self.activations},
            "output": {"rule": "argmax" if self.algorithm == "dqn" else "tanh",
                "raw": self.activations["output"], "action": np.asarray(action).tolist()},
        }

    def close(self):
        for handle in self.handles:
            handle.remove()
        self.handles.clear()
