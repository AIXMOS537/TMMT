# ============================================================
#  fix-brainiac-flapping.ps1
#  RUN THIS ON brainiac-7, AS ADMINISTRATOR.
#
#  Stops a Windows machine dropping off the Tailscale mesh.
#  Five real causes, in the order they actually bite:
#    1. Tailscale not in unattended mode  -> drops at logout/lock
#    2. Machine sleeps                    -> drops after idle
#    3. Wi-Fi adapter power saving        -> radio parked
#    4. Tailscale service not automatic   -> never comes back
#    5. Fast Startup                      -> networking half-restored
#
#  Run with -Report to only LOOK, change nothing.
# ============================================================
param([switch]$Report)

$ErrorActionPreference = 'SilentlyContinue'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

function Hd($t)  { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t)  { Write-Host '  [ OK ] ' -ForegroundColor Green  -NoNewline; Write-Host $t }
function Fix($t) { Write-Host '  [FIXED] ' -ForegroundColor Cyan  -NoNewline; Write-Host $t }
function Bad($t) { Write-Host '  [ !! ] ' -ForegroundColor Red    -NoNewline; Write-Host $t }
function Note($t){ Write-Host '         ' -NoNewline; Write-Host $t -ForegroundColor DarkGray }

Hd "TAILSCALE STABILITY FIX  -  $env:COMPUTERNAME"
if ($Report) { Note 'REPORT MODE - looking only, changing nothing.' }
if (-not $isAdmin -and -not $Report) {
    Bad 'Not running as Administrator. Right-click PowerShell > Run as administrator.'
    Note 'Or run with -Report to just see what is wrong.'
    exit 1
}

# ---- 1. Tailscale unattended mode -------------------------------------
Hd '1. Tailscale unattended mode'
Note 'Without this, Windows disconnects Tailscale when you log out or lock.'
$pref = & 'C:\Program Files\Tailscale\tailscale.exe' debug prefs 2>$null | Out-String
$unattended = $false
if ($pref -match '"ForceDaemon"\s*:\s*true') { $unattended = $true }
if ($unattended) {
    Ok 'Already on - Tailscale stays up when nobody is logged in.'
} elseif ($Report) {
    Bad 'OFF - this is the most likely cause of the flapping.'
} else {
    & 'C:\Program Files\Tailscale\tailscale.exe' up --unattended 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $pref2 = & 'C:\Program Files\Tailscale\tailscale.exe' debug prefs 2>$null | Out-String
    if ($pref2 -match '"ForceDaemon"\s*:\s*true') { Fix 'Unattended mode enabled.' }
    else { Bad 'Could not enable it. Run manually:  tailscale up --unattended' }
}

# ---- 2. Sleep / hibernate ---------------------------------------------
Hd '2. Sleep and hibernate (on wall power)'

# Modern Standby (S0) with "Network Connected" keeps the mesh alive while asleep.
# Classic S3 sleep does not. The advice differs, so detect which one this is.
$sleepStates = (powercfg /a 2>$null | Out-String)
$s0NetworkUp = $sleepStates -match 'S0 Low Power Idle\) Network Connected'
if ($s0NetworkUp) {
    Note 'This machine uses Modern Standby (S0) and stays network-connected while asleep.'
    Note 'So sleeping is much less likely to be what drops the mesh here.'
}

$sa = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 2>$null | Select-String 'Current AC Power Setting Index')
$acSleep = if ($sa -match '0x([0-9a-f]+)') { [Convert]::ToInt32($Matches[1], 16) } else { $null }

if ($null -eq $acSleep) {
    Note 'Could not read the sleep timeout.'
} elseif ($acSleep -eq 0) {
    Ok 'Already set to never sleep on AC power.'
} elseif ($s0NetworkUp) {
    Ok "Sleeps after $([math]::Round($acSleep/60)) min on AC, but stays network-connected. Leaving it alone."
    Note 'Change it only if this box still drops while asleep.'
} elseif ($Report) {
    Bad "Sleeps after $([math]::Round($acSleep/60)) minutes idle on AC - on this machine that DOES drop the mesh."
} else {
    powercfg /change standby-timeout-ac 0   2>&1 | Out-Null
    powercfg /change hibernate-timeout-ac 0 2>&1 | Out-Null
    powercfg /change monitor-timeout-ac 15  2>&1 | Out-Null
    Fix 'Never sleeps on AC now. Screen still turns off after 15 min (that is fine).'
    Note 'Battery settings left alone on purpose - sleeping on battery is correct.'
}

