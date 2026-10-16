import sys
from pathlib import Path

import cv2
import numpy as np

# Allow this example to be run directly from the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inference import InferenceRunner, InferenceRequest, ModelSelection

def main():
    config = InferenceRequest(
        env_name="CarRacing-v3",
        algorithm="sac",
        model_selection=ModelSelection.RANDOM_ACTIONS,
        seed=42
    )

    runner = InferenceRunner(config)

    for response in runner.run(max_steps=1000):
        # Gymnasium returns RGB, OpenCV expects BGR
        frame = cv2.cvtColor(
            np.asarray(response.frame),
            cv2.COLOR_RGB2BGR
        )

        # Display information
        cv2.putText(
            frame,
            f"Step: {response.step} | Reward: {response.total_reward:.2f}",
            (10, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1
        )

        cv2.imshow("RL Inference", frame)

        # Press Q to stop
        if cv2.waitKey(30) & 0xFF == ord("q"):
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
