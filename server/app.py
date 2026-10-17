import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import TypeAdapter, ValidationError

from inference.schemas import InferenceRequest
from inference.catalog import ENVIRONMENTS, available_selections, list_models, validate_request
from server.session import InferenceSession

logger = logging.getLogger(__name__)

request_adapter = TypeAdapter(InferenceRequest)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.inference_lock = asyncio.Lock()
    yield


app = FastAPI(
    title="RLDemo API",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "RL_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "online"}


@app.get("/environments")
async def environments():
    return {"environments": [
        {"id": env_name, "label": spec["label"], "algorithms": [
            {"id": algorithm, "label": algorithm.upper()}
            for algorithm in spec["algorithms"]
        ]}
        for env_name, spec in ENVIRONMENTS.items()
    ]}


@app.get("/models")
async def models(env_name: str, algorithm: str):
    try:
        names = list_models(env_name, algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "env_name": env_name,
        "algorithm": algorithm,
        "models": [{"name": name} for name in names],
        "selections": available_selections(names),
    }


@app.websocket("/inference")
async def inference(websocket: WebSocket):
    await websocket.accept()

    # Only one inference at a time for now
    lock = websocket.app.state.inference_lock

    try:
        data = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=10
        )
        request = request_adapter.validate_python(data)

    except (ValidationError, ValueError, asyncio.TimeoutError):
        await websocket.close(
            code=1008,
            reason="Invalid inference request"
        )
        return

    except WebSocketDisconnect:
        return

    try:
        validate_request(request)
    except ValueError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1008, reason="Unavailable model selection")
        return

    # Check after receiving the request so two pending clients cannot queue runs.
    if lock.locked():
        await websocket.send_json({"type": "error", "message": "The inference server is busy. Try again shortly."})
        await websocket.close(code=1013, reason="Inference server busy")
        return

    async with lock:
        session = InferenceSession(
            websocket=websocket,
            request=request
        )

        try:
            await websocket.send_json({"type": "started"})
            outcome = await session.run()
            await session.stop()
            await websocket.send_json({"type": outcome})
            await websocket.close(code=1000)
        except WebSocketDisconnect:
            logger.info("Client disconnected")
        except Exception:
            logger.exception("Inference session failed")
            # Avoid exposing internal error details to clients.
            try:
                await websocket.send_json({"type": "error", "message": "Could not run this model. Try another checkpoint or game."})
                await websocket.close(code=1011)
            except (RuntimeError, OSError):
                pass
        finally:
            await session.stop()

@app.websocket("/ws-test")
async def websocket_test(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            message = await websocket.receive_text()
            await websocket.send_text(
                f"Server received: {message}"
            )

    except WebSocketDisconnect:
        print("Client disconnected")
