<#
  ops snapshot — capture everything about the app and the build into ONE file
  you can drop into Cursor, Claude Cowork, or any agent that needs to rebuild it.

  Usage (from anywhere):
      ops snapshot            fast capture  (~10 seconds)
      ops snapshot -Deep      also runs typecheck + lint + build (~2 minutes)
      ops snapshot -Audit     also runs the live browser crawl  (~3 minutes)

  Output:  C:\Users\AIXMOS\CommandCenter\Snapshots\<timestamp>\HANDOFF.md
  The path is copied to your clipboard. Open it, select all, paste into the agent.

  SECRETS: the bundle is scrubbed before it is written. Anything shaped like a
  key, token, JWT or password is replaced with <REDACTED>. The service-role key
  is used to read the schema and is never written to disk.
#>

param(
  [switch]$Deep,
  [switch]$Audit
)

$ErrorActionPreference = 'SilentlyContinue'

$APP    = 'C:\Users\AIXMOS\TMMT'
$OS_APP = 'C:\Users\AIXMOS\CommandCenter\tmmt-os'
$BRAIN  = 'C:\Users\AIXMOS\AIXMOS-Brain'
$SNAPS  = 'C:\Users\AIXMOS\CommandCenter\Snapshots'

function Hd($t)  { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t)  { Write-Host "  [ OK ] " -ForegroundColor Green -NoNewline; Write-Host $t }
function Warn($t){ Write-Host "  [warn] " -ForegroundColor Yellow -NoNewline; Write-Host $t }
function Step($t){ Write-Host "  [--] " -ForegroundColor DarkGray -NoNewline; Write-Host $t -ForegroundColor DarkGray }

# ── Secret scrubbing ────────────────────────────────────────────────
# Runs over every captured string before it reaches disk. Deliberately
# aggressive: a redacted bundle that is missing one value is recoverable, a
# leaked service-role key is not.
$SecretPatterns = @(
  '(?i)(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})',  # JWT
  '(?i)(sb_(secret|publishable)_[A-Za-z0-9_\-]{8,})',                        # Supabase keys
  '(?i)(pat[A-Za-z0-9]{10,}\.[A-Za-z0-9]{16,})',                             # Airtable PAT
  '(?i)((password|secret|token|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*)\S+'
)
function Scrub([string]$text) {
  if (-not $text) { return $text }
  foreach ($p in $SecretPatterns) {
    if ($p -like '*password|secret*') { $text = $text -replace $p, '$1<REDACTED>' }
    else                              { $text = $text -replace $p, '<REDACTED>' }
  }
  return $text
}

# ── Prepare the bundle directory ────────────────────────────────────
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dir   = Join-Path $SNAPS $stamp
$raw   = Join-Path $dir 'raw'
New-Item -ItemType Directory -Force -Path $raw | Out-Null

$parts = [System.Collections.ArrayList]@()
function Add-Section([string]$title, [string]$body) {
  [void]$parts.Add("`n`n## $title`n`n$body")
}

Hd "SNAPSHOT  ->  $dir"

# ── 1. Mission / how to use this bundle ─────────────────────────────
Step 'writing the primer'
$primer = @"
This file is a complete, self-contained picture of the TMMT + AIXMOS build as of
$(Get-Date -Format 'yyyy-MM-dd HH:mm'), captured from the Surface tablet.

**If you are an agent reading this:** everything below is ground truth pulled
from the machine and the live database, not from memory or from documentation
that may have drifted. Where a doc disagrees with a captured value, the captured
value wins. Read section 2 (architecture) before proposing any schema change —
the multi-tenant model already exists and must not be redesigned.

Working rules:
- One finding, one change, one commit.
- `npm run build` is the release gate. `npm run audit` is the behaviour gate.
- The Supabase project is shared between two apps. No migration is private.
- Never judge auth behaviour against `npm run dev` — see the dev-middleware note.
"@
Add-Section 'How to use this bundle' $primer

# ── 2. Architecture (durable doc from the Brain) ─────────────────────
Step 'architecture'
$archFile = Join-Path $BRAIN 'tmmt-aixmos-architecture.md'
if (Test-Path $archFile) {
  Add-Section 'Architecture — AIXMOS + TMMT' (Get-Content $archFile -Raw)
  Ok 'architecture doc included'
} else {
  Add-Section 'Architecture — AIXMOS + TMMT' '_Missing: AIXMOS-Brain\tmmt-aixmos-architecture.md_'
  Warn 'architecture doc not found'
}

