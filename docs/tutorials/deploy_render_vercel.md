# Deploy RLDemo publicly with Render and Vercel (without Docker)

This tutorial documents how to publish the [RLDemo](../../README.md) full-stack application without Docker. It reproduces the deployment steps used for this project, including the CORS issue encountered after deployment and its fix.

**Architecture:** Vercel hosts the React/TypeScript frontend, Render runs the FastAPI backend and the PyTorch/Gymnasium inference engine, and GitHub hosts the source code and triggers deployments.

| Part | Hosting | Example / actual deployment |
| --- | --- | --- |
| Frontend | Vercel (static Vite build) | https://rl-demo-delta.vercel.app |
| API + WebSocket | Render (Python Web Service) | https://rldemo-api.onrender.com |
| Inference | Same Render backend process | PyTorch + Gymnasium + model checkpoints |
| Code | GitHub | https://github.com/victrolles/RLDemo |

The URLs above reflect the deployment used while writing this tutorial. If you fork the repository, replace these with your own domains.

## 1. Understand what needs to be deployed

Locally, `npm run dev` launches **two servers** with Concurrently:

- **Vite**, serving the React frontend on `http://localhost:5173`.
- **Uvicorn**, serving FastAPI on `http://127.0.0.1:8000`.

The inference runner is **not a third web server**: the backend imports it and streams real rendered frames and inference metadata over `/inference` (WebSocket). The backend also exposes `/health`, `/environments`, and `/models` over HTTP.

In development, `frontend/vite.config.ts` proxies `/api` to port 8000. That **Vite development proxy does not exist in the Vercel production build**. We instead configure the frontend to connect directly to the public Render URL.

Vercel is best suited to hosting the compiled React frontend here. The existing long-running FastAPI + PyTorch/WebSocket service should run separately on Render rather than trying to deploy the complete application as a Vercel Function.

## 2. Prepare the GitHub repository

The repository includes:

```text
RLDemo/
├── agents/
├── inference/
├── models/
├── server/
│   ├── app.py
│   └── session.py
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
├── requirements.txt
└── README.md
```

### 2.1 Verify Python dependencies

Render creates a **fresh Linux environment**, independent of the local Windows `.venv`. Ensure every dependency is declared in the root `requirements.txt`. The current project uses FastAPI, Uvicorn, PyTorch, Gymnasium with Box2D/classic-control extras, NumPy, Pydantic, OpenCV and WebSockets.

To check installation independently of the existing virtual environment, on Windows with Python 3.13 installed:

```powershell
py -3.13 -m venv .venv-deploy-test
.\.venv-deploy-test\Scripts\python.exe -m pip install -r requirements.txt
.\.venv-deploy-test\Scripts\python.exe -c "import torch, gymnasium, fastapi, cv2; print('OK')"
```

This is a useful preliminary check, but a successful Windows installation does **not** guarantee that all Linux dependencies will install. Always review Render's build logs.

For a server that encodes images but never displays graphical windows, prefer `opencv-python-headless` over `opencv-python` in `requirements.txt`, with a compatible, available version. Do not install both OpenCV variants in the same environment. The current frame encoder uses `cv2.imencode()` and can work with the headless package.

Keep compatible dependency versions pinned and select a matching Python 3.13 runtime in Render. Some packages (especially PyTorch, Box2D, and their binary dependencies) require compatible Python and Linux wheels.

### 2.2 Test the backend before deploying

From the repository root, run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server.app:app --host 127.0.0.1 --port 8000
```

Verify `http://127.0.0.1:8000/health` gives:

```json
{"status":"online"}
```

Stop with **Ctrl+C**. Do not use `--reload` in production. You can still use `npm run dev` for everyday local development.

### 2.3 Commit and push

```powershell
git add .
git commit -m "Prepare RLDemo for deployment"
git push origin main
```

Ensure that credentials, `.venv/`, `node_modules/` and local-only data are excluded from Git. Model checkpoints required by the deployed app must be accessible to the Render service (from the repository or another configured storage location).

## 3. Deploy the FastAPI backend on Render FIRST

