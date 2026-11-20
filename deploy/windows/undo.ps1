# Reverse deploy/windows/setup.ps1: automatic DNS, IPv6 back on, DoH entry
# proxy CA and browser DNS policies removed.
#   irm https://dns.husimi.ai/win-undo | iex
$ErrorActionPreference = 'Stop'
$Server = '51.159.106.197'
$Base = 'https://dns.husimi.ai'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -Command `"irm $Base/win-undo | iex`""
    return
}

schtasks /Delete /F /TN 'anssis-dns-boot' 2>$null | Out-Null
schtasks /Delete /F /TN 'anssis-dns-network' 2>$null | Out-Null
Remove-Item "$env:ProgramData\anssis" -Recurse -Force -ErrorAction SilentlyContinue
foreach ($a in Get-NetAdapter | Where-Object { -not $_.Virtual }) {
    Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses
    Enable-NetAdapterBinding -Name $a.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\InterfaceSpecificParameters\$($a.InterfaceGuid)\DohInterfaceSettings\Doh\$Server"
    Remove-Item -Path $key -Recurse -Force -ErrorAction SilentlyContinue
}
foreach ($p in 'Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave') {
    $k = "HKLM:\SOFTWARE\Policies\$p"
    Remove-ItemProperty -Path $k -Name DnsOverHttpsMode, DnsOverHttpsTemplates -ErrorAction SilentlyContinue
}
Remove-Item -Path 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox\DNSOverHTTPS' -Recurse -Force -ErrorAction SilentlyContinue
Remove-DnsClientDohServerAddress -ServerAddress $Server -ErrorAction SilentlyContinue
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -match 'anssis' } | Remove-Item
Clear-DnsClientCache
Write-Host 'Undone: this PC uses automatic DNS again.' -ForegroundColor Green
