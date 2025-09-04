@echo off&chcp 65001>nul

:: Proxifier.exe 路径 （默认路径为 "C:\Program Files (x86)\Proxifier\Proxifier.exe"）
set PATH_TO_PROXIFIER="C:\Program Files (x86)\Proxifier\Proxifier.exe"

:: 检查是否管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 检测到当前不是管理员，正在尝试以管理员权限重新启动...
    :: 生成临时 VBS 文件
    echo CreateObject^("Shell.Application"^).ShellExecute "%~s0", "%*", "", "runas", 1 > "%temp%\getadmin.vbs"
    :: 执行 VBS
    cscript //nologo "%temp%\getadmin.vbs"
    :: 删除临时 VBS
    del "%temp%\getadmin.vbs"
    exit /b
)

:: ==============================
:: 到这里说明已是管理员权限
:: ==============================

title ProxifierDrv 服务控制

echo ==============================
echo   ProxifierDrv 服务控制菜单
echo ==============================
echo 当前状态:
sc query ProxifierDrv
echo ==============================
echo [1] 启动 ProxifierDrv
echo [2] 停止 ProxifierDrv
echo [Q] 退出
echo ==============================

choice /c 12Q /n /m "请选择操作: "

if errorlevel 3 goto exit
if errorlevel 2 goto stop
if errorlevel 1 goto start

:start
echo.
echo 正在启动 ProxifierDrv 服务...
sc start ProxifierDrv
echo.
echo 正在启动 Proxifier.exe...
start "" %PATH_TO_PROXIFIER%
if %errorlevel% neq 0 (
    echo 启动 Proxifier.exe 失败，请手动启动。
)
goto end

:stop
echo.
echo 正在停止 Proxifier.exe...
taskkill /f /im Proxifier.exe
echo.
echo 正在停止 ProxifierDrv 服务...
sc stop ProxifierDrv
goto end

:exit
echo.
echo 已退出。
goto end

:end
echo.
setlocal enabledelayedexpansion
set COUNTDOWN=3
:countdown
if !COUNTDOWN! gtr 0 (
    echo 程序将在 !COUNTDOWN! 秒后自动退出...
    timeout /t 1 >nul
    set /a COUNTDOWN-=1
    goto countdown
)
endlocal
exit /b