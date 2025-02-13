@echo off & title CSGO启动图 & chcp 65001 >nul
rem 检查 FFmpeg 是否存在
where ffmpeg 1>nul 2>&1
if ERRORLEVEL 1 (
    echo 请先下载 FFmpeg，将 ffmpeg.exe 与本文件放在同一目录下，或添加到环境变量 Path 中
    pause
    exit /b
)

rem 检查是否拖入了图片或文件夹
setlocal enabledelayedexpansion
if "%~1"=="" (
    set /p "input=请输入图片或文件夹路径："
    if "!input!"=="" (
        echo 未输入路径。
        pause
        exit /b
    )
) else (
    set "input=%~1"
)
setlocal disabledelayedexpansion
echo 输入路径：%input%

set "runPath=%~dp0"

rem 检查输入是文件夹还是单张图片
if exist "%input%\*" (
    rem 输入是文件夹
    set "isDir=true"
    set "basePath=%input%"
) else (
    rem 输入是单张图片
    set "isDir=false"
    set "basePath=%~dp1"
)

if "%isDir%"=="true" (
    echo 输入目录：%input%
    rem 获取图片列表并生成文件列表
    (for %%i in ("%input%\*.jpg" "%input%\*.jpeg" "%input%\*.png") do echo file '%%i') > "%runPath%image_list.txt"
    rem 获取图片数量
    for /f %%A in ('find /c /v "" ^< "%runPath%image_list.txt"') do set "imageCount=%%A"
    echo 图片数量：%imageCount%
    rem 生成视频
    ffmpeg -f concat -safe 0 -i "%runPath%image_list.txt" -s 3840x2160 -r 24 -t 3 -y "%runPath%intro.webm"
    ffmpeg -f concat -safe 0 -i "%runPath%image_list.txt" -s 1280x720 -r 60 -t 6 -y "%runPath%intro720p.webm"
) else (
    echo 输入图片：%input%
    ffmpeg -loop 1 -i "%input%" -s 3840x2160 -r 24 -t 3 -y "%runPath%intro.webm"
    ffmpeg -loop 1 -i "%input%" -s 1280x720 -r 60 -t 6 -y "%runPath%intro720p.webm"
)

copy "%runPath%intro.webm" "%runPath%intro-perfectworld.webm"
copy "%runPath%intro720p.webm" "%runPath%intro-perfectworld720p.webm"

rem 通知用户
echo 视频已生成：
echo %runPath%intro.webm
echo %runPath%intro720p.webm
echo %runPath%intro-perfectworld.webm
echo %runPath%intro-perfectworld720p.webm
echo=
echo 替换以上文件至 Counter-Strike Global Offensive\game\csgo\panorama\videos 目录即可
echo 检查游戏完整性即可恢复为原文件
pause
