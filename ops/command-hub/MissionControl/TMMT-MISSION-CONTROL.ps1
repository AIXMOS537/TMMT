<#
  TMMT MISSION CONTROL — the one launcher (tablet).
  Built 2026-08-24. Replaces: START-TMMT-APP.bat, START-TMMT-OFFLINE-DEV.bat,
  START-CEO-COMMAND-CENTER.bat, HEALTH-CHECK.bat, Project Crimson Shadow.lnk.
  Rules honored:
    - CRIMSON SHADOW runs in its own lane. Nothing else owns it.
    - AIXMOS + HAIL MARY are separate tools driven as ONE TEAM via the
      canon entrypoint TMMT.ps1 (found by drive scan, never by letter).
#>

$ErrorActionPreference = 'SilentlyContinue'
$Crimson = 'C:\Users\AIXMOS\Automation\crimson-shadow\START-CRIMSON-SHADOW.bat'
$DevRoot = 'C:\Users\AIXMOS\CommandCenter\tmmt-os'
$Cloud   = 'https://tmmt-ops.vercel.app'
$HomeCC  = 'C:\Users\AIXMOS\CommandCenter\Home-Command-Center.html'
$Health  = 'C:\Users\AIXMOS\CommandCenter\HEALTH-CHECK.bat'

function Find-Canon {
  # Prefer the private master (label AIXMOS02), then any drive carrying the canon.
  $vols = Get-Volume | Where-Object DriveLetter
  foreach ($v in ($vols | Sort-Object { $_.FileSystemLabel -ne 'AIXMOS02' })) {
    $p = "$($v.DriveLetter):\TMMT\TMMT.ps1"
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Invoke-Canon([string[]]$CanonArgs) {
  $canon = Find-Canon
  if (-not $canon) {
    Write-Host ''
    Write-Host '  [!!] Canon drive not found. Plug in AIXMOS02 (or any stick carrying \TMMT).' -ForegroundColor Red
    return
  }
  Write-Host "  [--] canon: $canon" -ForegroundColor DarkGray
  & powershell -NoProfile -ExecutionPolicy Bypass -File $canon @CanonArgs
}

while ($true) {
  Clear-Host
  Write-Host ''
  Write-Host '  ================================================' -ForegroundColor DarkCyan
  Write-Host '            TMMT  MISSION  CONTROL' -ForegroundColor Cyan
  Write-Host '       one launcher - everything you run' -ForegroundColor DarkGray
  Write-Host '  ================================================' -ForegroundColor DarkCyan
  Write-Host ''
  Write-Host '  CRIMSON SHADOW          (its own lane)' -ForegroundColor Red
  Write-Host '   1  Start Crimson Shadow  - local voice assistant + browser UI'
  Write-Host ''
  Write-Host '  AIXMOS x HAIL MARY      (two tools, one team)' -ForegroundColor Cyan
  Write-Host '   2  TEAM UP     - AIXMOS brain up, then Hail Mary recovery check'
  Write-Host '   3  Status      - brain + vault guard + kit drives, one screen'
  Write-Host '   4  Recover     - Hail Mary repairs a kit drive'
  Write-Host '   5  Doctor      - full canon diagnostics'
  Write-Host ''
  Write-Host '  BUSINESS + HOME' -ForegroundColor Green
  Write-Host '   6  TMMT app (cloud)     - daily driver, low power'
  Write-Host '   7  TMMT offline dev     - local server when no internet'
  Write-Host '   8  Home Command Center  - family + friends + work screen'
  Write-Host '   9  Tablet health check'
  Write-Host ''
  Write-Host '  LOCAL AI               (offline, no internet needed)' -ForegroundColor Magenta
  Write-Host '   A  Chat MAX quality  - qwen7b-max   (best answers, ~6 GB RAM)'
  Write-Host '   B  Chat MAX speed    - qwen3b-max   (fast, ~3 GB RAM)'
  Write-Host '   C  Local AI status   - loaded models + RAM'
  Write-Host ''
  Write-Host '   0  Exit'
  Write-Host ''
  $c = Read-Host '  pick'
  switch ($c) {
    '1' {
      if (Test-Path $Crimson) { Start-Process cmd.exe -ArgumentList '/c', $Crimson -WorkingDirectory (Split-Path $Crimson) }
      else { Write-Host '  [!!] Crimson Shadow install not found.' -ForegroundColor Red; Start-Sleep 2 }
    }
    '2' { Invoke-Canon @('up'); Invoke-Canon @('status'); Read-Host '  enter to continue' }
    '3' { Invoke-Canon @('status'); Read-Host '  enter to continue' }
    '4' { Invoke-Canon @('recover'); Read-Host '  enter to continue' }
    '5' { Invoke-Canon @('doctor');  Read-Host '  enter to continue' }
    '6' { Start-Process $Cloud }
    '7' {
      $rental = 'C:\Users\AIXMOS\TMMT-canon'
      $devDir = if ((Test-Path "$rental\node_modules\next")) { $rental } elseif ((Test-Path "$DevRoot\node_modules\next")) { $DevRoot } else { $null }
      if ($devDir -and (Get-Command node)) {
        Start-Process cmd.exe -ArgumentList '/k', "cd /d `"$devDir`" && npm run dev"
        Start-Sleep 4
        Start-Process 'http://localhost:3000'
      } else { Write-Host '  [--] local dev copy or node missing - opening cloud.' -ForegroundColor DarkGray; Start-Process $Cloud; Start-Sleep 2 }
    }
    '8' { if (Test-Path $HomeCC) { Start-Process $HomeCC } }
    '9' { if (Test-Path $Health) { Start-Process cmd.exe -ArgumentList '/c', $Health } }
    { $_ -in 'a','A' } { Start-Process cmd.exe -ArgumentList '/k', 'title LOCAL AI - MAX QUALITY (offline) && ollama run qwen7b-max' }
    { $_ -in 'b','B' } { Start-Process cmd.exe -ArgumentList '/k', 'title LOCAL AI - MAX SPEED (offline) && ollama run qwen3b-max' }
    { $_ -in 'c','C' } {
      Write-Host ''; ollama ps; ollama list
      $os = Get-CimInstance Win32_OperatingSystem
      Write-Host ("  RAM free: {0:N1} GB of {1:N1} GB" -f ($os.FreePhysicalMemory/1MB), ($os.TotalVisibleMemorySize/1MB))
      Read-Host '  enter to continue'
    }
    '0' { return }
  }
}
