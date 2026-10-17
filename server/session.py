import asyncio
import threading
import time

from fastapi import WebSocket, WebSocketDisconnect
import cv2

from inference.runner import InferenceRunner


HEARTBEAT_TIMEOUT = 20


class InferenceSession:
    def __init__(self, websocket: WebSocket, request):
        self.websocket = websocket
        self.request = request

        self.stop_event = threading.Event()
        self.disconnected = asyncio.Event()

        self.frames = asyncio.Queue(maxsize=2)
        self.thread = None

        self.last_heartbeat = time.monotonic()

    async def run(self):
        loop = asyncio.get_running_loop()

        self.thread = threading.Thread(
            target=self._run_inference,
            args=(loop,),
            daemon=False
        )

        self.thread.start()

        receiver = asyncio.create_task(
            self._receive_messages()
        )

        try:
            await self._stream_frames(receiver)
        finally:
            self.stop_event.set()
            receiver.cancel()
            await asyncio.gather(
                receiver,
                return_exceptions=True
            )

    def _run_inference(self, loop):
        try:
            runner = InferenceRunner(self.request)

            for result in runner.run(self.stop_event):
                if self.stop_event.is_set():
                    break

                loop.call_soon_threadsafe(
                    self._enqueue,
                    ("frame", result)
                )

        except Exception as exc:
            loop.call_soon_threadsafe(
                self._enqueue,
                ("error", str(exc))
            )

        finally:
            loop.call_soon_threadsafe(
                self._enqueue,
                ("done", None)
            )

    def _enqueue(self, item):
        if self.frames.full():
            self.frames.get_nowait()

        self.frames.put_nowait(item)

    async def _receive_messages(self):
        try:
            while not self.stop_event.is_set():
                message = await asyncio.wait_for(
                    self.websocket.receive_json(),
                    timeout=HEARTBEAT_TIMEOUT
                )

                if message.get("type") == "heartbeat":
                    self.last_heartbeat = time.monotonic()

                elif message.get("type") == "stop":
                    break

        except (WebSocketDisconnect, asyncio.TimeoutError):
            pass
        finally:
            self.disconnected.set()
            self.stop_event.set()

    async def _stream_frames(self, receiver):
        while not self.stop_event.is_set():
            frame_task = asyncio.create_task(
                self.frames.get()
            )

            done, pending = await asyncio.wait(
                {frame_task, receiver},
                return_when=asyncio.FIRST_COMPLETED
            )

            if receiver in done:
                frame_task.cancel()
                await asyncio.gather(
                    frame_task,
                    return_exceptions=True
                )
                break

            kind, data = frame_task.result()

            if kind == "done":
                break

            if kind == "error":
                raise RuntimeError(data)

            # Convert and send the frame.
            # Details below.
            await self._send_result(data)



    async def _send_result(self, result):
        # Convert RGB frame to BGR for OpenCV
        frame_bgr = cv2.cvtColor(
            result.frame,
            cv2.COLOR_RGB2BGR
        )

        # Encode frame as JPEG
        success, encoded = cv2.imencode(
            ".jpg",
            frame_bgr,
            [cv2.IMWRITE_JPEG_QUALITY, 80]
        )

        if not success:
            raise RuntimeError("Failed to encode frame")

        # Send metadata
        await self.websocket.send_json({
            "type": "step",
            "step": result.step,
            "reward": float(result.reward),
            "total_reward": float(result.total_reward),
            "terminated": result.terminated,
            "truncated": result.truncated
        })

        # Send image
        await self.websocket.send_bytes(
            encoded.tobytes()
        )

    async def stop(self):
        self.stop_event.set()

        if self.thread is not None:
            await asyncio.to_thread(self.thread.join)