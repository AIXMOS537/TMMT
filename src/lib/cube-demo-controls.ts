/**
 * Whether the cube's demo controls are shown.
 *
 * The Learn and Work faces both ship a role <select> — Client / Coach / Admin /
 * Supervisor — and a "Reset demo" button in the header. Neither is
 * authorization: switchRole only moves client state. So on a production deploy
 * they let anyone looking at their own credit application drive the whole
 * advisor → admin → supervisor approval chain from one browser, and wipe the
 * application back to its starting state.
 *
 * Fine in development, and fine on a deploy you are demoing from. Not fine on
 * the one real customers reach. Off in production unless explicitly asked for:
 *
 *   NEXT_PUBLIC_CUBE_DEMO_CONTROLS=1
 *
 * This is read at module scope so Next can inline it and drop the dead branch
 * from the production bundle.
 */
export const CUBE_DEMO_CONTROLS =
  process.env.NEXT_PUBLIC_CUBE_DEMO_CONTROLS === "1" ||
  process.env.NODE_ENV !== "production";
