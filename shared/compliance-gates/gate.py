"""
shared/compliance-gates/gate.py
Python mirror of gate.ts for the AIXMOS Node (Python) package.
Every legally gated action must call require_gate() first. See root CLAUDE.md section 3.
"""
import json, re, os

_CONFIG = os.path.join(os.path.dirname(__file__), "gates.config.json")

with open(_CONFIG) as f:
    _GATES = json.load(f)["gates"]


class ComplianceGateError(Exception):
    pass


def is_gate_open(gate: str) -> bool:
    return _GATES.get(gate, {}).get("value") is True


def require_gate(gate: str) -> None:
    g = _GATES.get(gate)
    if not g:
        raise ComplianceGateError(f'Unknown gate "{gate}".')
    if g.get("value") is not True:
        raise ComplianceGateError(
            f'COMPLIANCE GATE BLOCKED: "{gate}" not cleared. Clears when: {g.get("clears_when")}'
        )


_BANNED = [
    r"\bCPN\b", r"credit privacy number", r"credit profile number",
    r"\bSCN\b", r"secondary credit number",
    r"rent(ed|al)?\s+tradeline", r"buy\s+(a\s+)?tradeline",
    r"primary\s+tradeline\s+(for sale|purchase)", r"file\s+segregation",
]


def assert_no_cpn_or_rented_tradelines(payload: str) -> None:
    for pat in _BANNED:
        if re.search(pat, payload, re.IGNORECASE):
            raise ComplianceGateError(
                f"Prohibited content (matched /{pat}/). CPNs and rented/bought tradelines "
                "are permanently banned (federal fraud). Reject and flag for owner review."
            )