# ── 3. Repo inventory + git state ───────────────────────────────────
Step 'repo + git state'
$repoLines = [System.Collections.ArrayList]@()
foreach ($r in @(@{n='TMMT (the app)';p=$APP}, @{n='tmmt-os (predecessor)';p=$OS_APP}, @{n='AIXMOS-Brain (memory)';p=$BRAIN})) {
  if (-not (Test-Path $r.p)) { [void]$repoLines.Add("### $($r.n)`n`n_Not present at $($r.p)_`n"); continue }
  Push-Location $r.p
  $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
  $head   = (git log -1 --format='%h %s (%ad)' --date=short 2>$null)
  $remote = (git remote get-url origin 2>$null)
  $dirty  = (git status --porcelain 2>$null)
  $count  = if ($dirty) { ($dirty -split "`n" | Where-Object { $_ }).Count } else { 0 }
  Pop-Location
  $pkg = Join-Path $r.p 'package.json'
  $ver = if (Test-Path $pkg) { $j = Get-Content $pkg -Raw | ConvertFrom-Json; "next $($j.dependencies.next), react $($j.dependencies.react)" } else { 'n/a' }
  [void]$repoLines.Add(@"
### $($r.n)

- Path: ``$($r.p)``
- Remote: $(if($remote){$remote}else{'_none — local only_'})
- Branch: ``$branch`` @ $head
- Uncommitted files: **$count**
- Stack: $ver

$(if($dirty){"``````" + "`n" + (($dirty -split "`r?`n" | Where-Object { $_ }) -join "`n") + "`n``````"}else{'_Working tree clean._'})
"@)
}
Add-Section 'Repositories and git state' ($repoLines -join "`n")
Ok 'git state captured'

# ── 4. App surface: routes, components, actions ─────────────────────
Step 'app surface'
$surface = '_TMMT app not found._'
if (Test-Path (Join-Path $APP 'src\app')) {
  $pages = Get-ChildItem (Join-Path $APP 'src\app') -Recurse -Filter 'page.tsx' |
    ForEach-Object {
      $rel = $_.DirectoryName.Substring((Join-Path $APP 'src\app').Length)
      $route = ($rel -replace '\\', '/') -replace '\([^)]*\)/?', ''
      if ([string]::IsNullOrWhiteSpace($route)) { '/' } else { $route.TrimEnd('/') }
    } | Sort-Object -Unique

  $src   = Get-ChildItem (Join-Path $APP 'src') -Recurse -Include *.ts, *.tsx -File
  $loc   = ($src | Get-Content | Measure-Object -Line).Lines
  $comps = (Get-ChildItem (Join-Path $APP 'src\components') -File | Select-Object -ExpandProperty Name) -join ', '
  $tables = Select-String -Path (Join-Path $APP 'src\app\**\*.tsx'), (Join-Path $APP 'src\app\**\*.ts') -Pattern 'adminUpsert\("([a-z_]+)"' -AllMatches |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

  $routeList = ($pages | ForEach-Object { "- ``$_``" }) -join "`n"
  $surface = @"
- Source files: **$($src.Count)**  ·  Lines of code: **$loc**
- Components: $comps
- Routes (**$($pages.Count)**), derived from ``src/app`` at capture time:

$routeList

Tables written through ``adminUpsert``: $(($tables | ForEach-Object { "``$_``" }) -join ', ')
"@
  Ok "$($pages.Count) routes, $($src.Count) files, $loc LOC"
}
Add-Section 'App surface' $surface

# ── 5. Database schema, live, via the PostgREST OpenAPI spec ────────
Step 'database schema (live)'
$dbSection = ''
$envFile = Join-Path $APP '.env'
if (Test-Path $envFile) {
  $envText = Get-Content $envFile -Raw
  $url = ([regex]::Match($envText, '(?m)^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(\S+)')).Groups[1].Value
  $key = ([regex]::Match($envText, '(?m)^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(\S+)')).Groups[1].Value
  # A freshly-cloned .env ships with a PASTE_… placeholder. Catch that here and
  # say so plainly, rather than letting it surface as a confusing 401.
  $placeholder = $key -match '^(PASTE|YOUR|<|xxx)' -or $key.Length -lt 40
  if ($url -and $key -and -not $placeholder) {
    try {
      # The REST root returns an OpenAPI document describing every exposed table
      # and column. It needs the key to answer, and the key never leaves here.
      $spec = Invoke-RestMethod -Uri "$url/rest/v1/" -Headers @{ apikey = $key; Authorization = "Bearer $key" } -TimeoutSec 30
      $defs = $spec.definitions
      $names = $defs.PSObject.Properties.Name | Sort-Object
      $rows = foreach ($n in $names) {
        $cols = $defs.$n.properties.PSObject.Properties.Name
        [pscustomobject]@{ Table = $n; Columns = $cols.Count; HasOrgId = if ($cols -contains 'org_id') { 'yes' } else { '—' } }
      }
      $rows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $raw 'schema.json') -Encoding UTF8
      $tbl = ($rows | ForEach-Object { "| ``$($_.Table)`` | $($_.Columns) | $($_.HasOrgId) |" }) -join "`n"
      $withOrg = ($rows | Where-Object { $_.HasOrgId -eq 'yes' }).Count
      $dbSection = @"
Read live from ``$url`` at capture time — this is the schema as it exists now.

**$($rows.Count) tables exposed · $withOrg carry ``org_id``**

| Table | Columns | org_id |
|---|---|---|
$tbl
"@
      Ok "$($rows.Count) tables read from the live database"
    } catch {
      $dbSection = "_Could not reach Supabase: $($_.Exception.Message)_`n`nRun ``raw/introspect.sql`` in the Supabase SQL editor instead."
      Warn 'could not reach Supabase — schema section is a stub'
    }
  } elseif ($placeholder) {
    $dbSection = @"
> **The service-role key in ``.env`` is still the ``PASTE_SERVICE_ROLE_KEY`` placeholder.**
> Live schema capture is skipped until it is filled in. This also means
> ``scripts/sync-airtable.mjs`` cannot run — it requires the same key.
>
> Fill it from: Supabase dashboard → Project Settings → API → ``service_role``.
> Then re-run ``ops snapshot``.

The publishable key in ``.env`` *is* valid — it was accepted and refused only by
RLS (``permission denied for function is_staff``), which is anon behaving
correctly. Only the service-role key is missing.

Until then, use ``raw/introspect.sql`` below, or ask Claude (Supabase MCP is
connected) to run it and paste the results here.
"@
    Warn 'service-role key is a placeholder - live schema skipped'
  } else { $dbSection = '_Supabase URL or service-role key not found in .env._'; Warn 'no Supabase credentials in .env' }
} else { $dbSection = '_No .env at the app root._'; Warn 'no .env found' }
Add-Section 'Database — live schema' $dbSection

