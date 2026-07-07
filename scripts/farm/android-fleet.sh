#!/usr/bin/env bash
# android-fleet — control the Android farm over the Tailscale mesh (legal-only: your own/authorized devices).
#   ./android-fleet.sh add 100.x.x.x        pair a phone (wireless ADB over mesh)
#   ./android-fleet.sh list                 show connected fleet
#   ./android-fleet.sh run "<adb shell cmd>"  run on ALL phones
#   ./android-fleet.sh install app.apk      push+install an APK to ALL
#   ./android-fleet.sh mirror 100.x.x.x     scrcpy screen-mirror one phone
set -uo pipefail
command -v adb >/dev/null || { echo "install adb: brew install android-platform-tools"; exit 1; }
case "${1:-}" in
  add)    adb connect "${2:?mesh IP:port, e.g. 100.1.2.3:5555}";;
  list)   adb devices -l;;
  run)    for d in $(adb devices | awk 'NR>1 && $2=="device"{print $1}'); do echo "── $d"; adb -s "$d" shell ${2:?cmd}; done;;
  install) for d in $(adb devices | awk 'NR>1 && $2=="device"{print $1}'); do echo "── $d"; adb -s "$d" install -r "${2:?apk}"; done;;
  mirror) command -v scrcpy >/dev/null || { echo "brew install scrcpy"; exit 1; }; scrcpy -s "${2:?mesh IP:port}";;
  *) echo "words: add <ip:port> | list | run \"<cmd>\" | install <apk> | mirror <ip:port>";;
esac
