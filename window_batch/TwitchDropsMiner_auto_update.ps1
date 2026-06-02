# Twitch Drops Miner dev-build 自动更新脚本
# 计划任务示例:
# "C:\Program Files\PowerShell\7\pwsh.exe" -File "E:\dev\script\window_batch\TwitchDropsMiner_auto_update.ps1"

# ----------------------------
# 可按需修改的常量
# ----------------------------

# GitHub dev-build release 检查地址
$ReleaseApiUrl = "https://api.github.com/repos/DevilXD/TwitchDropsMiner/releases/tags/dev-build"

# dev-build 中的 Windows 压缩包资产名称
$WindowsAssetName = "Twitch.Drops.Miner.Windows.zip"

# 安装目录。压缩包内容会直接覆盖解压到这里
$InstallDir = "D:\Program Files Green\Twitch Drops Miner"

# 主程序文件名，用于校验和定位需要结束的进程
$ExecutableName = "Twitch Drops Miner (by DevilXD).exe"
$ExecutablePath = Join-Path $InstallDir $ExecutableName

# 本脚本保存上次已安装 dev-build release 信息的状态文件
$StateFile = Join-Path $InstallDir "TwitchDropsMiner_auto_update_state.json"

# 临时下载文件路径。每次运行会先删除旧的临时文件
$ArchivePath = Join-Path $env:TEMP $WindowsAssetName

# 临时解压目录。先解压到这里，再把实际文件复制到安装目录，避免多出一层文件夹
$ExtractDir = Join-Path $env:TEMP "Twitch.Drops.Miner.Windows.extract"

# 7-Zip 可执行程序。若 7z.exe 不在 PATH 中，可改成完整路径，例如:
# $SevenZipExe = "C:\Program Files\7-Zip\7z.exe"
$SevenZipExe = "7z.exe"

# 结束 Twitch Drops Miner 后等待进程退出和主程序文件解锁的最长时间
$ProcessExitTimeoutSeconds = 30
$FileUnlockTimeoutSeconds = 30

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

function Get-LocalReleaseState {
    param(
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Host "状态文件读取失败，将按未安装当前版本处理: $($_.Exception.Message)"
        return $null
    }
}

function Set-LocalReleaseState {
    param(
        [string]$Path,
        [psobject]$ReleaseInfo,
        [string]$ExecutablePath
    )

    $executable = Get-Item -LiteralPath $ExecutablePath -ErrorAction Stop

    $state = [ordered]@{
        reference_commit = $ReleaseInfo.ReferenceCommit
        release_published_at = $ReleaseInfo.ReleasePublishedAt
        asset_name = $ReleaseInfo.AssetName
        asset_updated_at = $ReleaseInfo.AssetUpdatedAt
        executable_last_write_time = $executable.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss zzz")
        updated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")
    }

    $state | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-GitHubApiHeaders {
    param(
        [string]$Agent,
        [string]$Authorization
    )

    $headers = @{
        "User-Agent" = $Agent
        "Accept" = "application/vnd.github+json"
    }

    if (-not [string]::IsNullOrWhiteSpace($Authorization)) {
        $headers["Authorization"] = "Bearer $Authorization"
    }

    return $headers
}

function Get-DevBuildReleaseInfo {
    param(
        [string]$Url,
        [string]$AssetName,
        [string]$Agent,
        [string]$Authorization,
        [string]$Proxy
    )

    $headers = Get-GitHubApiHeaders -Agent $Agent -Authorization $Authorization

    $requestParams = @{
        Uri = $Url
        Headers = $headers
        Method = "Get"
    }

    if (-not [string]::IsNullOrWhiteSpace($Proxy)) {
        $requestParams["Proxy"] = $Proxy
    }

    $release = Invoke-RestMethod @requestParams

    if ($release.tag_name -ne "dev-build") {
        throw "GitHub API 响应中的 release tag 不是 dev-build: $($release.tag_name)"
    }

    $referenceCommitMatch = [regex]::Match($release.body, "Reference commit:\s*([0-9a-fA-F]{40})")
    if (-not $referenceCommitMatch.Success) {
        throw "dev-build release body 中没有找到 Reference commit"
    }

    $asset = @($release.assets) | Where-Object { $_.name -eq $AssetName } | Select-Object -First 1
    if (-not $asset) {
        throw "dev-build release 中没有找到 Windows 资产: $AssetName"
    }

    if ($asset.state -and ($asset.state -ne "uploaded")) {
        throw "Windows 资产尚未上传完成，当前状态: $($asset.state)"
    }

    if (-not $asset.browser_download_url) {
        throw "Windows 资产中没有 browser_download_url"
    }

    return [pscustomobject]@{
        ReferenceCommit = $referenceCommitMatch.Groups[1].Value.ToLowerInvariant()
        DownloadUrl = $asset.browser_download_url
        ReleasePublishedAt = $release.published_at
        AssetName = $asset.name
        AssetUpdatedAt = $asset.updated_at
    }
}

function Wait-ProcessExit {
    param(
        [int]$ProcessId,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return
        }

        Start-Sleep -Milliseconds 500
    }

    if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
        throw "进程 PID=$ProcessId 在 $TimeoutSeconds 秒内未退出"
    }
}

