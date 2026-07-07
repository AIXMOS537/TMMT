import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadProjectEnv() {
  const envLocal = join(root, ".env.local");
  const envDefault = join(root, ".env");
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const ghlPaste = home ? join(home, ".config", "tmmt", "ghl-paste.env") : "";
  if (!existsSync(envLocal) && !existsSync(envDefault) && !existsSync(ghlPaste)) {
    return false;
  }
  if (existsSync(envLocal)) loadDotEnvFile(envLocal);
  if (existsSync(envDefault)) loadDotEnvFile(envDefault);
  if (ghlPaste && existsSync(ghlPaste)) loadDotEnvFile(ghlPaste);
  const clickupEnv = home ? join(home, ".config", "tmmt", "clickup.env") : "";
  if (clickupEnv && existsSync(clickupEnv)) {
    loadDotEnvFile(clickupEnv);
    if (process.env.CLICKUP_TOKEN && !process.env.CLICKUP_API_TOKEN) {
      process.env.CLICKUP_API_TOKEN = process.env.CLICKUP_TOKEN;
    }
  }
  return true;
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
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

export { root };
