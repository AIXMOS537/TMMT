import { TMMT_UPGRADE_RUNGS, tmmtClientUpgradeUrl } from "@/lib/ghl-offers";

export const metadata = {
  title: "Climb with AIXMOS — TMMT clients",
  robots: { index: false, follow: false },
};

/**
 * Existing TMMT renters / operators → higher AIXMOS rungs via GHL.
 * Every button is a GoHighLevel URL tagged utm_source=tmmt.
 */
export default function UpgradePage() {
  return (
    <main
      style={{
        fontFamily: "-apple-system, system-ui, sans-serif",
        background: "#0a0a0a",
        color: "#fff",
        minHeight: "100vh",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 8 }}>TMMT → AIXMOS</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px" }}>
          You already have the cars. Next is the engine.
        </h1>
        <p style={{ opacity: 0.85, fontSize: 17, lineHeight: 1.45, marginBottom: 28 }}>
          If you rent or run with TMMT, these are the paid rungs on All In One Management
          (AIXMOS). Every button opens GoHighLevel so we can tag you and move you up —
          membership, credit guidance, then a real build.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {TMMT_UPGRADE_RUNGS.map((rung) => (
            <li
              key={rung.id}
              style={{
                border: "1px solid #222",
                borderRadius: 12,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ fontSize: 18 }}>{rung.label}</strong>
                <span style={{ color: "#7fffd4" }}>{rung.price}</span>
              </div>
              <p style={{ opacity: 0.75, fontSize: 14, margin: "8px 0 16px" }}>{rung.note}</p>
              <a
                href={tmmtClientUpgradeUrl(rung.id)}
                style={{
                  display: "inline-block",
                  background: "#7fffd4",
                  color: "#000",
                  fontWeight: 600,
                  padding: "12px 18px",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Continue in GHL →
              </a>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 24, lineHeight: 1.5 }}>
          Education and funding-readiness only — not credit repair. No score or approval is
          promised. Earnings, if any, are on collected sales. You contract on GHL terms.
        </p>
      </div>
    </main>
  );
}
