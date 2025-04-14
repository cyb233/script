@echo off&chcp 65001
setlocal enabledelayedexpansion

:: 检查是否通过拖拽文件启动
if "%~1"=="" (
    echo 请将视频文件拖入此窗口，或手动输入文件路径：
    set /p input_file=
) else (
    set "input_file=%~1"
)

:: 确保文件存在
if not exist "%input_file%" (
    echo 错误：文件不存在！
    pause
    exit /b
)

:: 获取文件名（不含扩展名）
for %%F in ("%input_file%") do set "file_name=%%~nF"

:loop
:: 让用户输入切割起始时间
set /p start_time=请输入切割开始时间 (格式 hh:mm:ss 或 ss): 

:: 让用户输入持续时间
set /p duration=请输入持续时间 (格式 hh:mm:ss 或 ss): 

:: 替换时间格式中的冒号 ":" 为 "_"
set "safe_start_time=%start_time::=_%"
set "safe_duration=%duration::=_%"

:: 生成输出文件名（格式：原文件名_开始时间_持续时间.mp4）
set "output_file=%file_name%_%safe_start_time%_%safe_duration%.mp4"

:: 执行 FFmpeg 命令
echo 正在切割视频...
ffmpeg -i "%input_file%" -ss %start_time% -t %duration% -c copy "%output_file%"

echo 切割完成，文件保存为 %output_file%
echo -----------------------------------------
echo.

:: 继续循环
goto loop
