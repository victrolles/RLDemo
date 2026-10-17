import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from inference.schemas import InferenceRequest
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


@app.get("/health")
async def health():
    return {"status": "online"}


@app.websocket("/inference")
async def inference(websocket: WebSocket):
    await websocket.accept()

    # Only one inference at a time for now
    lock = websocket.app.state.inference_lock

    if lock.locked():
        await websocket.close(
            code=1013,
            reason="Inference server busy"
        )
        return

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

    async with lock:
        session = InferenceSession(
            websocket=websocket,
            request=request
        )

        try:
            await session.run()
        except WebSocketDisconnect:
            logger.info("Client disconnected")
        except Exception:
            logger.exception("Inference session failed")
            # Avoid exposing internal error details to clients.
            try:
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