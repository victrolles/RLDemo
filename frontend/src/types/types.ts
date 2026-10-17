import type { NetworkSnapshot } from './network'

export type ModelSelection =
| "best"
| "worst"
| "random"
| "custom"
| "random_actions";

export type InferenceRequest = {
    env_name: string;
    algorithm: string;
    model_selection: ModelSelection;
    model_name?: string;
    seed?: number;
};

export type InferenceResponse = {
  type: "step";
  step: number;
  reward: number;
  total_reward: number;
  action: number | number[] | null;
  network?: NetworkSnapshot | null;
  terminated: boolean;
  truncated: boolean;
};

export const GAMES = [
  { label: "CartPole", envName: "CartPole-v1", algorithm: "dqn" },
  { label: "Pendulum", envName: "Pendulum-v1", algorithm: "sac" },
  { label: "BipedalWalker", envName: "BipedalWalker-v3", algorithm: "sac" },
  { label: "CarRacing", envName: "CarRacing-v3", algorithm: "sac" },
];

export type Status =
  | "idle"
  | "connecting"
  | "running"
  | "stopping"
  | "stopped"
  | "finished"
  | "error";

export type Environment = {
  id: string;
  label: string;
  algorithms: { id: string; label: string }[];
};

export type ModelCatalog = {
  env_name: string;
  algorithm: string;
  models: { name: string }[];
  selections: ModelSelection[];
};
