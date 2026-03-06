@echo off
setlocal

echo ================================
echo      SteamCMD 服务端下载工具
echo ================================
echo.

:: 检查 steamcmd.exe
if not exist "%~dp0steamcmd.exe" (
    echo 未找到 steamcmd.exe，请将脚本放在 steamcmd 同级目录
    pause
    exit /b
)

:: 输入安装目录
set /p INSTALL_DIR=请输入目标安装路径:

if "%INSTALL_DIR%"=="" (
    echo 安装路径不能为空
    pause
    exit /b
)

:: 输入 AppID
set /p APP_ID=请输入 AppID:

if "%APP_ID%"=="" (
    echo AppID 不能为空
    pause
    exit /b
)

:: 创建目录
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

echo.
echo 开始下载服务器...
echo.

:: 执行下载
"%~dp0steamcmd.exe" ^
+force_install_dir "%INSTALL_DIR%" ^
+login anonymous ^
+app_update %APP_ID% validate ^
+quit

echo.
echo 下载完成
echo.

:: 生成更新脚本
set UPDATE_FILE=%INSTALL_DIR%\update_server.bat

(
echo @echo off
echo echo Updating server...
echo "%~dp0steamcmd.exe" +force_install_dir "%INSTALL_DIR%" +login anonymous +app_update %APP_ID% validate +quit
echo echo.
echo echo Update finished.
echo pause
) > "%UPDATE_FILE%"

echo 已生成更新脚本:
echo %UPDATE_FILE%

echo.
pause