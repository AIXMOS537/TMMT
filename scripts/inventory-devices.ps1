# inventory-devices.ps1 — build a manifest of everything, before moving anything.
#
# WHY THIS EXISTS
#
# "Collect any and all information across any and all my devices" is not one job,
# it is two, and doing them in the wrong order is how people lose things:
#
#   1. INVENTORY  — find out what exists, where, how big, what kind. Read-only.
#   2. HARVEST    — decide what belongs in the brain, and move only that.
#
# This script is step 1 only. It reads metadata. It does not open files, does not
# copy them, does not move them, and does not delete anything. The output is a
# CSV manifest plus a summary you can actually read.
#
# WHY NOT JUST INGEST EVERYTHING
#
# Because a business knowledge base and a personal photo library are different
# things, and mixing them is not "more data", it is a poisoned corpus and a
# privacy problem. Family photos, medical documents and tax records do not make
# the credit-dispute engine smarter — they just end up embedded in a vector store
# that gets queried by agents. So the manifest classifies first, and a human
# decides what crosses over.
#
# USAGE
#   powershell -ExecutionPolicy Bypass -File scripts\inventory-devices.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\inventory-devices.ps1 -Roots "D:\","E:\"
#
# ASCII-only by deliberate choice: PS 5.1 silently fails to parse non-ASCII in
# automation scripts.

[CmdletBinding()]
param(
  [string[]]$Roots = @(),
  [string]$OutDir = "$env:USERPROFILE\.config\tmmt\inventory",
  [int]$MinSizeKB = 0
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

if (-not $Roots -or $Roots.Count -eq 0) {
  $Roots = @(
    "$env:USERPROFILE\OneDrive",
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Pictures",
    "$env:USERPROFILE\Videos",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Desktop",
    "C:\AI-Brain",
    "C:\Sync",
    "C:\AIXMOS-MEDIA-VAULT",
    "C:\dev"
  ) | Where-Object { Test-Path $_ }
}

# Directories that are never worth indexing: build output, dependency trees,
# caches. Skipping these is the difference between minutes and hours.
$SkipDirs = @(
  'node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'venv',
  'AppData', '.cache', 'Cache', 'CacheStorage', '.gradle', 'Library', 'site-packages',
  '.terraform', 'vendor', '.pytest_cache', 'obj', 'bin\Debug', 'bin\Release'
)

function Get-Category {
  param([string]$Ext)
  switch -Regex ($Ext.ToLower()) {
    '^\.(jpg|jpeg|png|heic|heif|gif|bmp|tiff|webp|raw|cr2|nef|dng)$' { 'image'; break }
    '^\.(mp4|mov|avi|mkv|wmv|flv|webm|m4v|mpg|mpeg|3gp)$'            { 'video'; break }
    '^\.(mp3|wav|m4a|aac|flac|ogg|wma|aiff|caf)$'                    { 'audio'; break }
    '^\.(pdf)$'                                                       { 'pdf'; break }
    '^\.(doc|docx|rtf|odt|pages)$'                                    { 'document'; break }
    '^\.(xls|xlsx|csv|tsv|numbers|ods)$'                              { 'spreadsheet'; break }
    '^\.(ppt|pptx|key|odp)$'                                          { 'presentation'; break }
    '^\.(md|txt|markdown|org|rst)$'                                   { 'text'; break }
    '^\.(json|jsonl|xml|yaml|yml|toml|ini|conf|sql)$'                 { 'data'; break }
    '^\.(ts|tsx|js|jsx|py|ps1|sh|bash|rb|go|rs|java|c|cpp|h|cs|php)$' { 'code'; break }
    '^\.(zip|tar|gz|7z|rar|bz2|xz|tgz)$'                              { 'archive'; break }
    '^\.(eml|msg|mbox)$'                                              { 'email'; break }
    default                                                            { 'other' }
  }
}

# Signals, not verdicts. A hit here means "a human should look before this is
# ingested", never "this is definitely sensitive" or "this is definitely business".
$SensitiveHints = @(
  'ssn','social security','passport','licen','tax','w-2','w2','1099','medical','health',
  'insurance card','bank','statement','routing','account number','paystub','pay stub',
  'birth certificate','visa','green card','id card','credential','password','secret',
  'private key','wallet','seed phrase','recovery'
)
$BusinessHints = @(
  'tmmt','aixmos','credit','dispute','fcra','croa','funding','rental','fleet','lease',
  'operator','partner','invoice','contract','sop','playbook','script','training',
  'onboarding','pipeline','vehicle','client','ghl','gohighlevel','airtable','supabase'
)
$PersonalHints = @(
  'family','wedding','birthday','vacation','holiday','kids','baby','school','graduation',
  'eid','ramadan','nikah','photos from','screenshot','img_','dsc_','whatsapp image'
)

function Test-AnyHint {
  param([string]$Text, [string[]]$Hints)
  foreach ($h in $Hints) { if ($Text.Contains($h)) { return $true } }
  return $false
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$manifest = Join-Path $OutDir "manifest-$stamp.csv"
$summary  = Join-Path $OutDir "summary-$stamp.md"

Write-Host "Inventory starting. Read-only - nothing will be copied, moved or deleted."
Write-Host "Manifest: $manifest"
Write-Host ""

$rows = New-Object System.Collections.Generic.List[object]
$skipPattern = ($SkipDirs | ForEach-Object { [regex]::Escape($_) }) -join '|'

foreach ($root in $Roots) {
  Write-Host ("Scanning {0} ..." -f $root) -NoNewline
  $count = 0
  try {
    Get-ChildItem -LiteralPath $root -File -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch "\\($skipPattern)\\" } |
      ForEach-Object {
        if ($MinSizeKB -gt 0 -and $_.Length -lt ($MinSizeKB * 1KB)) { return }
        $lower = $_.FullName.ToLower()
        $rows.Add([pscustomobject]@{
          Path       = $_.FullName
          Name       = $_.Name
          Category   = Get-Category $_.Extension
          Ext        = $_.Extension.ToLower()
          SizeBytes  = $_.Length
          Modified   = $_.LastWriteTime.ToString('yyyy-MM-dd')
          Root       = $root
          Business   = [int](Test-AnyHint $lower $BusinessHints)
          Personal   = [int](Test-AnyHint $lower $PersonalHints)
          Sensitive  = [int](Test-AnyHint $lower $SensitiveHints)
        })
        $count++
      }
  } catch {
    Write-Host (" ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    continue
  }
  Write-Host (" {0} files" -f $count)
}

$rows | Export-Csv -LiteralPath $manifest -NoTypeInformation -Encoding UTF8

# ---- summary -------------------------------------------------------------
function HumanSize { param([double]$b)
  if ($b -ge 1TB) { '{0:N1} TB' -f ($b/1TB) }
  elseif ($b -ge 1GB) { '{0:N1} GB' -f ($b/1GB) }
  elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b/1MB) }
  else { '{0:N0} KB' -f ($b/1KB) }
}

