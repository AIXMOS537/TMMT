# baseline-from-dump.ps1 - turn the live schema dump into THE migration baseline.
#
#   Prerequisite: scripts/backfill-schema.ps1 (or .sh) has been run, so
#   supabase/schema/live-baseline-<date>.sql exists.
#
#   .\scripts\baseline-from-dump.ps1              # build the baseline
#   .\scripts\baseline-from-dump.ps1 -ParkOld     # also park the 32 superseded files
#
# WHAT THIS DOES (all local, no network):
#   1. takes the newest supabase/schema/live-baseline-*.sql
#   2. writes supabase/migrations/<utc-now>_remote_schema_baseline.sql
#   3. prints the ONE remote command needed to make it safe
#
# WHY STEP 3 MATTERS - read this before you push anything:
#   The live database already contains this schema. If the baseline is not
#   recorded as applied, `supabase db push` will try to CREATE every table that
#   already exists. Recording it is what makes the file inert against prod.
#   That record is a write to production, so it is an OWNER GATE - this script
#   prints it and stops. It does not run it.

[CmdletBinding()]
param(
  [switch]$ParkOld,
  [string]$RepoRoot = 'C:\Users\AIXMOS\TMMT-canon'
)

$ErrorActionPreference = 'Stop'

$SchemaDir     = Join-Path $RepoRoot 'supabase\schema'
$MigrationsDir = Join-Path $RepoRoot 'supabase\migrations'
$ParkedDir     = Join-Path $MigrationsDir '_parked'
$Name          = 'remote_schema_baseline'

function Say($m,$c='Gray'){ Write-Host "  $m" -ForegroundColor $c }

Write-Host ''
Write-Host '  BASELINE FROM DUMP' -ForegroundColor Cyan
Write-Host '  ------------------' -ForegroundColor Cyan

# --- 1. find the dump ----------------------------------------------------
$dump = Get-ChildItem -Path $SchemaDir -Filter 'live-baseline-*.sql' -ErrorAction SilentlyContinue |
        Sort-Object Name | Select-Object -Last 1

if (-not $dump) {
  Say 'No dump found in supabase\schema\.' 'Red'
  Say 'Run scripts\backfill-schema.ps1 first - it prompts for the DB password.' 'Yellow'
  exit 1
}
if ($dump.Length -lt 40kb) {
  Say "Dump is only $([math]::Round($dump.Length/1kb,1)) KB - that is too small for a 224-migration schema." 'Red'
  Say 'Check the dump completed before baselining on top of it.' 'Yellow'
  exit 1
}
Say "dump      $($dump.Name)  ($([math]::Round($dump.Length/1kb,0)) KB)" 'Green'

# --- 2. version AFTER everything already applied -------------------------
# The baseline describes the CURRENT schema, so it must sort last. UTC-now is
# past every applied version, since the dump was taken moments ago.
$version = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$target  = Join-Path $MigrationsDir "${version}_$Name.sql"

$header = @"
-- ${version}_$Name.sql
-- Generated from $($dump.Name) by scripts/baseline-from-dump.ps1
--
-- This is the schema of record. It reflects the live database as of the dump
-- above, after 192 changes had been applied to production without ever being
-- written back to this repo.
--
-- It is recorded as ALREADY APPLIED on the live project. Do not re-run it
-- against production. New work goes in migrations dated after this one.

"@

New-Item -ItemType Directory -Force -Path $MigrationsDir | Out-Null
Set-Content -Path $target -Value ($header + (Get-Content $dump.FullName -Raw)) -Encoding UTF8
Say "baseline  supabase\migrations\${version}_$Name.sql" 'Green'

# --- 3. optionally park the superseded files -----------------------------
if ($ParkOld) {
  $old = Get-ChildItem $MigrationsDir -Filter '*.sql' | Where-Object { $_.Name -ne "${version}_$Name.sql" }
  if ($old) {
    New-Item -ItemType Directory -Force -Path $ParkedDir | Out-Null
    $old | ForEach-Object { Move-Item $_.FullName (Join-Path $ParkedDir $_.Name) -Force }
    Say "parked    $($old.Count) superseded migration files -> _parked\" 'Green'
    Say 'They are kept for history. The baseline supersedes them.' 'DarkGray'
  }
} else {
  $n = (Get-ChildItem $MigrationsDir -Filter '*.sql' | Where-Object { $_.Name -ne "${version}_$Name.sql" }).Count
  Say "note      $n older migration files left in place (re-run with -ParkOld to move them)" 'DarkGray'
}

# --- 4. the owner gate ---------------------------------------------------
Write-Host ''
Write-Host '  OWNER GATE - one remote write makes the baseline safe' -ForegroundColor Yellow
Write-Host '  -----------------------------------------------------' -ForegroundColor Yellow
Say 'Until this runs, `supabase db push` would try to recreate every existing' 'Yellow'
Say 'table on production. Do not push before it.' 'Yellow'
Write-Host ''
Say 'Option A - Supabase CLI (needs `supabase login` once):' 'White'
Write-Host "    npx supabase migration repair --status applied $version" -ForegroundColor DarkGray
Write-Host ''
Say 'Option B - paste in the dashboard SQL editor (no login needed):' 'White'
Write-Host "    insert into supabase_migrations.schema_migrations (version, name)" -ForegroundColor DarkGray
Write-Host "    values ('$version', '$Name')" -ForegroundColor DarkGray
Write-Host "    on conflict (version) do nothing;" -ForegroundColor DarkGray
Write-Host ''
Say 'Then verify it took, and only then commit:' 'White'
Write-Host '    npx supabase migration list        # baseline shows local AND remote' -ForegroundColor DarkGray
Write-Host '    git add supabase/migrations supabase/schema' -ForegroundColor DarkGray
Write-Host '    git commit -m "chore(db): baseline live schema as migration of record"' -ForegroundColor DarkGray
Write-Host ''
Say 'Branch first, and open a PR. No direct-to-master.' 'Yellow'
Write-Host ''
