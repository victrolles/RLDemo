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

1. JSON metadata: `type: "step"`, `step`, `action`, `reward`, `total_reward`, `terminated`, `truncated`.
2. Binary JPEG for that step.

`action` is the policy output used to produce this step's frame: a JSON integer for discrete actions or a list of numbers for continuous actions. It is copied before `env.step`, so it represents the action before any environment wrapper rescaling. Random-action baselines use the same format.

Rendering is paced at the environment's display rate, capped at 60 FPS. A bounded queue applies backpressure to a slow consumer instead of dropping steps, preserving an ordered history for replay. Stopping or disconnecting also cancels a producer waiting on that queue.

The client sends `{"type":"heartbeat"}` every five seconds. Send `{"type":"stop"}` to interrupt a run. The server ends with `finished` or `stopped`, then closes the socket. Failures send `{"type":"error","message":"..."}` when possible. Busy sessions close with code 1013; invalid requests use 1008; runtime failures use 1011. The inference lock stays held until the worker has stopped and the environment is closed.

The React client decodes JPEGs into a canvas and pairs metadata with the corresponding frame. It preserves the final frame and reward after completion or stop.

## Episode replay

While inference runs, the browser keeps the compressed JPEG and its metadata for each received step. Replay becomes available after completion, manual stop, or a connection error with previously received frames. Use the left/right arrow keys, previous/next buttons, or the timeline slider to navigate. "Last frame" returns to the final recorded step.

Each selection updates the canvas, step number, action, per-step reward, total return, and terminated/truncated flags together. Actions explain the transition into the displayed frame. Discrete CartPole actions also show their left/right meaning. Arrow shortcuts leave editable fields and native select/slider navigation alone. Rapid seeks discard obsolete asynchronous image decodes.

History belongs to the current episode and stays in browser memory. It is released when a new run starts, setup changes, or the page is left/refreshed. JPEGs are decoded on demand rather than retaining a decoded bitmap for every step. The current runner limits episodes to 3,000 steps. A stopped episode's history is the received prefix of that run.

The neural-network visualization is a separate future step; this change records action outputs without capturing network weights, activations, or observations.

## Checkpoint compatibility

The standard format includes `env_name`, `algorithm`, `state_size`, `action_size`, `hidden_size`, `normalize`, `reward`, and `model_state_dict`. Image actors use the first dimension of `state_size` as their channel count.

The existing CarRacing SAC exports contain only actor weights. They are also supported, using the channel count, hidden size, and action count from the tensors. Their preprocessing matches the training configuration: grayscale 84×84, four stacked frames, normalized actions. Model files are loaded with `weights_only=True`.

## Verification

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_catalog.py -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_model_loading.py -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_api.py -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_session_history.py -v
```

The API tests start an isolated local server and exercise actual rendered episodes, discrete/continuous action serialization, complete step histories, custom checkpoints, stopping, completion, busy handling, and invalid model selection. Session tests cover a slow consumer and cancellation while the producer is waiting on a full queue. Checkpoint-specific tests skip when the required model files are absent.

Build the frontend with `npm run build` from `frontend/`.
