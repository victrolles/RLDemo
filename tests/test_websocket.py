# tests/test_websocket.py

import asyncio
import json

from websockets.asyncio.client import connect

# start server with: python -m uvicorn server.app:app --reload --host 127.0.0.1 --port 8000
# then run this test with: python tests/test_websocket.py


async def main():
    uri = "ws://127.0.0.1:8000/inference"

    request = {
        "env_name": "Pendulum-v1",
        "algorithm": "sac",
        "model_selection": "best"
    }

    async with connect(uri) as websocket:
        print("Connected to inference server")

        await websocket.send(json.dumps(request))

        for _ in range(20):
            message = await websocket.recv()

            if isinstance(message, bytes):
                print(f"Received frame: {len(message)} bytes")
            else:
                data = json.loads(message)
                print("Received:", data)


if __name__ == "__main__":
    asyncio.run(main())