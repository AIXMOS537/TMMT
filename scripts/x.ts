import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { makeSeal, verifyPassphrase } from "../src/lib/overdrive/owner";
import { grantOwner, revokeOwner, isOwnerUnlocked } from "./overdrive/session";

const SEAL = join(homedir(), "Projects/TMMT/auth/OWNER.seal");

/** Read a line from the terminal without echoing it (for passphrases). */
function promptHidden(q: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const stdin = process.stdin;
    stdin.resume();
    if (stdin.isTTY) stdin.setRawMode(true);
    let input = "";
    const onData = (chunk: Buffer) => {
      const b = chunk[0];
      if (b === 0x0d || b === 0x0a || b === 0x04) {
        // CR / LF / EOT -> submit
        if (stdin.isTTY) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (b === 0x03) {
        process.exit(1); // Ctrl-C
      } else if (b === 0x7f || b === 0x08) {
        input = input.slice(0, -1); // DEL / backspace
      } else {
        input += chunk.toString("utf8");
      }
    };
    stdin.on("data", onData);
  });
}

async function set(): Promise<void> {
  const p1 = await promptHidden("Set master passphrase (X): ");
  if (p1.length < 8) {
    console.error("x: passphrase must be at least 8 characters.");
    process.exit(1);
  }
  const p2 = await promptHidden("Confirm passphrase: ");
  if (p1 !== p2) {
    console.error("x: passphrases did not match.");
    process.exit(1);
  }
  mkdirSync(dirname(SEAL), { recursive: true });
  writeFileSync(SEAL, makeSeal(p1));
  chmodSync(SEAL, 0o600);
  console.log("x: owner seal set. (Only the salted hash is stored — safe to commit.)");
}

async function unlock(): Promise<void> {
  if (!existsSync(SEAL)) {
    console.error("x: no owner seal yet. Run `x set` first.");
    process.exit(1);
  }
  const pass = await promptHidden("Master passphrase (X): ");
  if (verifyPassphrase(pass, readFileSync(SEAL, "utf8").trim())) {
    grantOwner();
    console.log("\u{1F513} Owner control granted — you are X. Everything is yours to run.");
  } else {
    console.error("x: wrong passphrase.");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "status";
  if (cmd === "set") return set();
  if (cmd === "unlock") return unlock();
  if (cmd === "lock") {
    revokeOwner();
    console.log("\u{1F512} Locked. Run `x unlock` to take control again.");
    return;
  }
  console.log(isOwnerUnlocked() ? "\u{1F513} unlocked (you are X)" : "\u{1F512} locked");
}

main();
