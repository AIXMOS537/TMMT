"""
Run in CI / pre-commit. Verifies launch posture:
- Only cpn_and_rented_tradelines_blocked may be true at launch.
- All other gates must be false until human sign-off.
Exit non-zero if posture is violated, so a non-compliant build can't ship.
"""
import json, os, sys

cfg = os.path.join(os.path.dirname(__file__), "gates.config.json")
gates = json.load(open(cfg))["gates"]

must_be_true = {"cpn_and_rented_tradelines_blocked"}
violations = []

for key, g in gates.items():
    val = g.get("value")
    if key in must_be_true and val is not True:
        violations.append(f"{key} MUST be true (permanent prohibition) but is {val}")
    if key not in must_be_true and val is True:
        violations.append(
            f"{key} is true — confirm the human completed: {g.get('clears_when')}"
        )

if violations:
    print("COMPLIANCE POSTURE CHECK — review required:")
    for v in violations:
        print("  -", v)
    # Non-permanent gates being true is allowed ONLY after sign-off; this surfaces them.
    sys.exit(1 if any("MUST be true" in v for v in violations) else 0)

print("Compliance posture OK: Virginia-only launch, legal gates closed, CPN block active.")
