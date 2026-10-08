# ============================================================
#  AIXMOS AGENT
#  Reports this PC's health + activity to the Fleet Watchtower hub.
#  Runs in the logged-in user's session (so it can read the active
#  window). Loops forever, posting every 20s.
# ============================================================
param(
  [string]$Hub = "http://100.117.163.93:8787",   # Brainiac (hub) Tailscale IP
  [int]$Every = 20
)

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class AIXWin {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  [DllImport("kernel32.dll")] static extern uint GetTickCount();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static uint IdleMs() { LASTINPUTINFO i = new LASTINPUTINFO(); i.cbSize=(uint)Marshal.SizeOf(i); GetLastInputInfo(ref i); return GetTickCount()-i.dwTime; }
  public static string ActiveTitle() { var sb=new StringBuilder(512); GetWindowText(GetForegroundWindow(), sb, 512); return sb.ToString(); }
}
"@

$name = $env:COMPUTERNAME

while ($true) {
  try {
    $os   = Get-CimInstance Win32_OperatingSystem
    $cpu  = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor | Where-Object Name -eq '_Total').PercentProcessorTime
    $memTotalKB = [double]$os.TotalVisibleMemorySize
    $memFreeKB  = [double]$os.FreePhysicalMemory
    $memUsedGB  = [math]::Round(($memTotalKB-$memFreeKB)/1MB,1)
    $memTotalGB = [math]::Round($memTotalKB/1MB,1)
    $memPct     = [math]::Round((($memTotalKB-$memFreeKB)/$memTotalKB)*100,0)

    $sys = $env:SystemDrive
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$sys'"
    $diskTotalGB = [math]::Round($disk.Size/1GB,0)
    $diskFreeGB  = [math]::Round($disk.FreeSpace/1GB,0)
    $diskPct     = if ($disk.Size) { [math]::Round((($disk.Size-$disk.FreeSpace)/$disk.Size)*100,0) } else { 0 }

    $uptimeH = [math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,1)
    $user = (Get-CimInstance Win32_ComputerSystem).UserName
    if ($user) { $user = $user.Split('\')[-1] }

    $idleSec = [int]([AIXWin]::IdleMs()/1000)
    $active  = [AIXWin]::ActiveTitle()

    $payload = @{
      name=$name; cpu=[double]$cpu; memPct=$memPct; memUsedGB=$memUsedGB; memTotalGB=$memTotalGB
      diskPct=$diskPct; diskFreeGB=$diskFreeGB; diskTotalGB=$diskTotalGB
      uptimeH=$uptimeH; user=$user; active=$active; idleSec=$idleSec
    } | ConvertTo-Json -Compress

    Invoke-RestMethod -Uri "$Hub/api/report" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 8 | Out-Null
  } catch {
    # hub unreachable / asleep -- just try again next cycle
  }
  Start-Sleep -Seconds $Every
}
