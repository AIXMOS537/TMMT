#!/usr/bin/env bash
IP="${BRAINIAC_IP:-100.117.163.93}"
code="$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 4 "http://${IP}:11434/api/tags" 2>/dev/null || echo 000)"
echo "BRAINIAC $IP Ollama: $code"
