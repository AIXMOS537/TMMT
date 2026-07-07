export type RacePhase = "learn" | "earn" | "churn" | "graduate";

export type RaceMilestone = {
  id: string;
  label: string;
  reward: string;
  done: boolean;
};

export type RaceRacer = {
  id: string;
  name: string;
  phase: RacePhase;
  progress: number; // 0–100 along current phase
  earningsUsd: number;
  certified: boolean;
  tone: "good" | "warn" | "info" | "neutral";
};

export type RaceBlocker = {
  id: string;
  label: string;
  tier: "P0" | "P1";
};

export type EmpireGoal = {
  label: string;
  targetUsd: number;
  currentUsd: number;
  fleetTarget: number;
  fleetCurrent: number;
  operatorCap: number;
  operatorActive: number;
};

export type TrapRaceData = {
  goal: EmpireGoal;
  phases: { id: RacePhase; label: string; emoji: string; description: string }[];
  racers: RaceRacer[];
  milestones: RaceMilestone[];
  blockers: RaceBlocker[];
  meshOnline: boolean;
};
