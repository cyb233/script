@echo off&chcp 65001>nul
setlocal enabledelayedexpansion

REM 获取GIF路径
if "%~1"=="" (
    set /p "gif_path=请输入GIF文件路径: "
) else (
    set "gif_path=%~1"
)

REM 检查文件是否存在
if not exist "%gif_path%" (
    echo 文件不存在: %gif_path%
    pause
    exit /b 1
)

REM 获取文件名和目录
for %%F in ("%gif_path%") do (
    set "gif_dir=%%~dpF"
    set "gif_name=%%~nF"
)

REM 询问scale参数
set "scale_param="
set /p "scale_param=请输入scale参数(如360:360,留空则不缩放): "

if not "%scale_param%"=="" (
    set "vf_param=-vf scale=%scale_param%"
) else (
    set "vf_param="
)

REM 询问输出格式
set "ext=png"
set /p "ext=请输入输出格式(png/jpg,默认png): "
if /i "%ext%"=="" set "ext=png"
if /i not "%ext%"=="png" if /i not "%ext%"=="jpg" (
    echo 仅支持png或jpg
    pause
    exit /b 1
)

REM 创建输出文件夹
set "out_dir=%gif_dir%%gif_name%"
if not exist "%out_dir%" (
    mkdir "%out_dir%"
)

REM 组装输出路径
set "out_path=%out_dir%\%%03d.%ext%"

REM 执行ffmpeg命令
echo 正在提取帧...
ffmpeg -y -i "%gif_path%" %vf_param% "%out_path%"

echo 完成，帧已输出到: %out_dir%
pause
