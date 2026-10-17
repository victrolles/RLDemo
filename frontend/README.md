# RL Demo frontend

React + TypeScript + Vite. Run commands from `frontend/`:

```sh
npm ci
npm run dev
npm run build
```

## Home page

The overview takes its dark background, indigo accents, subtle glows, and bordered cards from [the portfolio](https://github.com/victrolles/portfolio). It adapts to mobile, supports keyboard navigation and reduced motion, and links to the `#/inference/` page.

## Live inference

Start FastAPI from the repository root, in a separate terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn server.app:app --reload --host 127.0.0.1 --port 8000
```

Then run `npm run dev` from `frontend/` and open the printed URL. Vite proxies `/api` HTTP requests and WebSocket upgrades to FastAPI on port 8000. Set the `RL_API_TARGET` environment variable to change the development proxy target. An optional `VITE_API_BASE_URL` can point directly to another API origin; see `.env.example`. For a separate frontend origin, configure `RL_CORS_ORIGINS` on FastAPI as a comma-separated list.

Choose a game, its algorithm, and a model selection. The server discovers checkpoints from `models/<environment>/<algorithm>/*.pt`; use the refresh button after adding files. "Custom checkpoint" selects one of those existing files. "Best" and "worst" require `best_model.pt` and `worst_model.pt`. Games without checkpoints can still run with random actions.

The viewer receives actual JPEG frames and matching step metadata, with the step number, per-step reward, total return, and terminated/truncated flags. Start runs one episode; Stop ends it. Changing the configuration resets the previous frame and metrics. Leaving the page closes the session. The server currently permits one inference at a time, with a clear busy message for other clients.

In production, route `/api/*` and WebSocket upgrades to FastAPI, or set `VITE_API_BASE_URL` before building. `vite preview` serves the built frontend only and does not provide the development API proxy.

## Add the four recordings

Place your animated GIFs in `src/assets/videos/` using these exact lowercase names:

| Environment | Filename |
| --- | --- |
| CartPole | `gameplay_cartpole.gif` |
| Pendulum | `gameplay_pendulum.gif` |
| BipedalWalker | `gameplay_bipedalwalker.gif` |
| CarRacing | `gameplay_carracing.gif` |

Short names such as `cartpole.gif` are also supported; `gameplay_` names take precedence. Restart the development server or rebuild after adding files. Vite discovers and bundles the GIF URLs automatically; no component edits are needed. MP4/WebM players are no longer used.

Every card displays its original SVG environment illustration by default. Hover anywhere on the card to load its GIF, which fades in once ready and fits without cropping. Moving the pointer away removes the GIF and restores the illustration. On touch devices, tap to show or hide the animation; keyboard users can focus a card and press Enter or Space. Missing or failed GIFs leave the illustration visible. There are no video controls or coming-soon labels.

Edit game titles, descriptions, and algorithms in `src/data/demos.ts`. The SVG illustrations live in `src/components/GamePreview.tsx`.
