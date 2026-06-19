$ErrorActionPreference='SilentlyContinue'
Write-Host 'AIXMOS OPERATOR STATION - Powered by PROJECT X AIXMOS' -ForegroundColor Cyan
Write-Host ''
Write-Host 'WHAT THIS DOES: installs the operator toolkit to ~/AIXMOS-OPERATOR, registers you as a FENCED operator (the owner holds the keys and licensing), and prepares this PC to join PROJECT X AIXMOS network (the owner approves your device). No passwords taken. Nothing hidden.'
$c = Read-Host 'Type  I JOIN THE NETWORK  to continue'
if ($c.Trim().ToUpper() -ne 'I JOIN THE NETWORK'){ Write-Host 'Cancelled. Nothing changed.'; Start-Sleep 2; exit }
$name = Read-Host 'First name'; $email = Read-Host 'Email'
if(-not (Get-Command git -ErrorAction SilentlyContinue)){ Write-Host 'Installing Git (one-time)...'; winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements }
$dir = Join-Path $HOME 'AIXMOS-OPERATOR'
git clone --depth 1 https://github.com/AIXMOS537/TMMT.git "$dir" 2>$null
New-Item -ItemType Directory -Force -Path (Join-Path $dir '.swarm') | Out-Null
'operator' | Set-Content (Join-Path $dir '.swarm\role')
"operator-$name" | Set-Content (Join-Path $dir '.swarm\machine')
$prof = Join-Path ([Environment]::GetFolderPath('Desktop')) "AIXMOS-operator-$name.txt"
"AIXMOS OPERATOR PROFILE`r`nname: $name`r`nemail: $email`r`nmachine: $env:COMPUTERNAME`r`nrole: operator (fenced)`r`nstatus: AWAITING OWNER ACTIVATION" | Set-Content $prof
Write-Host ''
Write-Host 'OPERATOR STATION READY (pending activation)' -ForegroundColor Green
Write-Host "1) Send $prof back to the owner."
Write-Host '2) Owner approves your device + activates your license.'
Write-Host '3) Install Tailscale: https://tailscale.com/download'
Write-Host '4) Use Git Bash for the one-word commands after activation.'
Read-Host 'Press ENTER to close'
