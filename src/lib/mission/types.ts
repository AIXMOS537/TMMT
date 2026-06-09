export type MissionView = "owner" | "manager" | "team" | "vendor" | "client";

export type Tone = "neutral" | "good" | "warn" | "alert" | "info";

export type MissionStat = {
  label: string;
  value: number | null;
  tone: Tone;
};

export type MissionItem = {
  icon: string;
  title: string;
  detail: string;
  agent?: AgentKey;
};

export type GrowMove = {
  icon: string;
  title: string;
  detail: string;
};

export type AgentKey = "vision" | "tank" | "fly_guy" | "bob" | "sticks";

export type AgentStatus = {
  key: AgentKey;
  label: string;
  role: string;
  status: string;
  tone: Tone;
};

export type Venture = {
  name: string;
  status: string;
  note: string;
};

export type MissionBoardData = {
  view: MissionView;
  greetingName: string;
  stats: MissionStat[];
  neededFor: MissionItem[];
  growMoves: GrowMove[];
  agents: AgentStatus[];
  ventures?: Venture[];
};
