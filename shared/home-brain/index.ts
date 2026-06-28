/**
 * shared/home-brain — the Home Brain Safety Layer.
 *
 * Every autonomous home-brain agent (macOS M1 "brainiac-mac" and Windows
 * "brainiac-win") imports guardHomeAction and calls it before ANY action.
 * It is the floor that lets the owner step back safely: kill switch, spend
 * caps, PII/family firewall, owner-approval gate, and a tamper-evident audit
 * chain on the NAS.
 */
export * from "./kill-switch";
export * from "./spend-ledger";
export * from "./pii-firewall";
export * from "./audit-log";
export * from "./home-guard";
export * from "./guarded-agent";