$total = $rows.Count
$totalBytes = ($rows | Measure-Object SizeBytes -Sum).Sum

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Device inventory - $(hostname)")
$lines.Add("")
$lines.Add("Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Read-only scan; nothing was moved.")
$lines.Add("")
$lines.Add("**$total files, $(HumanSize $totalBytes).**")
$lines.Add("")
$lines.Add("## By category")
$lines.Add("")
$lines.Add("| Category | Files | Size |")
$lines.Add("|---|---:|---:|")
$rows | Group-Object Category | Sort-Object { ($_.Group | Measure-Object SizeBytes -Sum).Sum } -Descending | ForEach-Object {
  $s = ($_.Group | Measure-Object SizeBytes -Sum).Sum
  $lines.Add(("| {0} | {1:N0} | {2} |" -f $_.Name, $_.Count, (HumanSize $s)))
}
$lines.Add("")
$lines.Add("## By location")
$lines.Add("")
$lines.Add("| Location | Files | Size |")
$lines.Add("|---|---:|---:|")
$rows | Group-Object Root | Sort-Object { ($_.Group | Measure-Object SizeBytes -Sum).Sum } -Descending | ForEach-Object {
  $s = ($_.Group | Measure-Object SizeBytes -Sum).Sum
  $lines.Add(("| {0} | {1:N0} | {2} |" -f $_.Name, $_.Count, (HumanSize $s)))
}
$lines.Add("")
$lines.Add("## Triage signals")
$lines.Add("")
$lines.Add("These are FILENAME hints only - a starting point for a human, not a verdict.")
$lines.Add("No file contents were read.")
$lines.Add("")
$b = ($rows | Where-Object Business -eq 1).Count
$p = ($rows | Where-Object Personal -eq 1).Count
$s = ($rows | Where-Object Sensitive -eq 1).Count
$lines.Add("| Signal | Files | Meaning |")
$lines.Add("|---|---:|---|")
$lines.Add("| Business | $b | Candidates for the knowledge base |")
$lines.Add("| Personal | $p | Family and private life - do NOT ingest |")
$lines.Add("| Sensitive | $s | IDs, financial, medical, credentials - review before anything |")
$lines.Add("")
$lines.Add("## Biggest business-signal files")
$lines.Add("")
$lines.Add("| Size | Modified | File |")
$lines.Add("|---:|---|---|")
$rows | Where-Object Business -eq 1 | Sort-Object SizeBytes -Descending | Select-Object -First 25 | ForEach-Object {
  $lines.Add(("| {0} | {1} | {2} |" -f (HumanSize $_.SizeBytes), $_.Modified, $_.Path))
}
$lines.Add("")
$lines.Add("## Next step")
$lines.Add("")
$lines.Add("Review the Sensitive and Personal counts BEFORE any harvest. Then filter the")
$lines.Add("manifest to the business set and feed only that to the brain ingester.")

Set-Content -LiteralPath $summary -Value ($lines -join "`r`n") -Encoding utf8

Write-Host ""
Write-Host ("Done. {0:N0} files, {1}." -f $total, (HumanSize $totalBytes))
Write-Host "Manifest: $manifest"
Write-Host "Summary:  $summary"
