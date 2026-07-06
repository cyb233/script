<#
.SYNOPSIS
Monitor local port occupancy and show the owning process.

.DESCRIPTION
Poll TCP and UDP local endpoints for a target port, classify address family,
show the owning process, and optionally expand TCP states or show remote endpoints.

.PARAMETER Port
Target local port number to monitor. If omitted, the script prompts interactively.
Alias: -p

.PARAMETER AllStates
Show all TCP states. By default, the script focuses on Listen, Bound, and UDP,
and shows TIME_WAIT separately as residual connections.

.PARAMETER ProcessCacheSeconds
Process-name cache TTL in seconds. Use 0 to effectively disable caching. Default is 5.

.PARAMETER ShowRemote
Include the remote endpoint column in the output table.
Aliases: -remote, -r

.PARAMETER ShowHelp
Show command usage and examples, then exit.
Alias: -h, -help

.EXAMPLE
.\port.ps1 -h
Show command usage and exit.

.EXAMPLE
.\port.ps1 -Port 443 -AllStates
Show all TCP states plus UDP for local port 443.

.EXAMPLE
.\port.ps1 -Port 443 -ShowRemote -ProcessCacheSeconds 2
Show remote endpoints and refresh process names every 2 seconds.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [Alias('p')]
    [int]$Port,

    [switch]$AllStates,

    [Alias('cache')]
    [int]$ProcessCacheSeconds = 5,

    [Alias('remote', 'r')]
    [switch]$ShowRemote,

    [Alias('h', 'help')]
    [switch]$ShowHelp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Show-Usage {
    $scriptName = Split-Path -Leaf $PSCommandPath
    $helpAliases = '-ShowHelp, -h, -help'
    $examples = @(
        ".\$scriptName",
        ".\$scriptName -p 443",
        ".\$scriptName -p 443 -AllStates -r",
        ".\$scriptName -h"
    )

    $options = @(
        [pscustomobject]@{ Name = '-Port, -p <number>'; Description = 'Target local port. If omitted, the script prompts interactively.' },
        [pscustomobject]@{ Name = '-AllStates'; Description = 'Show all TCP states in addition to Listen, Bound, and UDP.' },
        [pscustomobject]@{ Name = '-ProcessCacheSeconds, -cache <number>'; Description = 'Process-name cache TTL in seconds. Default: 5. Use 0 to disable caching.' },
        [pscustomobject]@{ Name = '-ShowRemote, -remote, -r'; Description = 'Include the remote endpoint column in the output table.' },
        [pscustomobject]@{ Name = $helpAliases; Description = 'Show this help message and exit.' }
    )

    Write-Host ''
    Write-Host 'Port Occupancy Monitor'
    Write-Host '======================'
    Write-Host ''
    Write-Host 'Usage:'
    Write-Host ("  .\\{0} [-Port|-p <number>] [-AllStates] [-ProcessCacheSeconds|-cache <number>] [-ShowRemote|-remote|-r] [-ShowHelp|-h|-help]" -f $scriptName)
    Write-Host ''
    Write-Host 'Options:'

    foreach ($option in $options) {
        Write-Host ('  {0,-40} {1}' -f $option.Name, $option.Description)
    }

    Write-Host ''
    Write-Host 'Examples:'
    foreach ($example in $examples) {
        Write-Host ("  {0}" -f $example)
    }
    Write-Host ''
}

function Get-ProcessNameCached {
    param(
        [int]$ProcessId,
        [hashtable]$Cache,
        [datetime]$Now,
        [timespan]$Ttl
    )

    if ($ProcessId -eq 0) {
        return 'System Idle Process'
    }

    if ($Cache.ContainsKey($ProcessId)) {
        $cachedEntry = $Cache[$ProcessId]
        if ($cachedEntry.ExpiresAt -gt $Now) {
            return $cachedEntry.Name
        }
    }

    try {
        $name = (Get-Process -Id $ProcessId -ErrorAction Stop).ProcessName
        if ($name -notlike '*.exe') {
            $name = "$name.exe"
        }
    }
    catch {
        $name = '[Unavailable]'
    }

    $Cache[$ProcessId] = @{
        Name = $name
        ExpiresAt = $Now.Add($Ttl)
    }
    return $name
}

function Add-UniqueLine {
    param(
        [string]$Line,
        [System.Collections.Generic.HashSet[string]]$Seen,
        [System.Collections.Generic.List[string]]$Lines
    )

    if ($Seen.Add($Line)) {
        $Lines.Add($Line)
    }
}

function Get-AddressFamilyLabel {
    param([string]$Address)

    if ($Address -like '*:*') {
        return 'IPv6'
    }

    return 'IPv4'
}

function Format-Endpoint {
    param(
        [string]$Address,
        [int]$Port
    )

    if (($Address -like '*:*') -and ($Address -notmatch '^\[.*\]$')) {
        return ('[{0}]:{1}' -f $Address, $Port)
    }

    return ('{0}:{1}' -f $Address, $Port)
}

function Format-HeaderLine {
    if ($ShowRemote) {
        return ('{0,-4} {1,-4} {2,-56} {3,-56} {4,-12} {5,-10} {6}' -f 'Proto', 'IP', 'Local', 'Remote', 'State', 'PID', 'Process')
    }

    return ('{0,-4} {1,-4} {2,-56} {3,-12} {4,-10} {5}' -f 'Proto', 'IP', 'Local', 'State', 'PID', 'Process')
}

