# 设置控制台编码为 UTF-8
# [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 检查 FFmpeg 是否存在
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "请先下载 FFmpeg，将 ffmpeg.exe 与本文件放在同一目录下，或添加到环境变量 Path 中"
    pause
    exit
}

# 检查是否拖入了图片或文件夹
if ($args.Count -eq 0) {
    $inputPath = Read-Host "请输入图片或文件夹路径"
    if ([string]::IsNullOrWhiteSpace($inputPath)) {
        Write-Host "未输入路径。"
        pause
        exit
    }
} else {
    $inputPath = $args[0]
}
Write-Host "输入路径：$inputPath"

$runPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 检查输入是文件夹还是单张图片
if (Test-Path "$inputPath\*") {
    # 输入是文件夹
    $isDir = $true
    $basePath = $inputPath
} else {
    # 输入是单张图片
    $isDir = $false
    $basePath = Split-Path -Parent $inputPath
}

if ($isDir) {
    Write-Host "输入目录：$inputPath"
    # 获取图片列表并生成文件列表
    $imageFiles = Get-ChildItem -Path $inputPath\* -Include *.jpg, *.jpeg, *.png -File
    $imageCount = $imageFiles.Count
    Write-Host "图片数量：$imageCount"
    
    if ($imageCount -eq 0) {
        Write-Host "未找到任何图片文件，请检查路径和文件类型。"
        pause
        exit
    }
    
    $totalDuration = 3 # 总时长为3秒
    $durationPerImage = $totalDuration / $imageCount
    $inputListFile = "$env:TEMP\image_list.txt"
    $imageFiles | ForEach-Object {
        $image = $_.FullName
        Add-Content -Path $inputListFile -Value "file '$image'"
        Add-Content -Path $inputListFile -Value "duration $durationPerImage"
    }
    
    $totalDuration720p = 6 # 总时长为6秒
    $durationPerImage720p = $totalDuration720p / $imageCount
    $inputListFile720p = "$env:TEMP\image_list_720p.txt"
    $imageFiles | ForEach-Object {
        $image = $_.FullName
        Add-Content -Path $inputListFile720p -Value "file '$image'"
        Add-Content -Path $inputListFile720p -Value "duration $durationPerImage720p"
    }
    
    # 生成视频
    ffmpeg -f concat -safe 0 -i "$inputListFile"  -s 3840x2160 -r 24 -t 3 -y "$runPath\intro.webm"
    ffmpeg -f concat -safe 0 -i "$inputListFile720p" -s 1280x720 -r 60 -t 6 -y "$runPath\intro720p.webm"
    Remove-Item $inputListFile
    Remove-Item $inputListFile720p
} else {
    Write-Host "输入图片：$inputPath"
    ffmpeg -loop 1 -i "$inputPath" -s 3840x2160 -r 24 -t 3 -y "$runPath\intro.webm"
    ffmpeg -loop 1 -i "$inputPath" -s 1280x720 -r 60 -t 6 -y "$runPath\intro720p.webm"
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
pause
