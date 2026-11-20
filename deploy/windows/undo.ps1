# Reverse deploy/windows/setup.ps1: automatic DNS, IPv6 back on, DoH entry
# and proxy CA removed.
#   irm https://anssis.51-159-106-197.nip.io/win-undo | iex
$ErrorActionPreference = 'Stop'
$Server = '51.159.106.197'
$Base = 'https://anssis.51-159-106-197.nip.io'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -Command `"irm $Base/win-undo | iex`""
    return
}

foreach ($a in Get-NetAdapter | Where-Object { -not $_.Virtual }) {
    Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses
    Enable-NetAdapterBinding -Name $a.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\InterfaceSpecificParameters\$($a.InterfaceGuid)\DohInterfaceSettings\Doh\$Server"
    Remove-Item -Path $key -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-DnsClientDohServerAddress -ServerAddress $Server -ErrorAction SilentlyContinue
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -match 'anssis' } | Remove-Item
Clear-DnsClientCache
Write-Host 'Undone: this PC uses automatic DNS again.' -ForegroundColor Green
