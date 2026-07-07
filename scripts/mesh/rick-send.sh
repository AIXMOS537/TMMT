#!/usr/bin/env bash
exec bash "$(dirname "$0")/../m1-door.sh" send "$@"
