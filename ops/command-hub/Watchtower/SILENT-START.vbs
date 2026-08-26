' Starts the Fleet Watchtower server fully hidden (no window, no browser).
Set sh = CreateObject("WScript.Shell")
base = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & base & "fleet-watchtower.ps1"" -NoBrowser", 0, False
