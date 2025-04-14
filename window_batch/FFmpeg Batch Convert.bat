@echo off
:: 关闭回显
setlocal enabledelayedexpansion

:: 遍历所有拖入的文件
for %%F in (%*) do (
    set "input=%%~F"
    set "output=%%~dpnF_fix.mp4"
    
    echo Processing: "!input!"
    ffmpeg -i "!input!" -c:v hevc_nvenc "!output!"
    echo Output: "!output!"
)

echo All files processed.
pause
