# 使用指定的 URL 下载最新的 FFmpeg 构建版本
$ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z"
# 设置 FFmpeg 安装目标路径
$ffmpeg_path = "D:\Program Files Green\ffmpeg\"
# 备份旧的 ffmpeg 目录为 zip 文件
$backup_zip = "D:\Program Files Green\ffmpeg_backup.zip"
# 定义临时存储下载的压缩文件路径
$ffmpeg_zip = "$env:TEMP\ffmpeg.7z"
# 设置代理地址
$proxy = "socks5://127.0.0.1:7890"

Write-Host "步骤 1: 检查并删除已有临时压缩文件"
if (Test-Path $ffmpeg_zip) {
    # 如果临时压缩文件已存在，则删除以便重新下载更新版本
    Remove-Item $ffmpeg_zip -Force
}

Write-Host "步骤 2: 下载 FFmpeg 压缩包至临时路径"
$webRequestParams = @{ Uri = $ffmpeg_url; OutFile = $ffmpeg_zip }
if ($proxy -and ($proxy -ne "")) {
    $webRequestParams["Proxy"] = $proxy
}
Invoke-WebRequest @webRequestParams

Write-Host "步骤 3: 检查旧 FFmpeg 目录, 备份并删除旧版本"
if (Test-Path $ffmpeg_path) {
    # 如果 FFmpeg 目录已存在，则备份旧版本（只备份内容去除顶级文件夹）
    Compress-Archive -Path "$ffmpeg_path*" -DestinationPath $backup_zip -Force
    # 删除旧 FFmpeg 目录以清理旧版本
    Remove-Item $ffmpeg_path -Recurse -Force
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
} catch {
    Write-Host "出错，恢复旧版本..."
    if (Test-Path $backup_zip) {
        # 删除可能存在的部分更新内容
        Remove-Item $ffmpeg_path -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive -Path $backup_zip -DestinationPath "D:\Program Files Green\ffmpeg" -Force
        Write-Host "恢复成功."
    } else {
        Write-Host "找不到备份文件."
    }
    exit 1
}