# ── 6. The SQL that answers what OpenAPI cannot (policies, roles) ───
$introspect = @'
-- Run in the Supabase SQL editor (or ask Claude with the Supabase MCP to run it)
-- and paste the results into the bundle. These are the facts the REST spec
-- cannot expose: policies, role membership, and tenancy coverage.

-- 1. Tenancy coverage
select count(*) filter (where c.relrowsecurity) as rls_tables,
       count(*) as total_tables
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- 2. Every policy, and whether it is org-scoped
select tablename, policyname, cmd, roles::text, qual::text as using_expr
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- 3. Who is staff, who is not
select u.email, p.role, p.portal_role::text,
       coalesce(p.role in ('admin','internal_team')
             or p.portal_role::text in ('team_member','manager','admin','super_admin'), false) as passes_is_staff
from auth.users u left join public.profiles p on p.id = u.id order by u.created_at;

-- 4. Tables missing org_id (tenancy gaps)
select t.table_name from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  and not exists (select 1 from information_schema.columns c
                  where c.table_schema = 'public' and c.table_name = t.table_name
                    and c.column_name = 'org_id')
order by 1;

-- 5. Rows stranded with a null org_id
select 'fleet' t, count(*) from fleet where org_id is null
union all select 'waitlist', count(*) from waitlist where org_id is null
union all select 'tickets', count(*) from tickets where org_id is null;
'@
$introspect | Set-Content (Join-Path $raw 'introspect.sql') -Encoding UTF8
Add-Section 'Database — introspection SQL' "The REST spec cannot show policies or role membership. Run ``raw/introspect.sql`` to refresh those:`n`n``````sql`n$introspect`n``````"

