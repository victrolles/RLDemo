# Live inference API

Run FastAPI from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server.app:app --reload --host 127.0.0.1 --port 8000
```

Run the React frontend in a separate terminal:

```powershell
cd frontend
npm run dev
```

## Discovery

- `GET /health`: server status.
- `GET /environments`: supported games and the algorithms available for each.
- `GET /models?env_name=Pendulum-v1&algorithm=sac`: checkpoint names and supported selection modes for this pair. Discovery reads filenames, without deserializing weights.

Checkpoint directories are resolved relative to the repository, independently of the process working directory. Add `.pt` files to `models/<environment>/<algorithm>/` and refresh the list in the interface. Unsupported environment/algorithm pairs return HTTP 422. Checkpoint names are restricted to files discovered in the selected directory.

Selections:

| Value | Behavior |
| --- | --- |
| `best` | Loads `best_model.pt`, when present. |
| `worst` | Loads `worst_model.pt`, when present. |
| `random` | Chooses a saved `.pt` checkpoint. |
| `custom` | Loads the specified `model_name` from the discovered list. |
| `random_actions` | Samples random actions without loading a model. |

The current checkout includes Pendulum and CarRacing checkpoints. CartPole and BipedalWalker can be explored with random actions until checkpoints are added.

## WebSocket protocol

Connect to `/inference`, then send one request:

```json
{
  "env_name": "Pendulum-v1",
  "algorithm": "sac",
  "model_selection": "custom",
  "model_name": "model_v1.pt"
}
```

Only include `model_name` for the `custom` selection. Optional `seed` defaults to `null`.

The server responds with a `started` message, then pairs of messages:

1. JSON metadata: `type: "step"`, `step`, `reward`, `total_reward`, `terminated`, `truncated`.
2. Binary JPEG for that step.

Rendering is paced at the environment's display rate, capped at 60 FPS. A bounded queue can drop old frames for a slow consumer; `step` and `total_reward` always refer to the actual environment, rather than the number of displayed frames.

The client sends `{"type":"heartbeat"}` every five seconds. Send `{"type":"stop"}` to interrupt a run. The server ends with `finished` or `stopped`, then closes the socket. Failures send `{"type":"error","message":"..."}` when possible. Busy sessions close with code 1013; invalid requests use 1008; runtime failures use 1011. The inference lock stays held until the worker has stopped and the environment is closed.

The React client decodes JPEGs into a canvas, pairs metadata with the corresponding frame, and discards frames from old sessions. It preserves the final frame and reward after completion or stop, and resets them when the configuration changes.

## Checkpoint compatibility

The standard format includes `env_name`, `algorithm`, `state_size`, `action_size`, `hidden_size`, `normalize`, `reward`, and `model_state_dict`. Image actors use the first dimension of `state_size` as their channel count.

The existing CarRacing SAC exports contain only actor weights. They are also supported, using the channel count, hidden size, and action count from the tensors. Their preprocessing matches the training configuration: grayscale 84×84, four stacked frames, normalized actions. Model files are loaded with `weights_only=True`.

## Verification

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_catalog.py -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_model_loading.py -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_api.py -v
```

The API tests start an isolated local server and exercise actual rendered episodes, custom checkpoints, stopping, completion, busy handling, and invalid model selection. Checkpoint-specific tests skip when the required model files are absent.

Build the frontend with `npm run build` from `frontend/`.