# ---- 3. Wi-Fi adapter power management --------------------------------
Hd '3. Wi-Fi adapter power saving'
# The registry value is what actually persists. Set-NetAdapterPowerManagement
# can report success on drivers that silently ignore it (e.g. Marvell AVASTAR),
# so we write the registry and then VERIFY, rather than trusting the cmdlet.
$NETCLASS = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
$adapters = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' })
if (-not $adapters) { Note 'No active physical adapters found.' }
foreach ($a in $adapters) {
    $key = Get-ChildItem $NETCLASS -ErrorAction SilentlyContinue |
           Where-Object { (Get-ItemProperty $_.PSPath -Name NetCfgInstanceId -ErrorAction SilentlyContinue).NetCfgInstanceId -eq $a.InterfaceGuid } |
           Select-Object -First 1
    if (-not $key) {
        Note "$($a.Name): no registry entry found (cannot check or change power saving)."
        continue
    }
    $cap = (Get-ItemProperty $key.PSPath -Name PnPCapabilities -ErrorAction SilentlyContinue).PnPCapabilities
    $already = ($null -ne $cap -and ($cap -band 0x18))

    if ($already) { Ok "$($a.Name): power saving already off."; continue }
    if ($Report)  { Bad "$($a.Name): Windows is allowed to power this adapter down."; continue }

    $newCap = if ($null -eq $cap) { 0x18 } else { ($cap -bor 0x18) }
    Set-ItemProperty -Path $key.PSPath -Name PnPCapabilities -Value $newCap -Type DWord -ErrorAction SilentlyContinue
    # Read it straight back - never claim success we have not confirmed.
    $check = (Get-ItemProperty $key.PSPath -Name PnPCapabilities -ErrorAction SilentlyContinue).PnPCapabilities
    if ($null -ne $check -and ($check -band 0x18)) {
        Fix "$($a.Name): power saving disabled (PnPCapabilities=$check). Takes effect after reboot."
    } else {
        Bad "$($a.Name): could NOT write the setting - are you running as Administrator?"
    }
}

# ---- 4. Tailscale service ---------------------------------------------
Hd '4. Tailscale service'
$svc = Get-Service Tailscale -ErrorAction SilentlyContinue
if (-not $svc) {
    Bad 'Tailscale service not found - is Tailscale installed?'
} else {
    $start = (Get-CimInstance Win32_Service -Filter "Name='Tailscale'").StartMode
    if ($start -eq 'Auto') { Ok "Service start mode: Automatic. Currently $($svc.Status)." }
    elseif ($Report)       { Bad "Service start mode is $start - it will not come back on its own." }
    else {
        Set-Service -Name Tailscale -StartupType Automatic
        if ($svc.Status -ne 'Running') { Start-Service Tailscale }
        Fix 'Service set to Automatic and running.'
    }
}

# ---- 5. Fast Startup ---------------------------------------------------
Hd '5. Fast Startup'
Note 'Fast Startup can leave networking half-initialised after a shutdown.'
$hb = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name HiberbootEnabled -ErrorAction SilentlyContinue).HiberbootEnabled
if ($hb -eq 0) {
    Ok 'Already disabled.'
} elseif ($Report) {
    Bad 'Enabled - can cause the mesh to not come back after a shutdown.'
} else {
    Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name HiberbootEnabled -Value 0
    Fix 'Fast Startup disabled.'
}

Hd 'DONE'
if ($Report) {
    Write-Host '  That was report mode. To actually apply the fixes:' -ForegroundColor Yellow
    Write-Host '    right-click PowerShell > Run as administrator, then run this again with no flags.'
} else {
    Write-Host '  Reboot when convenient so every change takes hold.' -ForegroundColor Yellow
    Write-Host '  Then from the tablet, watch it with:  ops flaps' -ForegroundColor DarkGray
}
Write-Host ''
