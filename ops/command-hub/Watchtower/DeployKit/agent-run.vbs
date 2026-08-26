' Launches the AIXMOS agent fully hidden (no window).
Set sh = CreateObject("WScript.Shell")
base = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & base & "aixmos-agent.ps1""", 0, False
