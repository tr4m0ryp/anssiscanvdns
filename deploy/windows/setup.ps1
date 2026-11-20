# Point this Windows 11 PC at the anssiscanvdns resolver over DNS-over-HTTPS.
#   irm https://dns.husimi.ai/win | iex
# Registers the DoH template, sets every active adapter's DNS to the server
# (one setting per adapter, so it covers every Wi-Fi network), turns IPv6 off
# on those adapters so lookups cannot bypass the blocker, and trusts the proxy
# CA (name-constrained to the intercepted domains). Chrome, Edge, Brave and
# Firefox get a policy that locks their secure DNS to this server, so a
# browser cannot route around Windows. Undo: .../win-undo
$ErrorActionPreference = 'Stop'
$Server = '51.159.106.197'
$Base = 'https://dns.husimi.ai'
$Template = "$Base/dns-query"

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Write-Host 'Asking for administrator rights...'
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -Command `"irm $Base/win | iex`""
    return
}

Write-Host '== registering the DoH server'
if (Get-DnsClientDohServerAddress -ServerAddress $Server -ErrorAction SilentlyContinue) {
    Set-DnsClientDohServerAddress -ServerAddress $Server -DohTemplate $Template -AllowFallbackToUdp $false -AutoUpgrade $true | Out-Null
} else {
    Add-DnsClientDohServerAddress -ServerAddress $Server -DohTemplate $Template -AllowFallbackToUdp $false -AutoUpgrade $true | Out-Null
}
# Use DoH automatically for any server that has a known template.
$dnscache = 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters'
Set-ItemProperty -Path $dnscache -Name EnableAutoDoh -Type DWord -Value 2

$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and -not $_.Virtual }
foreach ($a in $adapters) {
    Write-Host "== $($a.Name): DNS -> $Server (DoH), IPv6 off"
    Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses $Server
    # Per-adapter "DNS over HTTPS: On (automatic template)", as the Settings app writes it.
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\InterfaceSpecificParameters\$($a.InterfaceGuid)\DohInterfaceSettings\Doh\$Server"
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name DohFlags -Type QWord -Value 1
    Disable-NetAdapterBinding -Name $a.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
}

Write-Host '== browsers: secure DNS locked to this server'
# Chrome, Edge and Brave read the same policy names; Firefox has its own.
foreach ($p in 'Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave') {
    $k = "HKLM:\SOFTWARE\Policies\$p"
    New-Item -Path $k -Force | Out-Null
    Set-ItemProperty -Path $k -Name DnsOverHttpsMode -Value 'secure'
    Set-ItemProperty -Path $k -Name DnsOverHttpsTemplates -Value $Template
}
$k = 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox\DNSOverHTTPS'
New-Item -Path $k -Force | Out-Null
Set-ItemProperty -Path $k -Name Enabled -Type DWord -Value 1
Set-ItemProperty -Path $k -Name ProviderURL -Value $Template
Set-ItemProperty -Path $k -Name Locked -Type DWord -Value 1

Write-Host '== trusting the proxy CA'
$crt = Join-Path $env:TEMP 'anssis-ca.crt'
Invoke-WebRequest "$Base/ca.crt" -OutFile $crt -UseBasicParsing
Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Remove-Item $crt

Clear-DnsClientCache
Write-Host '== test'
try {
    Resolve-DnsName ans.uva.nl -ErrorAction Stop | Out-Null
    Write-Host 'WARNING: ans.uva.nl still resolves. Reboot, then run this again.' -ForegroundColor Yellow
} catch {
    Write-Host 'Done: ans.uva.nl is blocked. Restart your browser.' -ForegroundColor Green
}
