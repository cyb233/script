@echo off
rem Check FFmpeg exists
where ffmpeg 1>nul 2>&1
if ERRORLEVEL 1 (
    echo 请先下载FFmpeg，与本文件放在同一目录下，或添加到环境变量Path中
    pause
    exit /b
)

rem Check if any images are dragged into the scriptrem 检查是否有图像被拖入脚本中
if "%~1"=="" (
    echo 请将图片拖放到此脚本上以生成视频。
    pause
    exit /b
)

rem Get the dragged image path
set "image=%~1"

rem Set the output video file name
set "output=%~dp1intro.webm"
set "output720=%~dp1intro720p.webm"
set "outputpw=%~dp1intro-perfectworld.webm"
set "output720pw=%~dp1intro-perfectworld720p.webm"

rem Call ffmpeg to create the video
"%~dp0ffmpeg" -loop 1 -i "%image%" -s 3840*2160 -r 24 -t 3 -y "%output%"
"%~dp0ffmpeg" -loop 1 -i "%image%" -s 1280*720 -r 60 -t 6 -y "%output720%"
copy "%output%" "%outputpw%"
copy "%output720%" "%output720pw%"

rem Notify the user
echo 视频已生成：
echo %output%
echo %output720%
echo %outputpw%
echo %output720pw%
echo=
echo 替换以上文件至 Counter-Strike Global Offensive\game\csgo\panorama\videos 目录即可
pause
