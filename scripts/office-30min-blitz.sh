#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/one-shot.sh" "$@"
