# Twitch Drops Miner dev-build 自动更新脚本
# 计划任务示例:
# "C:\Program Files\PowerShell\7\pwsh.exe" -File "E:\dev\script\window_batch\TwitchDropsMiner_auto_update.ps1"

# ----------------------------
# 可按需修改的常量
# ----------------------------

# GitHub dev-build 固定下载地址
$DownloadUrl = "https://github.com/DevilXD/TwitchDropsMiner/releases/download/dev-build/Twitch.Drops.Miner.Windows.zip"

# master 分支最新 commit 检查地址；只取 1 条即可
$CommitApiUrl = "https://api.github.com/repos/DevilXD/TwitchDropsMiner/commits?sha=master&per_page=1"

# 安装目录。压缩包内容会直接覆盖解压到这里
$InstallDir = "D:\Program Files Green\Twitch Drops Miner"

# 主程序文件名，用于校验和定位需要结束的进程
$ExecutableName = "Twitch Drops Miner (by DevilXD).exe"
$ExecutablePath = Join-Path $InstallDir $ExecutableName

# 本脚本保存上次已安装 commit SHA 的状态文件
$StateFile = Join-Path $InstallDir "TwitchDropsMiner_auto_update_state.json"

# 临时下载文件路径。每次运行会先删除旧的临时文件
$ArchivePath = Join-Path $env:TEMP "Twitch.Drops.Miner.Windows.zip"

# 7-Zip 可执行程序。若 7z.exe 不在 PATH 中，可改成完整路径，例如:
# $SevenZipExe = "C:\Program Files\7-Zip\7z.exe"
$SevenZipExe = "7z.exe"

# GitHub API 建议带 User-Agent
$UserAgent = "TwitchDropsMiner-auto-update-pwsh"

# GitHub API Authorization。默认留空；不为空时会作为 Bearer Token 使用。
# 示例:
# $GitHubAuthorization = "ghp_xxxxxxxxxxxxxxxxxxxx"
$GitHubAuthorization = ""

# HTTP/HTTPS 代理。默认留空；不为空时 API 请求和下载都会使用该代理。
# 示例:
# $HttpProxy = "http://127.0.0.1:7890"
$HttpProxy = ""

# ----------------------------
# 辅助函数
# ----------------------------

function Get-LocalSha {
    param(
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $state = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        return $state.sha
    } catch {
        Write-Host "状态文件读取失败，将按未安装当前版本处理: $($_.Exception.Message)"
        return $null
    }
}

function Set-LocalSha {
    param(
        [string]$Path,
        [string]$Sha
    )

    $state = [ordered]@{
        sha = $Sha
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")
    }

    $state | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-RemoteSha {
    param(
        [string]$Url,
        [string]$Agent,
        [string]$Authorization,
        [string]$Proxy
    )

    $headers = @{
        "User-Agent" = $Agent
        "Accept" = "application/vnd.github+json"
    }

    if (-not [string]::IsNullOrWhiteSpace($Authorization)) {
        $headers["Authorization"] = "Bearer $Authorization"
    }

    $requestParams = @{
        Uri = $Url
        Headers = $headers
        Method = "Get"
    }

    if (-not [string]::IsNullOrWhiteSpace($Proxy)) {
        $requestParams["Proxy"] = $Proxy
    }

    $commits = Invoke-RestMethod @requestParams
    $latestCommit = @($commits)[0]

    if (-not $latestCommit.sha) {
        throw "GitHub API 响应中没有找到 commit sha"
    }

    return $latestCommit.sha
}

function Stop-TwitchDropsMiner {
    param(
        [string]$ExePath,
        [string]$ExeName
    )

    # 优先按完整可执行文件路径结束，避免误伤同名进程。
    $processes = Get-CimInstance Win32_Process |
        Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $ExePath) }

    # 如果 Win32_Process 没有拿到路径，再按进程名兜底。
    if (-not $processes) {
        $processName = [System.IO.Path]::GetFileNameWithoutExtension($ExeName)
        $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
    }

    foreach ($process in @($processes)) {
        $processId = $process.ProcessId
        if (-not $processId) {
            $processId = $process.Id
        }

        if ($processId) {
            Write-Host "结束进程 PID=$processId"
            Stop-Process -Id $processId -Force -ErrorAction Stop
        }
    }
}

# ----------------------------
# 主流程
# ----------------------------

try {
    Write-Host "步骤 0: 检查 7-Zip"
    if (-not (Get-Command $SevenZipExe -ErrorAction SilentlyContinue)) {
        throw "找不到 $SevenZipExe，请确认 7-Zip 已安装并加入 PATH，或在脚本顶部配置完整路径。"
    }

    Write-Host "步骤 1: 获取远程 master 最新 commit SHA"
    $remoteSha = Get-RemoteSha -Url $CommitApiUrl -Agent $UserAgent -Authorization $GitHubAuthorization -Proxy $HttpProxy
    Write-Host "远程 SHA: $remoteSha"

    $localSha = Get-LocalSha -Path $StateFile
    if ($localSha) {
        Write-Host "本地 SHA: $localSha"
    } else {
        Write-Host "本地 SHA: 无记录，将执行更新"
    }

    if ($localSha -and ($localSha -eq $remoteSha)) {
        Write-Host "Twitch Drops Miner 已是最新，无需更新。"
        exit 0
    }

    Write-Host "步骤 2: 准备安装目录和临时文件"
    if (-not (Test-Path -LiteralPath $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    if (Test-Path -LiteralPath $ArchivePath) {
        Remove-Item -LiteralPath $ArchivePath -Force
    }

    Write-Host "步骤 3: 下载 dev-build 压缩包"
    $downloadParams = @{
        Uri = $DownloadUrl
        OutFile = $ArchivePath
        Headers = @{ "User-Agent" = $UserAgent }
    }

    if (-not [string]::IsNullOrWhiteSpace($HttpProxy)) {
        $downloadParams["Proxy"] = $HttpProxy
    }

    Invoke-WebRequest @downloadParams

    Write-Host "步骤 4: 结束正在运行的 Twitch Drops Miner 进程"
    Stop-TwitchDropsMiner -ExePath $ExecutablePath -ExeName $ExecutableName

    Write-Host "步骤 5: 使用 7-Zip 覆盖解压到安装目录"
    & $SevenZipExe x $ArchivePath "-o$InstallDir" -y
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip 解压失败，退出码: $LASTEXITCODE"
    }

    Write-Host "步骤 6: 校验主程序并保存状态"
    if (-not (Test-Path -LiteralPath $ExecutablePath)) {
        throw "更新后未找到主程序: $ExecutablePath"
    }

    Set-LocalSha -Path $StateFile -Sha $remoteSha

    Write-Host "步骤 7: 启动 Twitch Drops Miner"
    Start-Process -FilePath $ExecutablePath -WorkingDirectory $InstallDir

    Write-Host "步骤 8: 清理临时压缩包"
    Remove-Item -LiteralPath $ArchivePath -Force -ErrorAction SilentlyContinue

    Write-Host "Twitch Drops Miner update success!"
    exit 0
} catch {
    Write-Host ("错误原因: " + $_.Exception.Message)
    Write-Host ("出错行号: " + $_.InvocationInfo.ScriptLineNumber)

    if (Test-Path -LiteralPath $ArchivePath) {
        Remove-Item -LiteralPath $ArchivePath -Force -ErrorAction SilentlyContinue
    }

    exit 1
}