1. Open [Render Dashboard](https://dashboard.render.com) and sign in (GitHub login is convenient).
2. Choose **New → Web Service**.
3. Connect GitHub and select `victrolles/RLDemo` (or your fork).
4. Set the deployment options:

| Render setting | Value |
| --- | --- |
| Name | `rldemo-api` (or another available name) |
| Language / Runtime | Python |
| Branch | `main` |
| Root directory | Leave empty (repository root) |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn server.app:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |
| Python version | Pin a supported Python **3.13** version in Render runtime settings |

**Why `0.0.0.0` and `$PORT`?** Render must reach the running service from outside its process; binding only to `127.0.0.1` would not work. `$PORT` is the port supplied by the hosting platform.

5. Start the deployment and inspect **Build** and **Deploy** logs.
6. Once live, Render displays a public `https://...onrender.com` URL.

For the example deployment, the API URL is `https://rldemo-api.onrender.com`.

### 3.1 Test Render independently of React

Open the following URLs in a browser:

```text
https://rldemo-api.onrender.com/health
https://rldemo-api.onrender.com/environments
https://rldemo-api.onrender.com/models?env_name=Pendulum-v1&algorithm=sac
```

Expected:

- `/health` returns `{"status":"online"}`.
- `/environments` returns the supported environments/algorithms.
- `/models` returns available checkpoints and selection modes.

These are **HTTP checks only**. They prove the API is online, not that a PyTorch model can load and stream a full WebSocket episode. Once the frontend is connected, also test actual inference.

### 3.2 Important resource limits

A free backend instance may have very little RAM/CPU and no GPU. Importing PyTorch, starting Gymnasium/Box2D and loading checkpoints may exceed those limits. If `/health` works but inference crashes, inspect logs and measure memory usage before assuming the frontend is broken. Test CartPole and Pendulum before the larger workloads. Paid compute may be required.

Free instances can also **sleep when idle**, causing a cold start. The current frontend connection timeout is 10 seconds: its first attempt after sleeping may fail even though the service eventually wakes up. Retry after the backend responds, increase capacity, or implement explicit waking/retry handling. Check Render's current free-tier limits because provider policies change.

## 4. Deploy the React frontend on Vercel

1. Open [Vercel New Project](https://vercel.com/new) and sign in using GitHub.
2. Import the **same RLDemo repository**.
3. Fill in:

| Vercel setting | Value |
| --- | --- |
| Project name | `rldemo` or another available name |
| Framework preset | **Vite** |
| Root directory | **`frontend`** |
| Build command | `npm run build` |
| Install command | `npm ci` |
| Output directory | `dist` |

The `frontend` root is crucial: this monorepo's React `package.json` and lockfile are **inside that directory**.

Before deploying you can test the production build locally:

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
```

### 4.1 Set the production API URL

Under the Vercel project's **Environment Variables**, add:

| Key | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://rldemo-api.onrender.com` |

Use your **actual** Render URL, with no trailing slash and **no `/api` suffix**. Set it for the Production environment (and configure preview environments separately as needed).

The existing `frontend/src/lib/api.ts` already supports this:

```ts
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export function inferenceUrl() {
  const url = new URL(`${base}/inference`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
```

`VITE_API_BASE_URL` is embedded **at build time**, so changing it requires a **new Vercel deployment**. Do not place secrets in `VITE_*` variables: they are visible in the browser's JavaScript.

### 4.2 Deploy and verify the site URL

Click **Deploy**. When the build completes, Vercel provides a public `https://...vercel.app` address.

The deployment used here is:

```text
https://rl-demo-delta.vercel.app
https://rl-demo-delta.vercel.app/#/inference/
```

The existing React application uses `HashRouter`, so the `#/inference/` route works on static hosting without any special Vercel rewrite configuration. Switching to `BrowserRouter` later would require SPA rewrites.

## 5. Configure CORS on Render (essential!)

After the first deployment, the frontend was served from:

```text
https://rl-demo-delta.vercel.app
```

But API requests went to:

```text
https://rldemo-api.onrender.com
```

The browser initially reported:

```text
Access to fetch at 'https://rldemo-api.onrender.com/environments'
from origin 'https://rl-demo-delta.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

It reported the same error for `/models`, even though opening `/health` and `/environments` directly in a browser succeeded.

**Explanation:** Direct page navigation does not impose the same JavaScript cross-origin access restriction as `fetch()`. The FastAPI server was operational; it simply had not authorized the *exact* Vercel frontend origin.

### 5.1 Set the environment variable

Go to **Render → your Web Service → Environment**, and configure:

```text
RL_CORS_ORIGINS=https://rl-demo-delta.vercel.app
```

No trailing `/`. To allow both local development and the public frontend:

```text
RL_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://rl-demo-delta.vercel.app
```

The existing `server/app.py` reads that variable:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "RL_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

**Save and redeploy/restart Render** so the new environment value is loaded. No React code change and no Vercel redeploy are needed for this particular fix.

### 5.2 Verify the returned CORS header

From PowerShell:

```powershell
curl.exe -i `
  -H "Origin: https://rl-demo-delta.vercel.app" `
  https://rldemo-api.onrender.com/environments
```

The response should include:

```http
access-control-allow-origin: https://rl-demo-delta.vercel.app
```

Then refresh the Vercel application with **Ctrl+Shift+R**. Environment and checkpoint discovery should work.

### 5.3 WebSockets are separate from HTTP CORS

Live inference connects to:

```text
wss://rldemo-api.onrender.com/inference
```

The browser uses **WSS** because the frontend is loaded over HTTPS. The existing `inferenceUrl()` constructs this automatically.

FastAPI's `CORSMiddleware` does **not** enforce origin restrictions for WebSockets. Validate `websocket.headers.get("origin")` against a configured allowlist **before** calling `websocket.accept()` to restrict browser clients. Apply similar protection or disable development-only routes like `/ws-test` in production.

Origin validation alone is not authentication or a complete protection against abuse: add rate limits, connection/session limits, input validation, and resource budgets before attracting significant public traffic.

## 6. End-to-end verification

Open [the deployed inference page](https://rl-demo-delta.vercel.app/#/inference/) and test:

1. The homepage loads.
2. The dropdown lists environments loaded from Render.
3. The saved models/checkpoints appear for a supported environment.
4. **Start** opens the `wss://.../inference` WebSocket connection.
5. Frames and step rewards stream live.
6. Network inspection updates for trained models.
7. The replay timeline can navigate recorded frames after an episode.
8. **Stop** closes the session cleanly.
9. A second simultaneous inference correctly receives a busy response (the API currently runs one session at a time).

Use browser DevTools (**F12 → Network → WS**) to check the WebSocket URL and messages. Use **Console** for CORS or JavaScript errors, and **Render logs** for Python errors, missing checkpoints, memory failures and exceptions.

### Troubleshooting table

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| `/health` works but React reports CORS | Frontend origin not allowed | `RL_CORS_ORIGINS` must equal the exact Vercel origin |
| `/environments` works directly but fetch fails | Browser cross-origin restrictions | Test with `curl.exe -i -H "Origin: ..."` |
| Vercel frontend calls `localhost` or `/api` | Incorrect/missing build-time config | Set `VITE_API_BASE_URL` and redeploy Vercel |
| WebSocket fails immediately | Invalid WSS URL, origin rejection, or cold start | DevTools Network → WS; Render logs; check `wss://` |
| `/health` works but a game crashes | Python dependencies, model files or resource limits | Check Render logs, RAM and checkpoint availability |
| First visit times out, second works | Render sleeping/cold start | Wake the service, retry, or use always-on hosting |
| Vercel build fails | Wrong root or dependency/version mismatch | Set root to `frontend`, use `npm ci` and run local build |

## 7. Automatic deployment and daily development

Both Render and Vercel can automatically redeploy when changes are pushed to `main`:

```powershell
# Work locally
npm run dev

# Publish changes
git add .
git commit -m "Improve inference demo"
git push origin main
```

- Vercel rebuilds the static React frontend.
- Render rebuilds/restarts the Python backend.
- Your own computer can be turned off while hosting services run (subject to sleep/free-tier limits).

**Local:** `npm run dev`; **Public:** your Vercel URL + your Render API.

No Docker, Kubernetes, or separate inference server is necessary for this first deployment. Docker can be introduced later if reproducibility or migration requires it.

## References

- [Render dashboard](https://dashboard.render.com)
- [Render: Deploy a FastAPI app](https://render.com/docs/deploy-fastapi)
- [Render free services](https://render.com/docs/free)
- [Vercel: New project](https://vercel.com/new)
- [Vercel: Vite documentation](https://vercel.com/docs/frameworks/frontend/vite)
- [Local orchestration tutorial](local_orchestrator.md)
- [Live inference implementation](../live_inference.md)
