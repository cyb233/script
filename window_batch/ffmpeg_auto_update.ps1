# 使用指定的 URL 下载最新的 FFmpeg 构建版本
$ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z"
# 设置 FFmpeg 安装目标路径
$ffmpeg_path = "D:\Program Files Green\ffmpeg\"
# 备份旧的 ffmpeg 目录为 zip 文件
$backup_zip = Join-Path $ffmpeg_path "ffmpeg_backup.zip"
# 定义临时存储下载的压缩文件路径
$ffmpeg_zip = Join-Path $env:TEMP "ffmpeg.7z"
# 设置代理地址
$proxy = "socks5://127.0.0.1:7890"
# 配置文件路径
$config_file = Join-Path $ffmpeg_path "config.ini"
# last-build 检查链接
$last_build_url = "https://www.gyan.dev/ffmpeg/builds/last-build-update"

# 默认 FFmpeg 相关文件/文件夹列表
$ffmpeg_items = @("bin", "doc", "presets", "LICENSE", "README.txt")

function Get-IniValue {
    param(
        [string]$file,
        [string]$key,
        [string]$defaultValue = $null
    )

    if (-not (Test-Path $file)) {
        return $defaultValue
    }

    $reader = [System.IO.File]::OpenText($file)
    try {
        while (($line = $reader.ReadLine()) -ne $null) {
            if ($line -match "^\s*$key\s*=\s*(.*)$") {
                return $matches[1].Trim()
            }
        }
    } finally {
        $reader.Close()
    }

    return $defaultValue
}



function Set-IniValue {
    param(
        [string]$file,
        [string]$key,
        [string]$value
    )
    if (-not (Test-Path $file)) {
        # 文件不存在，直接新建整行
        "$key=$value" | Out-File -FilePath $file -Encoding UTF8
        return
    }

    $lines = Get-Content $file
    $found = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$key\s*=") {
            # 找到目标行，替换内容
            $lines[$i] = "$key=$value"
            # 使用 Stream 重写目标行
            $fs = [System.IO.File]::Open($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite)
            $sw = New-Object System.IO.StreamWriter($fs, [System.Text.Encoding]::UTF8)
            $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
            $content = $sr.ReadToEnd() -split "`r?`n"
            $content[$i] = "$key=$value"
            $fs.SetLength(0) # 清空原文件
            $sw.BaseStream.Seek(0, 'Begin') | Out-Null
            $sw.Write(($content -join "`r`n"))
            $sw.Close()
            $sr.Close()
            $fs.Close()
            $found = $true
            break
        }
    }

    if (-not $found) {
        # 不存在，追加到文件末尾
        "$key=$value" | Add-Content -Path $file -Encoding UTF8
    }
}


Write-Host "步骤 0: 检查 FFmpeg 是否有新版本"
# 获取远程 last-build 内容
try {
    $webRequestParams = @{ Uri = $last_build_url }
    if ($proxy -and ($proxy -ne "")) {
        Write-Host "使用代理: $proxy"
        $webRequestParams["Proxy"] = $proxy
    }
    $response = Invoke-WebRequest @webRequestParams
    $remote_build = $response.Content
    if ($remote_build -is [byte[]]) {
        $remote_build = [System.Text.Encoding]::UTF8.GetString($remote_build)
    }
    $remote_build = $remote_build.Trim()
    Write-Host ("获取到的 last-build 信息: $remote_build")
} catch {
    Write-Host "无法获取 last-build 信息，跳过版本检查，继续更新流程。"
    $remote_build = $null
}

$local_build = Get-IniValue $config_file "last_build"
if ($local_build -and $remote_build) {
    if ($local_build -eq $remote_build) {
        Write-Host "FFmpeg 已是最新，无需更新。"
        exit 0
    }
}
Write-Host "FFmpeg $local_build -> $remote_build"

# 读取上次文件列表并覆盖默认变量
$last_files = Get-IniValue $config_file "last_files"
if ($last_files) {
    $ffmpeg_items = $last_files -split "\|"
}

Write-Host "步骤 1: 检查并删除已有临时压缩文件"
if (Test-Path $ffmpeg_zip) {
    # 如果临时压缩文件已存在，则删除以便重新下载更新版本
    Remove-Item $ffmpeg_zip -Force
}

Write-Host "步骤 2: 下载 FFmpeg 压缩包至临时路径"
$webRequestParams = @{ Uri = $ffmpeg_url; OutFile = $ffmpeg_zip }
if ($proxy -and ($proxy -ne "")) {
    Write-Host "使用代理: $proxy"
    $webRequestParams["Proxy"] = $proxy
}
Invoke-WebRequest @webRequestParams

Write-Host "步骤 3: 检查旧 FFmpeg 目录, 备份并删除旧版本"
if (Test-Path $ffmpeg_path) {
    # 备份内容
    $backup_items = @()
    foreach ($item in $ffmpeg_items) {
        $target = Join-Path $ffmpeg_path $item
        if (Test-Path $target) {
            $backup_items += $target
        }
    }
    if ($backup_items.Count -gt 0) {
        Compress-Archive -Path $backup_items -DestinationPath $backup_zip -Force
    }

    # 删除旧 FFmpeg 相关内容
    foreach ($item in $ffmpeg_items) {
        $target = Join-Path $ffmpeg_path $item
        if (Test-Path $target) {
            Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    Write-Host "步骤 4: 解压 FFmpeg 压缩包到目标路径"
    &7z.exe x $ffmpeg_zip -o"$ffmpeg_path" -y

    # 解决7z解压多出一层文件夹的问题
    $subdirs = Get-ChildItem -Directory -Path $ffmpeg_path
    if ($subdirs.Count -eq 1) {
        $extractedFolder = $subdirs[0].FullName
        Get-ChildItem -Path $extractedFolder | Move-Item -Destination $ffmpeg_path -Force
        Remove-Item $extractedFolder -Recurse -Force
    }

    # 获取根目录文件列表，排除 config.ini 和 ffmpeg_backup.zip
    $rootFiles = Get-ChildItem -Path $ffmpeg_path | Where-Object { $_.Name -ne "config.ini" -and $_.Name -ne "ffmpeg_backup.zip" } | Select-Object -ExpandProperty Name
    $rootFilesStr = ($rootFiles -join "|")

    # 保存 last_build 和文件列表到 config.ini
    if ($remote_build) {
        Set-IniValue $config_file "last_build" $remote_build
        Set-IniValue $config_file "last_files" $rootFilesStr
    }

    Write-Host "步骤 5: 删除临时的压缩文件"
    Remove-Item $ffmpeg_zip -Force

    Write-Host "步骤 6: 校验 FFmpeg 可执行文件"
    $ffmpeg_exe = Join-Path $ffmpeg_path "bin\ffmpeg.exe"
    $resolved_exe = Resolve-Path $ffmpeg_exe
    if (Test-Path $resolved_exe) {
        Write-Host "ffmpeg update success!"
    } else {
        throw "ffmpeg executable not found"
    }
    exit 0
} catch {
    Write-Host ("错误原因: " + $_.Exception.Message)
    Write-Host ("出错行号: " + $_.InvocationInfo.ScriptLineNumber)
    Write-Host "出错，恢复旧版本..."
    if (Test-Path $backup_zip) {
        # 删除可能存在的部分更新内容
        foreach ($item in $ffmpeg_items) {
            $target = Join-Path $ffmpeg_path $item
            if (Test-Path $target) {
                Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        Expand-Archive -Path $backup_zip -DestinationPath $ffmpeg_path -Force
        Write-Host "恢复成功."
    } else {
        Write-Host "找不到备份文件."
    }
    exit 1
}