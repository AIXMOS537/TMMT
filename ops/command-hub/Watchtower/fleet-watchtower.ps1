# ============================================================
#  AIXMOS FLEET WATCHTOWER  (hub + viewer)
#  - Reads `tailscale status --json` for up/down of every machine.
#  - Ingests deep stats from AIXMOS agents (POST /api/report):
#    CPU, RAM, disk, uptime, logged-in user, active app, idle.
#  - Serves a live dashboard.
#
#  Viewer mode (tablet):  -Bind 127.0.0.1   (default)
#  Hub mode (Brainiac) :  -Bind +           (accepts agent reports
#                         from the mesh; run elevated w/ urlacl+firewall)
# ============================================================
param(
  [int]$Port = 8787,
  [string]$Bind = "127.0.0.1",
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$script:Reports = @{}   # normalized-hostname -> @{ data=...; at=DateTime }

function Norm($s) { if (-not $s) { return "" }; return (([string]$s).ToUpper() -replace '[\s_\-]','') }

# --- worklog: append each agent report to a daily CSV ---
$script:WorkDir = Join-Path $PSScriptRoot "worklog"
function Write-WorkLog($d) {
  try {
    if (-not (Test-Path $script:WorkDir)) { New-Item -ItemType Directory -Path $script:WorkDir -Force | Out-Null }
    $now = Get-Date
    $f = Join-Path $script:WorkDir ($now.ToString("yyyy-MM-dd") + ".csv")
    if (-not (Test-Path $f)) { [IO.File]::AppendAllText($f, "ts,machine,user,idleSec,cpu`r`n") }
    $line = '{0},{1},{2},{3},{4}' -f $now.ToString("s"), (($d.name) -replace ',',' '), (($d.user) -replace ',',' '), [int]$d.idleSec, [int]$d.cpu
    [IO.File]::AppendAllText($f, $line + "`r`n")
  } catch {}
}

# --- worklog summary: active minutes per machine+user for a day ---
function Get-WorklogJson($date) {
  if (-not $date) { $date = (Get-Date).ToString("yyyy-MM-dd") }
  $f = Join-Path $script:WorkDir ($date + ".csv")
  if (-not (Test-Path $f)) { return (@{ date = $date; people = @() } | ConvertTo-Json) }
  $rows = Import-Csv $f
  $out = New-Object System.Collections.ArrayList
  foreach ($g in ($rows | Group-Object machine, user)) {
    $items = @($g.Group | Sort-Object ts)
    $activeSec = 0.0
    for ($i = 0; $i -lt $items.Count - 1; $i++) {
      if ([int]$items[$i].idleSec -lt 300) {
        $gap = ([datetime]$items[$i+1].ts - [datetime]$items[$i].ts).TotalSeconds
        if ($gap -gt 0 -and $gap -le 120) { $activeSec += $gap }
      }
    }
    [void]$out.Add([pscustomobject]@{
      machine   = $items[0].machine
      user      = $items[0].user
      first     = ([datetime]$items[0].ts).ToString("HH:mm")
      last      = ([datetime]$items[-1].ts).ToString("HH:mm")
      activeMin = [int][math]::Round($activeSec / 60, 0)
      samples   = $items.Count
    })
  }
  return (@{ date = $date; people = ($out | Sort-Object activeMin -Descending) } | ConvertTo-Json -Depth 5)
}

function Get-TailscaleExe {
  $c = Get-Command tailscale -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $p = "C:\Program Files\Tailscale\tailscale.exe"
  if (Test-Path $p) { return $p }
  throw "tailscale.exe not found"
}
$script:TS = Get-TailscaleExe

function Get-FleetJson {
  try { $j = & $script:TS status --json 2>$null | ConvertFrom-Json }
  catch { return (@{ error = "could not read tailscale status"; nodes = @() } | ConvertTo-Json) }

  $nodes = New-Object System.Collections.ArrayList

  function Add-Node($n, $isSelf) {
    if (-not $n) { return }
    $ip = ($n.TailscaleIPs | Select-Object -First 1)
    $last = $null
    if ($n.LastSeen -and $n.LastSeen -notlike '0001-*') { $last = $n.LastSeen }

    $node = [ordered]@{
      name = $n.HostName; os = $n.OS; ip = $ip; online = [bool]$n.Online
      self = [bool]$isSelf; lastSeen = $last
      rx = [int64]$n.RxBytes; tx = [int64]$n.TxBytes; exit = [bool]$n.ExitNode
      hasAgent = $false
    }

    $rep = $script:Reports[(Norm $n.HostName)]
    if ($rep) {
      $age = [int]((Get-Date) - $rep.at).TotalSeconds
      $d = $rep.data
      $node.hasAgent = $true
      $node.agentAgeSec = $age
      $node.cpu        = [double]$d.cpu
      $node.memPct     = [double]$d.memPct
      $node.memUsedGB  = [double]$d.memUsedGB
      $node.memTotalGB = [double]$d.memTotalGB
      $node.diskPct    = [double]$d.diskPct
      $node.diskFreeGB = [double]$d.diskFreeGB
      $node.diskTotalGB= [double]$d.diskTotalGB
      $node.user       = [string]$d.user
      $node.active     = [string]$d.active
      $node.idleSec    = [int]$d.idleSec
      $node.uptimeH    = [double]$d.uptimeH
    }
    [void]$nodes.Add([pscustomobject]$node)
  }

  Add-Node $j.Self $true
  if ($j.Peer) { foreach ($p in $j.Peer.PSObject.Properties) { Add-Node $p.Value $false } }

  $sorted = $nodes | Sort-Object @{e={-[int]$_.online}}, name
  return (@{
    generated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    self = $j.Self.HostName; nodes = $sorted
  } | ConvertTo-Json -Depth 6)
}

$HTML = @'
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIXMOS Fleet Watchtower</title>
<style>
  :root{--bg:#0a0d12;--card:#141a22;--line:#222c38;--up:#27d07a;--down:#ff4d5e;--warn:#ffb020;--dim:#7d8a9c;--txt:#e9eef5;--accent:#3ea6ff}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:Segoe UI,system-ui,sans-serif}
  header{display:flex;align-items:center;gap:16px;padding:18px 22px;border-bottom:1px solid var(--line);position:sticky;top:0;background:linear-gradient(180deg,#0d1219,#0a0d12);z-index:5}
  h1{font-size:20px;margin:0;letter-spacing:.5px}
  .sub{color:var(--dim);font-size:13px;margin-top:2px}
  .pill{margin-left:auto;font-size:14px;background:var(--card);border:1px solid var(--line);padding:8px 14px;border-radius:999px}
  .pill b{color:var(--up)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;padding:20px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;position:relative;overflow:hidden}
  .card.off{opacity:.6}
  .card .edge{position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--down)}
  .card.up .edge{background:var(--up)}
  .row1{display:flex;align-items:center;gap:10px}
  .dot{width:12px;height:12px;border-radius:50%;background:var(--down)}
  .up .dot{background:var(--up);animation:pulse 2s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(39,208,122,.5)}70%{box-shadow:0 0 0 9px rgba(39,208,122,0)}100%{box-shadow:0 0 0 0 rgba(39,208,122,0)}}
  .name{font-size:18px;font-weight:600}
  .tag{margin-left:auto;font-size:11px;color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:1px 7px;text-transform:uppercase}
  .meta{margin-top:12px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;color:var(--dim)}
  .meta .v{color:var(--txt);text-align:right;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
  .state{font-weight:700}.state.up{color:var(--up)}.state.down{color:var(--down)}
  .bars{margin-top:12px;display:flex;flex-direction:column;gap:7px}
  .bar{font-size:11px;color:var(--dim)}
  .bar .lab{display:flex;justify-content:space-between;margin-bottom:2px}
  .track{height:7px;background:#0c1117;border-radius:99px;overflow:hidden}
  .fill{height:100%;background:var(--up);border-radius:99px}
  .fill.w{background:var(--warn)}.fill.c{background:var(--down)}
  .act{margin-top:10px;font-size:12px;color:var(--dim);border-top:1px solid var(--line);padding-top:8px}
  .act b{color:var(--txt)}
  .noag{margin-top:10px;font-size:11px;color:var(--dim);font-style:italic}
  footer{color:var(--dim);font-size:12px;text-align:center;padding:14px}
</style></head><body>
<header>
  <div><h1>🛰️ FLEET WATCHTOWER</h1><div class="sub" id="self">&nbsp;</div></div>
  <div class="pill"><b id="upn">–</b> / <span id="totn">–</span> online &nbsp;·&nbsp; <span id="ts">…</span></div>
</header>
<div class="grid" id="grid"></div>
<footer>auto-refresh 10s · up/down from Tailscale · deep stats from AIXMOS agents · Command Center</footer>
<script>
const OSI={windows:"🪟",macOS:"",linux:"🐧",iOS:"📱",android:"🤖"};
function ago(iso){if(!iso)return"never";const d=(Date.now()-new Date(iso))/1000;
 if(d<60)return Math.round(d)+"s ago";if(d<3600)return Math.round(d/60)+"m ago";
 if(d<86400)return Math.round(d/3600)+"h ago";return Math.round(d/86400)+"d ago";}
function bytes(n){if(!n)return"0";const u=["B","KB","MB","GB","TB"];let i=0;n=Number(n);
 while(n>=1024&&i<u.length-1){n/=1024;i++;}return n.toFixed(n<10&&i>0?1:0)+u[i];}
function idle(s){if(s==null)return"";if(s<60)return"active now";if(s<3600)return Math.round(s/60)+"m idle";return Math.round(s/3600)+"h idle";}
function cls(p){return p>=90?"c":p>=70?"w":"";}
function bar(lab,pct,extra){pct=Math.max(0,Math.min(100,pct||0));
 return `<div class="bar"><div class="lab"><span>${lab}</span><span>${extra||pct.toFixed(0)+"%"}</span></div>
  <div class="track"><div class="fill ${cls(pct)}" style="width:${pct}%"></div></div></div>`;}
async function tick(){
 try{const r=await fetch("/api/fleet",{cache:"no-store"});const d=await r.json();
  const nodes=d.nodes||[];const up=nodes.filter(n=>n.online).length;
  document.getElementById("upn").textContent=up;
  document.getElementById("totn").textContent=nodes.length;
  document.getElementById("ts").textContent=d.generated||"";
  document.getElementById("self").textContent="hub: "+(d.self||"")+" · watching "+nodes.length+" machines";
  document.getElementById("grid").innerHTML=nodes.map(n=>{
   let deep="";
   if(n.online&&n.hasAgent){
    deep=`<div class="bars">
      ${bar("CPU",n.cpu)}
      ${bar("RAM",n.memPct,n.memUsedGB.toFixed(1)+"/"+n.memTotalGB.toFixed(0)+"GB")}
      ${bar("Disk",n.diskPct,n.diskFreeGB.toFixed(0)+"GB free")}
     </div>
     <div class="act">👤 <b>${n.user||"—"}</b> · ${idle(n.idleSec)}<br>🖥 ${n.active?n.active.replace(/</g,"&lt;"):"—"}</div>`;
   } else if(n.online && (n.os==="windows"||n.os==="macOS")){
    deep=`<div class="noag">no agent yet — up/down only</div>`;
   }
   return `<div class="card ${n.online?'up':'off'}">
     <div class="edge"></div>
     <div class="row1"><span class="dot"></span>
       <span class="name">${OSI[n.os]||"💻"} ${n.name}</span>
       ${n.self?'<span class="tag">hub</span>':n.exit?'<span class="tag">exit</span>':''}
     </div>
     <div class="meta">
       <span>state</span><span class="v state ${n.online?'up':'down'}">${n.online?'ONLINE':'OFFLINE'}</span>
       <span>os</span><span class="v">${n.os||'?'}</span>
       <span>ip</span><span class="v">${n.ip||'-'}</span>
       <span>last seen</span><span class="v">${n.online?'now':ago(n.lastSeen)}</span>
       ${n.hasAgent&&n.online?`<span>uptime</span><span class="v">${n.uptimeH<24?n.uptimeH.toFixed(1)+"h":(n.uptimeH/24).toFixed(1)+"d"}</span>`:""}
     </div>${deep}
   </div>`;}).join("");
 }catch(e){document.getElementById("ts").textContent="error reading fleet";}
}
tick();setInterval(tick,10000);
</script></body></html>
'@

$WORKLOG_HTML = @'
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Worklog — who worked how long</title>
<style>
  :root{--bg:#0a0d12;--card:#141a22;--line:#222c38;--up:#27d07a;--accent:#3ea6ff;--dim:#7d8a9c;--txt:#e9eef5}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:Segoe UI,system-ui,sans-serif}
  header{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--line)}
  h1{font-size:20px;margin:0}.sub{color:var(--dim);font-size:13px}
  input[type=date]{margin-left:auto;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:7px 10px}
  .wrap{padding:20px;max-width:920px;margin:0 auto}
  .row{display:grid;grid-template-columns:1.4fr 1fr 2fr auto;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:10px}
  .who{font-weight:600;font-size:16px}.mach{color:var(--dim);font-size:12px}
  .span{color:var(--dim);font-size:13px;font-variant-numeric:tabular-nums}
  .track{height:10px;background:#0c1117;border-radius:99px;overflow:hidden}
  .fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--up));border-radius:99px}
  .amt{font-weight:700;font-variant-numeric:tabular-nums;text-align:right;min-width:70px}
  .empty{color:var(--dim);text-align:center;padding:40px}
  .head{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.5px;padding:0 16px;display:grid;grid-template-columns:1.4fr 1fr 2fr auto;gap:12px}
</style></head><body>
<header><div><h1>🕒 WORKLOG</h1><div class="sub" id="sub">active time per person today</div></div>
  <input type="date" id="d"></header>
<div class="wrap">
  <div class="head"><span>person</span><span>first–last</span><span>active time</span><span>&nbsp;</span></div>
  <div id="list"></div>
</div>
<script>
function hm(m){const h=Math.floor(m/60),mm=m%60;return h?h+"h "+mm+"m":mm+"m";}
const di=document.getElementById("d");
di.value=new Date().toISOString().slice(0,10);
async function load(){
  const r=await fetch("/api/worklog?date="+di.value,{cache:"no-store"});const d=await r.json();
  const ppl=d.people||[];const max=Math.max(60,...ppl.map(p=>p.activeMin));
  document.getElementById("sub").textContent="active time per person · "+d.date;
  document.getElementById("list").innerHTML = ppl.length? ppl.map(p=>`
    <div class="row">
      <div><div class="who">${p.user||"(no user)"}</div><div class="mach">${p.machine}</div></div>
      <div class="span">${p.first}–${p.last}</div>
      <div class="track"><div class="fill" style="width:${Math.round(p.activeMin/max*100)}%"></div></div>
      <div class="amt">${hm(p.activeMin)}</div>
    </div>`).join("") : '<div class="empty">No activity logged for this day yet.</div>';
}
di.addEventListener("change",load);load();setInterval(load,30000);
</script></body></html>
'@

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://${Bind}:$Port/")
try { $listener.Start() } catch { Write-Host "Could not bind http://${Bind}:$Port/  ($($_.Exception.Message))"; exit 1 }

$pidFile = Join-Path $PSScriptRoot "watchtower.pid"
$PID | Out-File -FilePath $pidFile -Encoding ascii

$url = "http://127.0.0.1:$Port/"
Write-Host "Watchtower listening on http://${Bind}:$Port/  (view: $url)"
if (-not $NoBrowser) { Start-Process $url }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $path = $req.Url.AbsolutePath
      if ($req.HttpMethod -eq 'POST' -and $path -eq '/api/report') {
        $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
        $txt = $reader.ReadToEnd(); $reader.Close()
        try {
          $data = $txt | ConvertFrom-Json
          if ($data.name) { $script:Reports[(Norm $data.name)] = @{ data = $data; at = (Get-Date) }; Write-WorkLog $data }
        } catch {}
        $body = '{"ok":true}'; $res.ContentType = "application/json"
      }
      elseif ($path -eq '/api/fleet') {
        $body = Get-FleetJson; $res.ContentType = "application/json"
      }
      elseif ($path -eq '/api/worklog') {
        $body = Get-WorklogJson ($req.QueryString['date']); $res.ContentType = "application/json"
      }
      elseif ($path -eq '/worklog') {
        $body = $WORKLOG_HTML; $res.ContentType = "text/html; charset=utf-8"
      }
      else {
        $body = $HTML; $res.ContentType = "text/html; charset=utf-8"
      }
      $res.Headers.Add("Access-Control-Allow-Origin","*")
      $buf = [System.Text.Encoding]::UTF8.GetBytes($body)
      $res.ContentLength64 = $buf.Length
      $res.OutputStream.Write($buf, 0, $buf.Length)
    } catch {} finally { $res.OutputStream.Close() }
  }
} finally {
  $listener.Stop()
  if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
}
