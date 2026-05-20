# Install folder — plug-and-play agents

| File | Purpose |
|------|---------|
| **RUN-AGENTS.bat** | **Use every time** — installs agents, rules, skills (bypasses execution policy) |
| **INSTALL-ON-THIS-PC.bat** | **Once per PC (Admin)** — auto-run agents when USB is inserted |
| **PLUG-AND-PLAY.txt** | Short instructions |
| **Create-Root-Launchers.bat** | Copies `START-AGENTS.bat` to USB root if Windows allows |
| Register-UsbAutoRun.ps1 | Called by INSTALL-ON-THIS-PC |
| Invoke-OnVolumeAttach.ps1 | Auto-run trigger (do not double-click) |
| Set-UsbVolumeLabel.ps1 | Label drive `CURSOR-SETUP` (Admin) |

## Order of operations

1. `RUN-AGENTS.bat` on this PC now.
2. `INSTALL-ON-THIS-PC.bat` as Administrator for insert-and-go on future visits.
3. Reload Cursor after step 1.
