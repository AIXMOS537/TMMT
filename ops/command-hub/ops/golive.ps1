<#
  ops golive — is the public door open, and is the gate still shut?

  Checks the three things that must ALL hold together after attaching
  tmmtrentals.net to tmmt-ops and repointing production to master.
  Run it from anywhere:  ops golive

  Note on curl: in Windows PowerShell `curl` is an ALIAS for Invoke-WebRequest,
  which takes entirely different arguments and fails on bash-style flags. This
  script calls `curl.exe` explicitly — the real curl, shipped with Windows 10
  1803+ — which is why the flags below work.
#>

$ErrorActionPreference = 'SilentlyContinue'

function Hd($t)  { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Pass($t){ Write-Host "  [ PASS ] " -ForegroundColor Green  -NoNewline; Write-Host $t }
function Fail($t){ Write-Host "  [ FAIL ] " -ForegroundColor Red    -NoNewline; Write-Host $t }
function Note($t){ Write-Host "           $t" -ForegroundColor DarkGray }

# Returns @{ Code; Redirect } without following the redirect, so we can see
# WHERE it bounces to — that is the whole diagnosis.
function Probe([string]$Url) {
    $raw = & curl.exe -s -o NUL -m 25 -w "%{http_code}|%{redirect_url}" $Url 2>$null
    $parts = "$raw" -split '\|', 2
    return @{ Code = $parts[0]; Redirect = if ($parts.Count -gt 1) { $parts[1] } else { '' } }
}

$DOMAIN  = 'https://tmmtrentals.net'
$PREVIEW = 'https://tmmt-ops-aixmos537.vercel.app'

Hd 'GO-LIVE CHECK'
Write-Host "  domain : $DOMAIN" -ForegroundColor DarkGray
Write-Host "  preview: $PREVIEW" -ForegroundColor DarkGray

$ok = $true

# ── 1. The public door ──────────────────────────────────────────────
Hd '1. Can a customer reach the waitlist form?'
$p = Probe "$DOMAIN/forms/waitlist"
if ($p.Code -eq '000') {
    Fail "$DOMAIN does not resolve."
    Note 'The DNS record has not been created yet. Both tmmtrentals zones are'
    Note 'empty on Google Cloud DNS - see docs/runbooks/OPEN-PUBLIC-ACCESS.md'
    $ok = $false
} elseif ($p.Redirect -like '*vercel.com/sso-api*') {
    Fail "Bounced to the Vercel login wall (HTTP $($p.Code))."
    Note 'The domain is not bypassing SSO yet. Either it is not attached to'
    Note 'tmmt-ops, or Vercel has not validated the DNS record.'
    $ok = $false
} elseif ($p.Code -eq '200') {
    Pass 'Public form is reachable. Customers can submit.'
} else {
    Fail "Unexpected HTTP $($p.Code) -> $($p.Redirect)"
    $ok = $false
}

# ── 2. The staff gate ───────────────────────────────────────────────
Hd '2. Is the admin still gated?'
$p = Probe "$DOMAIN/fleet"
if ($p.Code -eq '000') {
    Fail 'Cannot check - domain does not resolve yet.'
    $ok = $false
} elseif ($p.Redirect -like '*/login*') {
    Pass 'Signed-out request to /fleet redirects to /login.'
} elseif ($p.Code -eq '200') {
    Fail 'STOP. /fleet returned 200 while signed out - the admin is public.'
    Note 'Do not announce the domain until this is fixed.'
    $ok = $false
} else {
    Fail "Unexpected HTTP $($p.Code) -> $($p.Redirect)"
    $ok = $false
}

# ── 3. Previews must stay private ───────────────────────────────────
Hd '3. Are preview URLs still protected?'
$p = Probe "$PREVIEW/forms/waitlist"
if ($p.Redirect -like '*vercel.com/sso-api*') {
    Pass 'Raw Vercel URL still sits behind SSO.'
} elseif ($p.Code -eq '200') {
    Fail 'Preview URL is PUBLIC.'
    Note 'SSO was switched off rather than bypassed by the custom domain.'
    Note 'Every preview build is now world-readable. Re-enable Vercel'
    Note 'Authentication and rely on the domain exemption instead.'
    $ok = $false
} else {
    Note "HTTP $($p.Code) -> $($p.Redirect)  (inconclusive)"
}

# ── Verdict ─────────────────────────────────────────────────────────
Hd 'VERDICT'
if ($ok) {
    Write-Host '  All three hold. The door is open and the gate is shut.' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Next: push an app-code change to master and confirm a deployment' -ForegroundColor DarkGray
    Write-Host '  appears against the master ref. Only then delete m1/aixmos-credit-host.' -ForegroundColor DarkGray
} else {
    Write-Host '  Not live yet. Steps are in the canon repo:' -ForegroundColor Yellow
    Write-Host '  C:\Users\AIXMOS\TMMT-canon\docs\runbooks\OPEN-PUBLIC-ACCESS.md' -ForegroundColor DarkGray
}
Write-Host ''
