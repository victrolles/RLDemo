import asyncio
import threading
import time
from concurrent.futures import TimeoutError as FutureTimeoutError

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
        self.network_sent = False

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
            return await self._stream_frames(receiver)
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
            # Run at the environment's display rate, rather than flooding the browser.
            fps = max(1, min(60, runner.env.metadata.get("render_fps", 30)))
            frame_interval = 1.0 / fps
            next_frame_at = time.monotonic()

            for result in runner.run(self.stop_event):
                if self.stop_event.is_set():
                    break

                if not self._enqueue(loop, ("frame", result)):
                    break
                # Initial rendering can be slow; never burst through missed frames.
                next_frame_at = max(next_frame_at, time.monotonic()) + frame_interval
                self.stop_event.wait(max(0, next_frame_at - time.monotonic()))

        except Exception as exc:
            self._enqueue(loop, ("error", str(exc)))

        finally:
            self._enqueue(loop, ("done", None))

    def _enqueue(self, loop, item):
        """Apply backpressure so a slow consumer does not lose replay steps."""
        if self.stop_event.is_set():
            return False
        pending = asyncio.run_coroutine_threadsafe(self.frames.put(item), loop)
        while not self.stop_event.is_set():
            try:
                pending.result(timeout=0.1)
                return True
            except FutureTimeoutError:
                continue
        pending.cancel()
        return False

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
                return "finished"

            if kind == "error":
                raise RuntimeError(data)

            # Convert and send the frame.
            # Details below.
            await self._send_result(data)

        return "stopped"



    async def _send_result(self, result):
        if not self.network_sent:
            await self.websocket.send_json({"type": "network", "network": result.network_definition})
            self.network_sent = True
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
            "action": result.action,
            "network": result.network,
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
