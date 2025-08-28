@echo off
setlocal enabledelayedexpansion

:: 询问是否要直接copy流
choice /m "是否直接复制视频音频流而不转码"
set "docopy=%errorlevel%"

:: 遍历所有拖入的文件
for %%F in (%*) do (
    set "input=%%~F"
    set "output=%%~dpnF_fix.mp4"
    
    echo Processing: "!input!"

    if %docopy%==1 (
        :: 直接copy
        ffmpeg -i "!input!" -c copy "!output!"
    ) else (
        :: 转码逻辑
        set "vbit="
        set "abit="

        :: 获取视频码率 (单位: bit/s)
        for /f "usebackq tokens=*" %%a in (`ffprobe -v error -select_streams v:0 -show_entries stream^=bit_rate -of default^=nokey^=1:noprint_wrappers^=1 "%%~F"`) do set "vbit=%%a"
        
        :: 获取音频码率 (单位: bit/s)
        for /f "usebackq tokens=*" %%a in (`ffprobe -v error -select_streams a:0 -show_entries stream^=bit_rate -of default^=nokey^=1:noprint_wrappers^=1 "%%~F"`) do set "abit=%%a"

        set "vparam="
        set "aparam="

        if defined vbit (
            set /a vkb=!vbit! / 1000
            set "vparam=-b:v !vkb!k"
            echo Video bitrate: !vkb! kbps
        ) else (
            echo No video bitrate detected, using encoder default.
        )

        if defined abit (
            set /a akb=!abit! / 1000
            set "aparam=-b:a !akb!k"
            echo Audio bitrate: !akb! kbps
        ) else (
            echo No audio bitrate detected, using encoder default.
        )

        ffmpeg -i "!input!" -c:v hevc_nvenc !vparam! -c:a aac !aparam! "!output!"
    )

    echo Output: "!output!"
)

echo All files processed.
echo.

:: 如果有多个文件，才询问是否合并
set "count=0"
for %%i in (%*) do set /a count+=1
if %count% LEQ 1 goto end

echo 文件顺序如下：
for %%i in (%*) do echo %%~dpni_fix.mp4
echo.

choice /m "是否要合并以上文件为一个视频"
if errorlevel 2 goto end

:: 写入临时文件列表
> list.txt (
    for %%i in (%*) do echo file '%%~dpni_fix.mp4'
)

:: 执行合并
ffmpeg -f concat -safe 0 -i list.txt -c copy merged_output.mp4

echo 合并完成，输出文件: merged_output.mp4

:end
pause
