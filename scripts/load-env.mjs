import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadProjectEnv() {
  const envLocal = join(root, ".env.local");
  const envDefault = join(root, ".env");
  if (!existsSync(envLocal) && !existsSync(envDefault)) {
    return false;
  }
  if (existsSync(envLocal)) loadDotEnvFile(envLocal);
  if (existsSync(envDefault)) loadDotEnvFile(envDefault);
  return true;
}

function isPlaceholder(key, val) {
  if (!val) return true;
  if (val.includes("YOUR_GHL") || val === "https://app.gohighlevel.com/") return true;
  // Short placeholder values in .env.local must not block real .env values
  const secretKeys = ["GHL_API_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY"];
  if (secretKeys.includes(key) && val.length < 20) return true;
  return false;
}

function loadDotEnvFile(envPath) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (isPlaceholder(key, val)) continue;
    if (!(key in process.env) || process.env[key] === "" || isPlaceholder(key, process.env[key])) {
      process.env[key] = val;
    }
  }
}

export { root };
