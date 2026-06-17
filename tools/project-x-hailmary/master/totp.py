#!/usr/bin/env python3
"""
PROJECT X HAILMARY — Revolving Authentication (TOTP, RFC 6238)
Pure Python stdlib. No pip installs. Works offline.

The revolving code changes every 30 seconds. Muhammad Taha can also load the
same seed into Google Authenticator / Authy on his phone so the rolling code
travels with him even without CYBORG.

Usage:
  python3 totp.py gen <base32_seed>        # current 6-digit code
  python3 totp.py verify <seed> <code>     # verify a code (allows +/-1 window)
  python3 totp.py newseed                  # generate a fresh random seed
  python3 totp.py uri <seed> <label>       # otpauth:// URI for phone enrollment
"""
import sys, hmac, hashlib, struct, time, base64, secrets


def _hotp(seed_b32: str, counter: int, digits: int = 6) -> str:
    # Pad base32 to a valid length, decode the shared secret
    seed_b32 = seed_b32.strip().replace(" ", "").upper()
    seed_b32 += "=" * (-len(seed_b32) % 8)
    key = base64.b32decode(seed_b32, casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code_int).zfill(digits)


def totp_now(seed_b32: str, step: int = 30, digits: int = 6) -> str:
    return _hotp(seed_b32, int(time.time() // step), digits)


def totp_verify(seed_b32: str, code: str, step: int = 30, window: int = 1) -> bool:
    code = code.strip()
    counter = int(time.time() // step)
    for drift in range(-window, window + 1):
        if _hotp(seed_b32, counter + drift) == code:
            return True
    return False


def new_seed() -> str:
    # 20 random bytes -> base32 (standard TOTP secret length)
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def otpauth_uri(seed_b32: str, label: str, issuer: str = "AIXMOS-HailMary") -> str:
    from urllib.parse import quote
    return (f"otpauth://totp/{quote(issuer)}:{quote(label)}"
            f"?secret={seed_b32}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30")


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "gen":
        print(totp_now(sys.argv[2]))
    elif cmd == "verify":
        ok = totp_verify(sys.argv[2], sys.argv[3])
        print("VALID" if ok else "INVALID")
        sys.exit(0 if ok else 1)
    elif cmd == "newseed":
        print(new_seed())
    elif cmd == "uri":
        label = sys.argv[3] if len(sys.argv) > 3 else "owner"
        print(otpauth_uri(sys.argv[2], label))
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
