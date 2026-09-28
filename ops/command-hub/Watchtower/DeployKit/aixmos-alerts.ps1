# ============================================================
#  AIXMOS ALERTS
#  Runs on the hub. Watches the fleet and pushes your phone when a
#  machine goes DOWN, comes BACK, or a disk gets critically full.
#  Delivery: ntfy (free). Install the "ntfy" app, subscribe to the
#  topic printed by the installer.
# ============================================================
param(
  [string]$ApiUrl   = "http://127.0.0.1:8787",
  [string]$Topic,
  [string]$NtfyBase = "https://ntfy.sh",
  [int]$Every       = 30,
  [int]$DiskWarn    = 92,
  [int]$CpuWarn     = 90,
  [int]$CpuStreak   = 3
)

if (-not $Topic) {
  $tf = Join-Path $PSScriptRoot "alerts-topic.txt"
  if (Test-Path $tf) { $Topic = (Get-Content $tf -Raw).Trim() }
}
if (-not $Topic) { Write-Host "No ntfy topic set (alerts-topic.txt missing)."; exit 1 }

function Send-Alert($title, $msg, $tags, $priority) {
  # ntfy headers must be ASCII; emoji is delivered via Tags shortcodes instead
  $asciiTitle = ($title -replace '[^\x20-\x7E]', '').Trim()
  $bodyBytes  = [System.Text.Encoding]::UTF8.GetBytes($msg)
  try {
    Invoke-RestMethod -Uri "$NtfyBase/$Topic" -Method Post -Body $bodyBytes `
      -Headers @{ Title = $asciiTitle; Tags = $tags; Priority = "$priority" } -TimeoutSec 10 | Out-Null
  } catch {}
}

$state = @{}        # name -> online (bool)
$diskWarned = @{}   # name -> bool
$cpuStreak = @{}    # name -> consecutive high-cpu count
$cpuWarned = @{}    # name -> bool
$first = $true

Send-Alert "Fleet Watchtower" "Alerts are now armed. Watching the fleet." "satellite" "low"

while ($true) {
  try {
    $r = Invoke-RestMethod "$ApiUrl/api/fleet" -TimeoutSec 10
    foreach ($n in $r.nodes) {
      $name = $n.name
      $on   = [bool]$n.online

      if ($state.ContainsKey($name)) {
        if ($state[$name] -and -not $on) {
          Send-Alert "$name is DOWN" "$name dropped off the mesh at $((Get-Date).ToString('HH:mm'))." "rotating_light" "high"
        } elseif (-not $state[$name] -and $on) {
          Send-Alert "$name is back online" "$name reconnected at $((Get-Date).ToString('HH:mm'))." "white_check_mark" "default"
        }
      }
      $state[$name] = $on

      # disk pressure (only when an agent is reporting)
      if ($on -and $n.hasAgent -and $n.diskPct -ne $null) {
        $dp = [int]$n.diskPct
        if ($dp -ge $DiskWarn -and -not $diskWarned[$name]) {
          Send-Alert "$name disk almost full" "$name is at $dp% disk used ($([int]$n.diskFreeGB) GB free)." "warning" "high"
          $diskWarned[$name] = $true
        } elseif ($dp -lt ($DiskWarn - 5)) {
          $diskWarned[$name] = $false
        }
      }

      # sustained high CPU (avoids one-off spikes)
      if ($on -and $n.hasAgent -and $n.cpu -ne $null) {
        $cp = [int]$n.cpu
        if ($cp -ge $CpuWarn) { $cpuStreak[$name] = ([int]$cpuStreak[$name]) + 1 } else { $cpuStreak[$name] = 0 }
        if ([int]$cpuStreak[$name] -ge $CpuStreak -and -not $cpuWarned[$name]) {
          $mins = [int]($CpuStreak * $Every / 60)
          Send-Alert "$name CPU pegged" "$name CPU has been at $cp% for ${mins}+ min." "fire" "high"
          $cpuWarned[$name] = $true
        } elseif ($cp -lt ($CpuWarn - 15)) {
          $cpuWarned[$name] = $false
        }
      }
    }
    $first = $false
  } catch {}
  Start-Sleep -Seconds $Every
}
