<#
.SYNOPSIS
Monitor local port occupancy and show the owning process.

.DESCRIPTION
Poll TCP and UDP local endpoints for a target port, classify address family,
show the owning process, and optionally expand TCP states or show remote endpoints.

.PARAMETER Port
Target local port number to monitor. If omitted, the script prompts interactively.

.PARAMETER AllStates
Show all TCP states. By default, the script focuses on Listen, Bound, and UDP,
and shows TIME_WAIT separately as residual connections.

.PARAMETER ProcessCacheSeconds
Process-name cache TTL in seconds. Use 0 to effectively disable caching. Default is 5.

.PARAMETER ShowRemote
Include the remote endpoint column in the output table.

.EXAMPLE
.\port.ps1
Prompt for a local port and show occupancy-focused output.

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
    [int]$Port,

    [switch]$AllStates,

    [int]$ProcessCacheSeconds = 5,

    [switch]$ShowRemote
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
