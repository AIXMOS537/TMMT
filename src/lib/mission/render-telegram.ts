import type { MissionBoardData, MissionStat, MissionItem, AgentStatus } from "./types";

const TONE_DOT: Record<MissionStat["tone"], string> = {
  neutral: "·",
  good: "🟢",
  warn: "🟡",
  alert: "🔴",
  info: "🔵",
};

function statLine(s: MissionStat): string {
  const value = s.value === null ? "—" : String(s.value);
  return `${TONE_DOT[s.tone]} ${s.label}: ${value}`;
}

function itemLine(i: MissionItem): string {
  const agentTag = i.agent ? ` [${i.agent.replace("_", " ")}]` : "";
  return `${i.icon} ${i.title}${agentTag}\n   ${i.detail}`;
}

function agentLine(a: AgentStatus): string {
  return `${TONE_DOT[a.tone]} ${a.label} (${a.role}): ${a.status}`;
}

export function renderMissionForTelegram(data: MissionBoardData, now: Date = new Date(0)): string {
  const date = now.getTime() === 0 ? "" : now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const header = `🎯 MISSION — ${data.greetingName}${date ? ` · ${date}` : ""}`;

  const lines: string[] = [header, ""];

  lines.push("📡 What's happening now");
  for (const s of data.stats) lines.push(`  ${statLine(s)}`);
  lines.push("");

  lines.push("🎯 What you're needed for");
  for (const i of data.neededFor) lines.push(`  ${itemLine(i)}`);
  lines.push("");

  lines.push("🚀 Grow & scale");
  for (const m of data.growMoves) lines.push(`  ${m.icon} ${m.title}\n     ${m.detail}`);
  lines.push("");

  lines.push("🤖 Agents on watch");
  for (const a of data.agents) lines.push(`  ${agentLine(a)}`);

  if (data.ventures?.length) {
    lines.push("", "🏢 Ventures");
    for (const v of data.ventures) {
      lines.push(`  • ${v.name} — ${v.status}${v.note ? ` (${v.note})` : ""}`);
    }
  }

  const out = lines.join("\n");
  const suffix = "\n…(truncated)";
  return out.length > 4000 ? out.slice(0, 4000 - suffix.length) + suffix : out;
}
