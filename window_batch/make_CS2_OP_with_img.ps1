# 设置控制台编码为 UTF-8
# [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 检查 FFmpeg 是否存在
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "请先下载 FFmpeg，将 ffmpeg.exe 与本文件放在同一目录下，或添加到环境变量 Path 中"
    Write-Host "下载地址：https://ffmpeg.org/download.html"
    $openUrl = Read-Host "是否打开下载页面？(y/n)"
    if ($openUrl -eq 'y') {
        Start-Process "https://ffmpeg.org/download.html"
    }
    pause
    exit
}

# 检查是否拖入了图片或文件夹
# 原有的 Read-Host/args 分支替换为 OpenFileDialog 多选支持，并兼容传入文件夹或单文件的参数
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()

$selectedFiles = @()

if ($args.Count -eq 0) {
    $ofd = New-Object System.Windows.Forms.OpenFileDialog
    $ofd.Filter = "图片文件 (*.jpg;*.jpeg;*.png)|*.jpg;*.jpeg;*.png|所有文件 (*.*)|*.*"
    $ofd.Multiselect = $true
    $ofd.Title = "请选择一张或多张图片（可多选）"
    $result = $ofd.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK -or $ofd.FileNames.Count -eq 0) {
        Write-Host "未选择任何文件。"
        pause
        exit
    }
    $selectedFiles = $ofd.FileNames
}
else {
    $inputPath = $args[0]
    if (-not (Test-Path $inputPath)) {
        Write-Host "路径不存在：$inputPath"
        pause
        exit
    }
    if ((Get-Item $inputPath).PSIsContainer) {
        # 如果是文件夹，读取该文件夹内的图片（与原逻辑一致）
        $selectedFiles = Get-ChildItem -Path "$inputPath\*" -Include *.jpg, *.jpeg, *.png -File | Select-Object -ExpandProperty FullName
        if ($selectedFiles.Count -eq 0) {
            Write-Host "未在文件夹中找到图片。"
            pause
            exit
        }
    }
    else {
        # 单个文件路径
        $selectedFiles = @($inputPath)
    }
}

Write-Host "已选择文件数量：$($selectedFiles.Count)"

$runPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 根据选中文件数量决定多图还是单图逻辑
if ($selectedFiles.Count -gt 1) {
    Write-Host "多张图片模式：生成 concat 列表并合成视频"
    $imageFiles = $selectedFiles
    $imageCount = $imageFiles.Count
    Write-Host "图片数量：$imageCount"

    $totalDuration = 3 # 总时长为3秒
    $durationPerImage = $totalDuration / $imageCount
    $inputListFile = "$env:TEMP\image_list.txt"
    Remove-Item -ErrorAction SilentlyContinue $inputListFile
    foreach ($image in $imageFiles) {
        Add-Content -Path $inputListFile -Value "file '$image'"
        Add-Content -Path $inputListFile -Value "duration $durationPerImage"
    }
    Write-Host "图片列表文件内容："
    Get-Content -Path $inputListFile

    $totalDuration720p = 6 # 总时长为6秒
    $durationPerImage720p = $totalDuration720p / $imageCount
    $inputListFile720p = "$env:TEMP\image_list_720p.txt"
    Remove-Item -ErrorAction SilentlyContinue $inputListFile720p
    foreach ($image in $imageFiles) {
        Add-Content -Path $inputListFile720p -Value "file '$image'"
        Add-Content -Path $inputListFile720p -Value "duration $durationPerImage720p"
    }
    Write-Host "图片列表文件内容720p："
    Get-Content -Path $inputListFile720p

    # 生成视频
    ffmpeg -f concat -safe 0 -i "$inputListFile"  -s 3840x2160 -r 24 -t 3 -crf 18 -y "$runPath\intro.webm"
    ffmpeg -f concat -safe 0 -i "$inputListFile720p" -s 1280x720 -r 60 -t 6 -crf 18 -y "$runPath\intro720p.webm"
    Remove-Item -ErrorAction SilentlyContinue $inputListFile
    Remove-Item -ErrorAction SilentlyContinue $inputListFile720p
}
else {
    Write-Host "单张图片模式：使用 -loop 1 合成固定时长视频"
    $singleImage = $selectedFiles[0]
    ffmpeg -loop 1 -i "$singleImage" -s 3840x2160 -r 24 -t 3 -crf 18 -y "$runPath\intro.webm"
    ffmpeg -loop 1 -i "$singleImage" -s 1280x720 -r 60 -t 6 -crf 18 -y "$runPath\intro720p.webm"
}

Copy-Item "$runPath\intro.webm" "$runPath\intro-perfectworld.webm"
Copy-Item "$runPath\intro720p.webm" "$runPath\intro-perfectworld720p.webm"

# 通知用户
Write-Host "视频已生成："
Write-Host "$runPath\intro.webm"
Write-Host "$runPath\intro720p.webm"
Write-Host "$runPath\intro-perfectworld.webm"
Write-Host "$runPath\intro-perfectworld720p.webm"
Write-Host ""
Write-Host "替换以上文件至 Counter-Strike Global Offensive\game\csgo\panorama\videos 目录即可"
Write-Host "检查游戏完整性即可恢复为原文件"

# 询问是否立即替换
$replaceNow = Read-Host "是否立即替换视频文件？(y/n)"
if ($replaceNow -eq 'y') {
    try {
        $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App 730"
        if (-not (Test-Path $registryPath)) {
            Write-Host "未找到 Steam App 730 的注册表路径，无法替换视频文件。"
            Write-Host "请自行手动替换至 Counter-Strike Global Offensive\game\csgo\panorama\videos 目录。"
            pause
            exit
        }
        
        $csgoPath = (Get-ItemProperty -Path $registryPath).InstallLocation
        $videoPath = Join-Path -Path $csgoPath -ChildPath "game\csgo\panorama\videos"
        
        Copy-Item "$runPath\intro.webm" "$videoPath\intro.webm" -Force
        Copy-Item "$runPath\intro720p.webm" "$videoPath\intro720p.webm" -Force
        Copy-Item "$runPath\intro-perfectworld.webm" "$videoPath\intro-perfectworld.webm" -Force
        Copy-Item "$runPath\intro-perfectworld720p.webm" "$videoPath\intro-perfectworld720p.webm" -Force
        
        Write-Host "视频文件已成功替换。"
    }
    catch {
        Write-Host "替换视频文件时出错：$_"
    }
}
else {
    Write-Host "已取消替换视频文件。"
}
pause
