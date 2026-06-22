#!/usr/bin/env python3
"""Dual Setup Sync — registry load, validate, status."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "config" / "dual-sync.registry.example.yaml"
LOCAL = ROOT / "config" / "dual-sync.registry.local.yaml"

REQUIRED_TOP = ("schema_version", "principals", "devices", "sync_pairs", "modules_catalog")
DEVICE_ROLES = {"home_brain", "mobile_command", "office_brain", "compute", "relay"}
PRINCIPAL_TIERS = {"owner", "founding_operator", "operator", "agency_owner"}


def resolve_registry(explicit: Path | None = None) -> Path:
    if explicit and explicit.is_file():
        return explicit
    if LOCAL.is_file():
        return LOCAL
    if EXAMPLE.is_file():
        return EXAMPLE
    raise FileNotFoundError(
        f"No registry found. Copy {EXAMPLE} → {LOCAL}"
    )


def load_registry(path: Path | None = None) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML required: pip install pyyaml")
    p = resolve_registry(path)
    with open(p, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError("Registry must be a YAML mapping")
    data["_path"] = str(p)
    return data


def validate(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED_TOP:
        if key not in data:
            errors.append(f"missing top-level key: {key}")

    principals = data.get("principals") or {}
    devices = data.get("devices") or {}
    pairs = data.get("sync_pairs") or {}
    catalog = data.get("modules_catalog") or {}

    if not isinstance(principals, dict) or not principals:
        errors.append("principals: need at least one entry")
    if not isinstance(devices, dict) or not devices:
        errors.append("devices: need at least one entry")

    for pid, p in (principals.items() if isinstance(principals, dict) else []):
        if not isinstance(p, dict):
            errors.append(f"principals.{pid}: must be a mapping")
            continue
        tier = p.get("tier")
        if tier and tier not in PRINCIPAL_TIERS:
            errors.append(f"principals.{pid}.tier: invalid {tier!r}")
        brain = p.get("brain_mesh")
        if brain and brain not in devices:
            errors.append(f"principals.{pid}.brain_mesh: unknown device {brain!r}")
        for mm in p.get("mobile_meshes") or []:
            if mm not in devices:
                errors.append(f"principals.{pid}.mobile_meshes: unknown device {mm!r}")
        for mod_name, mod_cfg in (p.get("modules") or {}).items():
            if mod_name not in catalog:
                errors.append(f"principals.{pid}.modules.{mod_name}: not in modules_catalog")
            if isinstance(mod_cfg, dict) and mod_cfg.get("enabled"):
                cat = catalog.get(mod_name) or {}
                if tier != "owner" and mod_name in ("brother_layer",) and cat.get("owner_included"):
                    if not cat.get("operator_build_rung"):
                        errors.append(
                            f"principals.{pid}: module {mod_name} is owner-only but enabled"
                        )

    for dname, d in (devices.items() if isinstance(devices, dict) else []):
        if not isinstance(d, dict):
            errors.append(f"devices.{dname}: must be a mapping")
            continue
        role = d.get("role")
        if role and role not in DEVICE_ROLES:
            errors.append(f"devices.{dname}.role: invalid {role!r}")
        pid = d.get("principal_id")
        if pid and pid not in principals:
            errors.append(f"devices.{dname}.principal_id: unknown principal {pid!r}")

    for pair_id, pair in (pairs.items() if isinstance(pairs, dict) else []):
        if not isinstance(pair, dict):
            continue
        pid = pair.get("principal_id")
        if pid and pid not in principals:
            errors.append(f"sync_pairs.{pair_id}.principal_id: unknown {pid!r}")
        for mesh_key in ("mobile_mesh", "brain_mesh"):
            mesh = pair.get(mesh_key)
            if mesh and mesh not in devices:
                errors.append(f"sync_pairs.{pair_id}.{mesh_key}: unknown device {mesh!r}")

    nums = data.get("phone_numbers") or {}
    for label, num in (nums.items() if isinstance(nums, dict) else []):
        if not isinstance(num, dict):
            continue
        e164 = str(num.get("e164", ""))
        if "X" in e164 or e164.endswith("0000"):
            pass  # placeholder OK in example
        mesh = num.get("device_mesh")
        if mesh and mesh not in devices:
            errors.append(f"phone_numbers.{label}.device_mesh: unknown {mesh!r}")

    return errors


def status(data: dict[str, Any]) -> str:
    lines = [
        f"Registry: {data.get('_path', '?')}",
        f"schema_version: {data.get('schema_version')}",
        "",
        "Principals:",
    ]
    for pid, p in (data.get("principals") or {}).items():
        mods = [k for k, v in (p.get("modules") or {}).items() if isinstance(v, dict) and v.get("enabled")]
        lines.append(f"  {pid} ({p.get('tier')}) brain={p.get('brain_mesh')} modules=[{', '.join(mods)}]")
    lines.append("")
    lines.append("Sync pairs:")
    for pair_id, pair in (data.get("sync_pairs") or {}).items():
        lines.append(
            f"  {pair_id}: {pair.get('mobile_mesh')} ↔ {pair.get('brain_mesh')} "
            f"({pair.get('principal_id')})"
        )
    lines.append("")
    lines.append("Devices:")
    for dname, d in (data.get("devices") or {}).items():
        lines.append(f"  {dname}: role={d.get('role')} always_on={d.get('always_on')}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Dual Setup Sync registry")
    parser.add_argument("command", nargs="?", default="status", choices=["validate", "status", "path"])
    parser.add_argument("--file", type=Path, help="Registry YAML path")
    args = parser.parse_args()

    try:
        reg_path = resolve_registry(args.file)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    if args.command == "path":
        print(reg_path)
        return

    try:
        data = load_registry(reg_path)
    except Exception as e:
        print(f"load failed: {e}", file=sys.stderr)
        sys.exit(1)

    if args.command == "validate":
        errs = validate(data)
        if errs:
            print("FAIL")
            for err in errs:
                print(f"  • {err}")
            sys.exit(1)
        print("PASS")
        return

    print(status(data))
    errs = validate(data)
    if errs:
        print("\nWarnings (fix before prod):")
        for err in errs:
            print(f"  • {err}")


if __name__ == "__main__":
    main()
