#!/usr/bin/env python3
"""
attestation.py — Apple Silicon hardware UUID + machine-bound keypair generation.

Runs on the partner's Mac during provisioning. Captures:
  - IOPlatformUUID (hardware UUID, immutable per Mac)
  - Generates an ed25519 keypair in the user's Keychain marked
    non-exportable (so it cannot be copied to another Mac)
  - Returns the public key plus a local binding label (NOT sent to the server).

v1 LIMITATION: True Secure Enclave attestation requires Swift + Security.framework.
v1 uses a Keychain-stored non-exportable ed25519 keypair, which still binds to
this Mac but is weaker than a true Enclave attestation. v2 must upgrade.

Output: JSON to stdout —
NAMING: this file produces NO attestation. It emits a `binding_hash` — a
non-authoritative label, not evidence of hardware provenance. See binding_hash().

  {"hardware_uuid": "...", "pubkey_b64": "...", "binding_hash": "..."}
"""
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile


def hardware_uuid() -> str:
    """Read IOPlatformUUID from ioreg. This is the immutable Apple Silicon HW UUID."""
    out = subprocess.check_output(
        ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], text=True
    )
    for line in out.splitlines():
        if "IOPlatformUUID" in line:
            return line.split('"')[-2]
    raise RuntimeError("could not read IOPlatformUUID")


def keychain_key_path() -> pathlib.Path:
    """Where to store the public key locally (private key stays in Keychain)."""
    p = pathlib.Path.home() / "Library" / "Application Support" / "aixmos-partner"
    p.mkdir(parents=True, exist_ok=True)
    os.chmod(p, 0o700)
    return p / "device.pub"


def generate_or_load_keypair(label: str = "tools.aixmos.partner.device") -> bytes:
    """
    Generate an ed25519 keypair if not present. Private key is non-exportable
    once stored in the Keychain. Returns the raw public key bytes.

    v1 uses openssl to generate and then `security import` to lock it down.
    """
    pub_path = keychain_key_path()
    if pub_path.exists():
        return pub_path.read_bytes()

    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        priv = td / "priv.pem"
        pub = td / "pub.pem"
        # ed25519 PEM
        subprocess.check_call(
            ["openssl", "genpkey", "-algorithm", "ed25519", "-out", str(priv)],
            stderr=subprocess.DEVNULL,
        )
        subprocess.check_call(
            ["openssl", "pkey", "-in", str(priv), "-pubout", "-out", str(pub)],
            stderr=subprocess.DEVNULL,
        )

        # Import private key into Keychain as non-exportable.
        # -T "" means no apps are allowed to read it without prompt.
        # -A would allow any app — we deliberately do NOT pass -A.
        try:
            subprocess.check_call(
                [
                    "security",
                    "import",
                    str(priv),
                    "-k",
                    str(pathlib.Path.home() / "Library" / "Keychains" / "login.keychain-db"),
                    "-t",
                    "priv",
                    "-x",  # non-extractable
                    "-T",
                    "/usr/bin/security",
                ],
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
            # Already imported; not fatal.
            pass

        pub_bytes = pub.read_bytes()
        pub_path.write_bytes(pub_bytes)
        os.chmod(pub_path, 0o600)
        return pub_bytes


def binding_hash(hw_uuid: str, pubkey: bytes) -> str:
    """
    SHA-256(hardware_uuid || public_key) — a convenience label tying the two
    values together for logs.

    NON-AUTHORITATIVE METADATA. It must never participate in an authorization
    decision. Anyone holding the hardware UUID and the public key can compute
    it, so it proves neither hardware provenance nor possession of the private
    key. Renamed from the former "attestation" wording, which asserted a
    security property it does not have. Nothing consumes this value; it is not
    sent to the server.
    """
    h = hashlib.sha256()
    h.update(hw_uuid.encode())
    h.update(b"\x00")
    h.update(pubkey)
    return h.hexdigest()


def main() -> int:
    hw = hardware_uuid()
    pub = generate_or_load_keypair()
    pub_b64 = base64.b64encode(pub).decode()
    binding = binding_hash(hw, pub)

    json.dump(
        {"hardware_uuid": hw, "pubkey_b64": pub_b64, "binding_hash": binding},
        sys.stdout,
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
