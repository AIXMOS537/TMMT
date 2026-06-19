import { execFileSync } from "node:child_process";
import { readBoard, withBoard } from "./overdrive/git-coord";
import { isOwnerUnlocked } from "./overdrive/session";
import { mark } from "../src/lib/overdrive/board";
import { sendImessage } from "../src/lib/overdrive/notify";
import type { BoardRow } from "../src/lib/overdrive/types";

const RELAY = process.env.OVERDRIVE_RELAY ?? "http://100.77.126.8:8787";

const ICON: Record<BoardRow["status"], string> = {
  TODO: "•", CLAIMED: "◴", DOING: "▶", DONE: "✅", FAILED: "❌",
};

function roster(): string {
  try {
    return execFileSync("bash", ["scripts/mesh/presence.sh", "who"], { encoding: "utf8" });
  } catch {
    return "(presence unavailable)";
  }
}

async function view(): Promise<void> {
  const board = await readBoard();
  console.log("═══ OPERATION OVERDRIVE — WATCHTOWER ═══\n");
  console.log(isOwnerUnlocked() ? "OWNER: \u{1F513} X (unlocked)" : "OWNER: \u{1F512} locked — run `x unlock`");
  console.log("\nWHO/WHAT IS ONLINE:");
  console.log(roster().trim() || "  (none)");
  console.log("\nJOBS:");
  const open = board.filter((r) => r.status !== "DONE");
  if (!open.length) console.log("  (board clear)");
  for (const r of board.slice(-25)) {
    console.log(`  ${ICON[r.status]} #${r.id} [${r.lane}/t${r.tier}] ${r.task}  ${r.machine ? "@" + r.machine : ""}`);
  }
  console.log("\nCAPTURE:  catch \"...\"   ·   HAND TO PERSON:  overdrive assign <id> <name>");
}

async function assign(): Promise<void> {
  const id = Number(process.argv[3]);
  const name = process.argv[4];
  if (!id || !name) {
    console.error("usage: overdrive assign <id> <name>");
    process.exit(1);
  }
  await withBoard((rows) => mark(rows, id, "CLAIMED", { machine: name, lease: "", log: `handed to ${name}` }));
  await sendImessage(`\u{1F4CB} #${id} handed to ${name}`, RELAY);
  console.log(`assigned #${id} -> ${name}`);
}

if (process.argv[2] === "assign") assign();
else view();
