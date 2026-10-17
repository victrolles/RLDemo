import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from server.session import InferenceSession


class WaitingSocket:
    async def receive_json(self):
        await asyncio.Future()


class ReplaySessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_consumer_receives_every_step_in_order(self):
        class Runner:
            def __init__(self, request):
                self.env = SimpleNamespace(metadata={"render_fps": 60})

            def run(self, stop_event):
                for step in range(1, 13):
                    if stop_event.is_set():
                        break
                    yield SimpleNamespace(step=step)

        session = InferenceSession(WaitingSocket(), None)
        delivered = []

        async def slow_send(result):
            await asyncio.sleep(0.05)
            delivered.append(result.step)

        session._send_result = slow_send
        with patch("server.session.InferenceRunner", Runner):
            try:
                outcome = await asyncio.wait_for(session.run(), timeout=4)
            finally:
                await session.stop()
        self.assertEqual(outcome, "finished")
        self.assertEqual(delivered, list(range(1, 13)))

    async def test_stop_unblocks_a_producer_waiting_on_a_full_queue(self):
        session = InferenceSession(WaitingSocket(), None)
        session.frames.put_nowait(("frame", 1))
        session.frames.put_nowait(("frame", 2))
        task = asyncio.create_task(asyncio.to_thread(session._enqueue, asyncio.get_running_loop(), ("frame", 3)))
        await asyncio.sleep(0.05)
        self.assertFalse(task.done())
        session.stop_event.set()
        self.assertFalse(await asyncio.wait_for(task, timeout=1))


if __name__ == "__main__":
    unittest.main()
