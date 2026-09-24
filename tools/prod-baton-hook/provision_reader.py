"""Provision the baton hook's read-only database credential on this machine.

Generates a random password, stores the connection JSON DPAPI-encrypted for the
CURRENT Windows user at %LOCALAPPDATA%\\tmmt\\baton-hook\\reader.dpapi, and prints ONLY
the SCRAM-SHA-256 verifier to apply with:  alter role baton_reader password '<verifier>';
The plaintext password is never printed, logged or sent anywhere.
Refuses to overwrite an existing credential unless --rotate is given.
"""
import base64
import ctypes
import ctypes.wintypes as wt
import hashlib
import hmac
import json
import os
import secrets
import sys

BASE = os.path.join(os.environ["LOCALAPPDATA"], "tmmt", "baton-hook")
TARGET = os.path.join(BASE, "reader.dpapi")
ENTROPY = b"tmmt-baton-hook-v1"


class Blob(ctypes.Structure):
    _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def protect(data):
    b1 = ctypes.create_string_buffer(data, len(data))
    b2 = ctypes.create_string_buffer(ENTROPY, len(ENTROPY))
    din = Blob(len(data), ctypes.cast(b1, ctypes.POINTER(ctypes.c_char)))
    ent = Blob(len(ENTROPY), ctypes.cast(b2, ctypes.POINTER(ctypes.c_char)))
    out = Blob()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(din), "tmmt baton hook", ctypes.byref(ent), None, None, 0x1, ctypes.byref(out)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def scram_verifier(password, iterations=4096):
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    client_key = hmac.new(salted, b"Client Key", hashlib.sha256).digest()
    stored_key = hashlib.sha256(client_key).digest()
    server_key = hmac.new(salted, b"Server Key", hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode()
    return "SCRAM-SHA-256$%d:%s$%s:%s" % (iterations, b64(salt), b64(stored_key), b64(server_key))


def main():
    if os.path.exists(TARGET) and "--rotate" not in sys.argv:
        print("credential already exists; pass --rotate to replace it", file=sys.stderr)
        return 2
    os.makedirs(BASE, exist_ok=True)
    password = secrets.token_urlsafe(32)
    cfg = {"user": "baton_reader.uapxakmlwnpfsftfeezx", "password": password,
           "host": "aws-1-us-west-2.pooler.supabase.com", "port": 5432, "database": "postgres"}
    with open(TARGET, "wb") as f:
        f.write(protect(json.dumps(cfg).encode()))
    print(scram_verifier(password))
    return 0


if __name__ == "__main__":
    sys.exit(main())