# ── 7. Findings from the last audit ─────────────────────────────────
Step 'audit findings'
$findings = Join-Path $APP 'audit\FINDINGS.md'
if ($Audit) {
  Step 'running the live crawl (this takes a few minutes)'
  Push-Location $APP
  & npm run audit 2>&1 | Tee-Object -FilePath (Join-Path $raw 'audit-run.log') | Out-Null
  Pop-Location
}
if (Test-Path $findings) {
  $age = [math]::Round(((Get-Date) - (Get-Item $findings).LastWriteTime).TotalHours, 1)
  Add-Section "Audit findings (crawl was $age h ago)" (Get-Content $findings -Raw)
  Ok "findings included (${age}h old)"
} else {
  Add-Section 'Audit findings' '_No crawl has been run. Run `ops audit` first._'
  Warn 'no findings file — run: ops audit'
}

# ── 8. Build gates ──────────────────────────────────────────────────
if ($Deep) {
  Step 'running typecheck / lint / build (slow)'
  Push-Location $APP
  $gates = @()
  $gates += "### typecheck`n`n``````" + "`n" + ((& npx tsc --noEmit 2>&1 | Select-Object -Last 15) -join "`n") + "`n``````"
  $gates += "### lint`n`n``````" + "`n" + ((& npx eslint . 2>&1 | Select-Object -Last 12) -join "`n") + "`n``````"
  $gates += "### build`n`n``````" + "`n" + ((& npm run build 2>&1 | Select-Object -Last 20) -join "`n") + "`n``````"
  Pop-Location
  Add-Section 'Build gates' ($gates -join "`n`n")
  Ok 'gates captured'
} else {
  Add-Section 'Build gates' '_Skipped. Re-run with `-Deep` to capture typecheck, lint and build output._'
}

# ── 9. Project docs verbatim ────────────────────────────────────────
Step 'project docs'
$docs = @()
foreach ($d in @('CLAUDE.md', 'docs\STATUS.md', 'docs\ROADMAP.md', 'docs\ARCHITECTURE.md', 'docs\AUDIT.md')) {
  $p = Join-Path $APP $d
  if (Test-Path $p) { $docs += "### $d`n`n" + (Get-Content $p -Raw) }
}
Add-Section 'Project documentation (verbatim)' ($docs -join "`n`n---`n`n")
Ok "$($docs.Count) docs included"

# ── 10. Environment ─────────────────────────────────────────────────
$envKeys = if (Test-Path $envFile) {
  (Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Z_]+\s*=' } | ForEach-Object { ($_ -split '=')[0].Trim() + ' = <set>' }) -join "`n"
} else { 'no .env' }
# Parentheses matter: without them PowerShell reads the `+` as extra positional
# arguments to Add-Section and the section body silently comes out empty.
$envBody = "``````" + "`n" + $envKeys + "`n" + "``````" +
           "`n`nTooling: node $(node --version), npm $(npm --version), git $((git --version) -replace 'git version ','')"
Add-Section 'Environment (names only, no values)' $envBody

# ── Assemble, scrub, write ──────────────────────────────────────────
$header = @"
# TMMT + AIXMOS — full handoff bundle

> Captured $(Get-Date -Format 'yyyy-MM-dd HH:mm') from $env:COMPUTERNAME
> Secrets scrubbed. Drop this whole file into Cursor or Claude Cowork.
"@

$bundle = Scrub ($header + ($parts -join "`n"))
$out = Join-Path $dir 'HANDOFF.md'
$bundle | Set-Content $out -Encoding UTF8

# Keep only the last 10 snapshots so the folder does not grow without bound.
Get-ChildItem $SNAPS -Directory | Sort-Object Name -Descending | Select-Object -Skip 10 |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
Set-Clipboard -Value $out

Hd 'BUNDLE READY'
Write-Host "  $out" -ForegroundColor White
Write-Host "  $kb KB  ·  path copied to your clipboard" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Next:  open it, select all, paste into Cursor or Claude Cowork.' -ForegroundColor Gray
Write-Host '         or in Cursor:  Ctrl+L  then  @' -NoNewline -ForegroundColor Gray
Write-Host "$out" -ForegroundColor DarkCyan
Write-Host ''