function Format-TcpLine {
    param($Connection, [string]$ProcessName)

    $family = Get-AddressFamilyLabel -Address $Connection.LocalAddress
    $localEndpoint = Format-Endpoint -Address $Connection.LocalAddress -Port $Connection.LocalPort

    if ($ShowRemote) {
        $remoteEndpoint = Format-Endpoint -Address $Connection.RemoteAddress -Port $Connection.RemotePort
        return ('{0,-4} {1,-4} {2,-56} {3,-56} {4,-12} {5,-10} {6}' -f 'TCP', $family, $localEndpoint, $remoteEndpoint, $Connection.State, $Connection.OwningProcess, $ProcessName)
    }

    return ('{0,-4} {1,-4} {2,-56} {3,-12} {4,-10} {5}' -f 'TCP', $family, $localEndpoint, $Connection.State, $Connection.OwningProcess, $ProcessName)
}

function Format-UdpLine {
    param($Endpoint, [string]$ProcessName)

    $family = Get-AddressFamilyLabel -Address $Endpoint.LocalAddress
    $localEndpoint = Format-Endpoint -Address $Endpoint.LocalAddress -Port $Endpoint.LocalPort

    if ($ShowRemote) {
        return ('{0,-4} {1,-4} {2,-56} {3,-56} {4,-12} {5,-10} {6}' -f 'UDP', $family, $localEndpoint, '*:*', '', $Endpoint.OwningProcess, $ProcessName)
    }

    return ('{0,-4} {1,-4} {2,-56} {3,-12} {4,-10} {5}' -f 'UDP', $family, $localEndpoint, '', $Endpoint.OwningProcess, $ProcessName)
}

if ($ShowHelp) {
    Show-Usage
    exit 0
}

if (-not $PSBoundParameters.ContainsKey('Port')) {
    $rawPort = Read-Host 'Enter local port'
    $parsedPort = 0
    if (-not [int]::TryParse($rawPort, [ref]$parsedPort)) {
        Write-Error "Invalid port: $rawPort"
        exit 1
    }
    $Port = $parsedPort
}

if ($ProcessCacheSeconds -lt 0) {
    Write-Error 'ProcessCacheSeconds must be greater than or equal to 0'
    exit 1
}

$Host.UI.RawUI.WindowTitle = "Port Occupancy Check: $Port"
Write-Host "Scanning local port $Port"
if ($AllStates) {
    Write-Host "Mode: all TCP states + UDP (process cache TTL: ${ProcessCacheSeconds}s, show remote: $ShowRemote)"
}
else {
    Write-Host "Mode: occupancy states only (Listen/Bound/UDP), TIME_WAIT shown separately (process cache TTL: ${ProcessCacheSeconds}s, show remote: $ShowRemote)"
}

$processNameCache = @{}
$processCacheTtl = [timespan]::FromSeconds($ProcessCacheSeconds)

while ($true) {
    $now = Get-Date
    Write-Host ("Current time: {0:HH:mm:ss.ff} - Local port: {1}" -f $now, $Port)

    $seenLines = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $primaryLines = [System.Collections.Generic.List[string]]::new()
    $residualLines = [System.Collections.Generic.List[string]]::new()
    $extraLines = [System.Collections.Generic.List[string]]::new()

    foreach ($conn in @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)) {
        $procName = Get-ProcessNameCached -ProcessId $conn.OwningProcess -Cache $processNameCache -Now $now -Ttl $processCacheTtl
        $line = Format-TcpLine -Connection $conn -ProcessName $procName

        if ($conn.State -in @('Listen', 'Bound')) {
            Add-UniqueLine -Line $line -Seen $seenLines -Lines $primaryLines
            continue
        }

        if ($conn.State -eq 'TimeWait') {
            Add-UniqueLine -Line $line -Seen $seenLines -Lines $residualLines
            continue
        }

        if ($AllStates) {
            Add-UniqueLine -Line $line -Seen $seenLines -Lines $extraLines
        }
    }

    foreach ($endpoint in @(Get-NetUDPEndpoint -LocalPort $Port -ErrorAction SilentlyContinue)) {
        $procName = Get-ProcessNameCached -ProcessId $endpoint.OwningProcess -Cache $processNameCache -Now $now -Ttl $processCacheTtl
        $line = Format-UdpLine -Endpoint $endpoint -ProcessName $procName
        Add-UniqueLine -Line $line -Seen $seenLines -Lines $primaryLines
    }

    if (($primaryLines.Count + $residualLines.Count + $extraLines.Count) -eq 0) {
        Write-Host "No local endpoint matched port $Port"
    }
    else {
        Write-Host (Format-HeaderLine)
        foreach ($line in $primaryLines) {
            Write-Host $line
        }

        if ($residualLines.Count -gt 0) {
            Write-Host 'Residual TIME_WAIT:'
            Write-Host (Format-HeaderLine)
            foreach ($line in $residualLines) {
                Write-Host $line
            }
        }

        if ($extraLines.Count -gt 0) {
            Write-Host 'Other TCP states:'
            Write-Host (Format-HeaderLine)
            foreach ($line in $extraLines) {
                Write-Host $line
            }
        }
    }

    Start-Sleep -Seconds 1
}
