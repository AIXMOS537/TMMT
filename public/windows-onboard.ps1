$ErrorActionPreference='SilentlyContinue'
$base = if($env:AIXMOS_BASE){$env:AIXMOS_BASE}else{'https://tmmt-ops.vercel.app'}
$here = $env:AIXMOS_KIT
Write-Host 'AIXMOS OPERATOR STATION - Powered by PROJECT X AIXMOS' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Installs ONLY the fenced operator toolkit (never the engine). No passwords taken. Nothing hidden.'
$c = Read-Host 'Type  I JOIN THE NETWORK  to continue'
if ($c.Trim().ToUpper() -ne 'I JOIN THE NETWORK'){ Write-Host 'Cancelled. Nothing changed.'; Start-Sleep 2; exit }
$name = Read-Host 'First name'; $email = Read-Host 'Email'
$dest = Join-Path $HOME 'AIXMOS-OPERATOR'; New-Item -ItemType Directory -Force -Path $dest | Out-Null
$localDir = if($here){ Join-Path $here 'operator-runtime' } else { '' }
$localTgz = if($here){ Join-Path $here 'operator-runtime.tar.gz' } else { '' }
if($localDir -and (Test-Path $localDir)){ Copy-Item -Recurse -Force $localDir $dest; Write-Host 'Installed from this kit (offline).' }
elseif($localTgz -and (Test-Path $localTgz)){ tar -xzf $localTgz -C $dest; Write-Host 'Installed from kit bundle.' }
else { $tgz = Join-Path $env:TEMP 'aixmos-rt.tgz'; try { Invoke-WebRequest -UseBasicParsing "$base/operator-runtime.tar.gz" -OutFile $tgz; tar -xzf $tgz -C $dest; Write-Host "Installed from $base." } catch { Write-Host 'Could not get the toolkit. Ask the owner to re-send the kit.'; exit 1 } }
New-Item -ItemType Directory -Force -Path (Join-Path $dest '.swarm') | Out-Null
'operator' | Set-Content (Join-Path $dest '.swarm\role'); "operator-$name" | Set-Content (Join-Path $dest '.swarm\machine')
$prof = Join-Path ([Environment]::GetFolderPath('Desktop')) "AIXMOS-operator-$name.txt"
"AIXMOS OPERATOR PROFILE`r`nname: $name`r`nemail: $email`r`nmachine: $env:COMPUTERNAME`r`nrole: operator (fenced)`r`nstatus: AWAITING OWNER ACTIVATION" | Set-Content $prof
Write-Host ''; Write-Host 'OPERATOR STATION READY (pending activation)' -ForegroundColor Green
Write-Host "1) Send $prof back to the owner.   2) Owner approves device + license."
Write-Host '3) Use Git Bash for the one-word commands (menu/work/guide), or just your work hub + GHL app.'
Read-Host 'Press ENTER to close'
