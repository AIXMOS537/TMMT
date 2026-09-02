<#
  backfill-schema.ps1 - make this repo able to rebuild the live database.

  The problem it solves: on 2026-09-01 the live database had 224 applied
  migrations and this repo had 32 migration files. 192 changes went straight to
  production and were never written back, so a clean checkout could not
  reproduce the schema it talks to.

  This pulls the authoritative schema out of the live database with pg_dump
  (via the Supabase CLI) and writes it into supabase/schema/ as a baseline.

    .\scripts\backfill-schema.ps1              # dump schema + roles
    .\scripts\backfill-schema.ps1 -Verify      # also diff against the last baseline

  YOUR PASSWORD NEVER LEAVES THIS MACHINE. It is read with Read-Host -AsSecureString,
  passed straight to the CLI, and never written to disk, logged, or echoed.
  Get it from: Supabase dashboard - Project Settings - Database - Database password.
  (If you have never set one, use "Reset database password" there. Resetting it
  breaks any service using the direct connection string, so check before you do.)
#>
[CmdletBinding()]
param(
  [switch]$Verify,
  [string]$ProjectRef = 'uapxakmlwnpfsftfeezx',
  [string]$PoolerHost = 'aws-1-us-west-2.pooler.supabase.com',
  [int]   $PoolerPort = 5432
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$OutDir   = Join-Path $RepoRoot 'supabase\schema'
$Stamp    = Get-Date -Format 'yyyy-MM-dd'

function Hd($t) { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t) { Write-Host '  [ OK ] ' -ForegroundColor Green  -NoNewline; Write-Host $t }
function Bad($t){ Write-Host '  [FAIL] ' -ForegroundColor Red    -NoNewline; Write-Host $t }
function Note($t){ Write-Host "  $t" -ForegroundColor DarkGray }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Hd 'BACKFILL CANON FROM LIVE'
Note "project   $ProjectRef"
Note "output    $OutDir"

# --- password, held only in memory -----------------------------------------
Write-Host ''
Write-Host '  Database password (input hidden): ' -ForegroundColor White -NoNewline
$secure = Read-Host -AsSecureString
$bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $plain) { Bad 'no password given - nothing done.'; exit 1 }

# The password goes in the URL, so percent-encode it: a '#', '@' or '/' in the
# password silently truncates the connection string otherwise.
$escaped = [uri]::EscapeDataString($plain)
$dbUrl   = "postgresql://postgres.${ProjectRef}:${escaped}@${PoolerHost}:${PoolerPort}/postgres"

try {
  # --- schema ---------------------------------------------------------------
  $schemaFile = Join-Path $OutDir "live-baseline-$Stamp.sql"
  Hd 'DUMPING SCHEMA'
  Note 'public schema only - auth/storage/realtime belong to the platform'
  & npx --yes supabase@2.116.0 db dump --db-url $dbUrl --schema public -f $schemaFile
  if ($LASTEXITCODE -ne 0) { Bad 'schema dump failed - check the password and try again.'; exit 1 }
  Ok "schema  -> $schemaFile  ($([math]::Round((Get-Item $schemaFile).Length/1KB)) KB)"

  # --- roles and grants -----------------------------------------------------
  # The REVOKE/GRANT hardening is a real part of this system's security model.
  # A schema-only dump does not carry it, so it is pulled separately.
  $rolesFile = Join-Path $OutDir "live-roles-$Stamp.sql"
  Hd 'DUMPING ROLES AND GRANTS'
  & npx --yes supabase@2.116.0 db dump --db-url $dbUrl --role-only -f $rolesFile
  if ($LASTEXITCODE -eq 0) {
    Ok "roles   -> $rolesFile"
  } else {
    Write-Host '  [warn] ' -ForegroundColor Yellow -NoNewline
    Write-Host 'role dump failed (non-fatal) - the schema dump is still good.'
  }
}
finally {
  # Do not leave the credential sitting in a variable for the rest of the session.
  $plain = $null; $escaped = $null; $dbUrl = $null
  [System.GC]::Collect()
}

# --- verify ------------------------------------------------------------------
if ($Verify) {
  Hd 'VERIFY'
  $baselines = @(Get-ChildItem $OutDir -Filter 'live-baseline-*.sql' | Sort-Object Name)
  if ($baselines.Count -lt 2) {
    Note 'only one baseline so far - nothing to diff against yet.'
  } else {
    $prev = $baselines[-2]; $curr = $baselines[-1]
    $d = git diff --no-index --stat -- $prev.FullName $curr.FullName 2>&1
    if (-not $d) { Ok "no schema change since $($prev.Name)" }
    else { Write-Host '  schema changed since the last baseline:' -ForegroundColor Yellow; $d | ForEach-Object { Write-Host "    $_" } }
  }
}

Hd 'NEXT'
Write-Host '  1. Read the diff before you commit it - this is the whole schema.' -ForegroundColor Gray
Write-Host '  2. git add supabase/schema && git commit   (owner gate: no blind push)' -ForegroundColor Gray
Write-Host '  3. Re-run after any migration lands live, so canon never drifts again.' -ForegroundColor Gray
Write-Host ''
Write-Host '  To make this the migration baseline instead of a reference dump:' -ForegroundColor DarkGray
Write-Host '    supabase migration new baseline   # then paste the dump in' -ForegroundColor DarkGray
Write-Host '    supabase migration repair --status applied <that version>' -ForegroundColor DarkGray
Write-Host '  Repair marks it applied so it is never replayed against production.' -ForegroundColor DarkGray
Write-Host ''