function Test-FileUnlocked {
    param(
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $true
    }

    try {
        $stream = [System.IO.File]::Open(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
        $stream.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-FileUnlocked {
    param(
        [string]$Path,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-FileUnlocked -Path $Path) {
            return
        }

        Start-Sleep -Milliseconds 500
    }

    throw "文件在 $TimeoutSeconds 秒内仍被占用: $Path"
}

function Stop-TwitchDropsMiner {
    param(
        [string]$ExePath,
        [string]$ExeName,
        [int]$ExitTimeoutSeconds,
        [int]$UnlockTimeoutSeconds
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
            Wait-ProcessExit -ProcessId $processId -TimeoutSeconds $ExitTimeoutSeconds
        }
    }

    Wait-FileUnlocked -Path $ExePath -TimeoutSeconds $UnlockTimeoutSeconds
}

# ----------------------------
# 主流程
# ----------------------------

try {
    Write-Host "步骤 0: 检查 7-Zip"
    if (-not (Get-Command $SevenZipExe -ErrorAction SilentlyContinue)) {
        throw "找不到 $SevenZipExe，请确认 7-Zip 已安装并加入 PATH，或在脚本顶部配置完整路径。"
    }

    Write-Host "步骤 1: 获取远程 dev-build release 信息"
    $remoteRelease = Get-DevBuildReleaseInfo -Url $ReleaseApiUrl -AssetName $WindowsAssetName -Agent $UserAgent -Authorization $GitHubAuthorization -Proxy $HttpProxy
    Write-Host "远程 Reference commit: $($remoteRelease.ReferenceCommit)"
    Write-Host "远程发布时间: $($remoteRelease.ReleasePublishedAt)"
    Write-Host "远程资产: $($remoteRelease.AssetName)"

    $localState = Get-LocalReleaseState -Path $StateFile
    $localReferenceCommit = $localState.reference_commit
    if ($localReferenceCommit) {
        Write-Host "本地 Reference commit: $localReferenceCommit"
    } else {
        Write-Host "本地 Reference commit: 无记录，将执行更新"
    }

    if ($localReferenceCommit -and ($localReferenceCommit -eq $remoteRelease.ReferenceCommit)) {
        if ($localState.executable_last_write_time) {
            Write-Host "Twitch Drops Miner 已是最新，无需更新。"
            exit 0
        }

        Write-Host "本地状态缺少成功安装标记，将重新执行更新"
    }

    Write-Host "步骤 2: 准备安装目录和临时文件"
    if (-not (Test-Path -LiteralPath $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    if (Test-Path -LiteralPath $ArchivePath) {
        Remove-Item -LiteralPath $ArchivePath -Force
    }

    if (Test-Path -LiteralPath $ExtractDir) {
        Remove-Item -LiteralPath $ExtractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

    Write-Host "步骤 3: 下载 dev-build 压缩包"
    $downloadParams = @{
        Uri = $remoteRelease.DownloadUrl
        OutFile = $ArchivePath
        Headers = @{ "User-Agent" = $UserAgent }
    }

    if (-not [string]::IsNullOrWhiteSpace($GitHubAuthorization)) {
        $downloadParams.Headers["Authorization"] = "Bearer $GitHubAuthorization"
    }

    if (-not [string]::IsNullOrWhiteSpace($HttpProxy)) {
        $downloadParams["Proxy"] = $HttpProxy
    }

    Invoke-WebRequest @downloadParams

    Write-Host "步骤 4: 结束正在运行的 Twitch Drops Miner 进程"
    Stop-TwitchDropsMiner -ExePath $ExecutablePath -ExeName $ExecutableName -ExitTimeoutSeconds $ProcessExitTimeoutSeconds -UnlockTimeoutSeconds $FileUnlockTimeoutSeconds

    Write-Host "步骤 5: 使用 7-Zip 解压到临时目录"
    & $SevenZipExe x $ArchivePath "-o$ExtractDir" -y
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip 解压失败，退出码: $LASTEXITCODE"
    }

    # 如果压缩包内只有一个顶层文件夹，则把该文件夹作为实际复制来源。
    # 这样可以避免安装目录下多出一层 TwitchDropsMiner 或类似目录。
    $extractItems = @(Get-ChildItem -LiteralPath $ExtractDir -Force)
    if (($extractItems.Count -eq 1) -and $extractItems[0].PSIsContainer) {
        $copySource = $extractItems[0].FullName
    } else {
        $copySource = $ExtractDir
    }

    Write-Host "步骤 6: 覆盖复制文件到安装目录"
    Copy-Item -Path (Join-Path $copySource "*") -Destination $InstallDir -Recurse -Force -ErrorAction Stop

    Write-Host "步骤 7: 校验主程序并保存状态"
    if (-not (Test-Path -LiteralPath $ExecutablePath)) {
        throw "更新后未找到主程序: $ExecutablePath"
    }

    Set-LocalReleaseState -Path $StateFile -ReleaseInfo $remoteRelease -ExecutablePath $ExecutablePath

    Write-Host "步骤 8: 启动 Twitch Drops Miner"
    Start-Process -FilePath $ExecutablePath -WorkingDirectory $InstallDir

    Write-Host "步骤 9: 清理临时文件"
    Remove-Item -LiteralPath $ArchivePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "Twitch Drops Miner update success!"
    exit 0
} catch {
    Write-Host ("错误原因: " + $_.Exception.Message)
    Write-Host ("出错行号: " + $_.InvocationInfo.ScriptLineNumber)

    if (Test-Path -LiteralPath $ArchivePath) {
        Remove-Item -LiteralPath $ArchivePath -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath $ExtractDir) {
        Remove-Item -LiteralPath $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    exit 1
}
