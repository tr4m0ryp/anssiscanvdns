# Point this Windows 11 PC at the anssiscanvdns resolver over DNS-over-HTTPS.
#   irm https://dns.husimi.ai/win | iex
# Registers the DoH template, points every physical adapter at the server on
# every network (re-applied by a scheduled task at startup and on each network
# connect), turns IPv6 off so lookups cannot bypass the blocker, and trusts the proxy
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

# The adapter settings live in a small script that a scheduled task re-runs
# at startup and on every network connect, so every adapter (also ones that
# are unplugged now, or added later) and every Wi-Fi network is covered.
$dir = "$env:ProgramData\anssis"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
@"
`$Server = '$Server'
foreach (`$a in Get-NetAdapter -Physical) {
    Set-DnsClientServerAddress -InterfaceIndex `$a.ifIndex -ServerAddresses `$Server
    `$key = "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\InterfaceSpecificParameters\`$(`$a.InterfaceGuid)\DohInterfaceSettings\Doh\`$Server"
    New-Item -Path `$key -Force | Out-Null
    Set-ItemProperty -Path `$key -Name DohFlags -Type QWord -Value 1
    Disable-NetAdapterBinding -Name `$a.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
}
Clear-DnsClientCache
"@ | Set-Content -Path "$dir\apply.ps1" -Encoding UTF8

Write-Host '== every adapter, every network: DNS -> server (DoH), IPv6 off'
& "$dir\apply.ps1"
Get-NetAdapter -Physical | ForEach-Object { Write-Host "   $($_.Name) ($($_.Status))" }

$run = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $dir\apply.ps1"
schtasks /Create /F /RU SYSTEM /RL HIGHEST /TN 'anssis-dns-boot' /SC ONSTART /TR $run | Out-Null
if ($LASTEXITCODE) { throw 'could not register the scheduled tasks' }
schtasks /Create /F /RU SYSTEM /RL HIGHEST /TN 'anssis-dns-network' /SC ONEVENT `
    /EC 'Microsoft-Windows-NetworkProfile/Operational' /MO '*[System[EventID=10000]]' /TR $run | Out-Null
if ($LASTEXITCODE) { throw 'could not register the scheduled tasks' }
Write-Host '== re-applied automatically at startup and on every network connect'

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
