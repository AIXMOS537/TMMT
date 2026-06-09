export type CubeFace = "learn" | "work" | "fleet" | "command";

export type CubeUrls = {
  learn: string;
  work: string;
  fleet: string;
  command: string;
};

/** Shared localStorage key — same origin in production (e.g. app.aixmos.com/learn + /work) */
export const CUBE_STORAGE_KEY = "aixmos-cube-state";
export const CUBE_BROADCAST_CHANNEL = "aixmos-cube-sync";

/** Production: one deployment at aixmos.com with /learn + /work */
export function isSameOriginCube(): boolean {
  return process.env.NEXT_PUBLIC_CUBE_SAME_ORIGIN !== "false";
}

export function getCubeUrls(): CubeUrls {
  if (isSameOriginCube()) {
    return {
      learn: "/learn",
      work: "",
      fleet: "/fleet",
      command: "/command",
    };
  }
  const learn =
    process.env.NEXT_PUBLIC_CUBE_LEARN_URL ??
    process.env.NEXT_PUBLIC_ENGINE_URL ??
    "http://localhost:3001";
  const work =
    process.env.NEXT_PUBLIC_CUBE_WORK_URL ??
    process.env.NEXT_PUBLIC_WORKFORCE_URL ??
    "http://localhost:3000";
  const fleet = process.env.NEXT_PUBLIC_CUBE_FLEET_URL ?? `${work}/fleet`;
  const command = process.env.NEXT_PUBLIC_CUBE_COMMAND_URL ?? `${work}/command`;

  return { learn, work, fleet, command };
}

function withQuery(path: string, applicationId?: string): string {
  if (!applicationId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}applicationId=${encodeURIComponent(applicationId)}`;
}

export function learnPath(path: string, applicationId?: string): string {
  const urls = getCubeUrls();
  const p = path.startsWith("/") ? path : `/${path}`;
  const full = isSameOriginCube() ? `/learn${p}` : `${urls.learn.replace(/\/$/, "")}${p}`;
  return withQuery(full, applicationId);
}

export function workPath(path: string, applicationId?: string): string {
  const urls = getCubeUrls();
  const p = path.startsWith("/") ? path : `/${path}`;
  const full = isSameOriginCube() ? p : `${urls.work.replace(/\/$/, "")}${p}`;
  return withQuery(full, applicationId);
}

export function facesForRole(role: string): CubeFace[] {
  switch (role) {
    case "client":
      return ["learn"];
    case "coach":
    case "admin":
    case "supervisor":
      return ["work", "learn"];
    default:
      return ["work", "learn", "fleet", "command"];
  }
}
