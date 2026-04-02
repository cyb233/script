@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: Proxifier.exe 路径 （默认路径为 "C:\Program Files (x86)\Proxifier\Proxifier.exe"）
set "PROXIFIER_EXE=C:\Program Files (x86)\Proxifier\Proxifier.exe"
set "SERVICE_NAME=ProxifierDrv"
set "ACTION=%~1"

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

call :query_status

if /i "%ACTION%"=="start" goto auto_start
if /i "%ACTION%"=="stop" goto auto_stop
if not "%ACTION%"=="" (
    echo.
    echo 不支持的参数: %ACTION%
    echo 可用参数: start ^| stop
    goto end
)

goto show_menu

:query_status
set "SERVICE_STATE="
echo ==============================
echo   ProxifierDrv 服务控制
echo ==============================
echo 当前服务状态:
sc query "%SERVICE_NAME%"
for /f "tokens=3 delims=: " %%I in ('sc query "%SERVICE_NAME%" ^| findstr /R /C:"STATE *:"') do (
    set "SERVICE_STATE=%%I"
)
echo ==============================
if not defined SERVICE_STATE (
    echo 无法识别 %SERVICE_NAME% 当前状态。
)
exit /b

:show_menu
if /i "!SERVICE_STATE!"=="RUNNING" (
    echo [1] 停止 %SERVICE_NAME%
    echo [Q] 退出
    echo ==============================
    choice /c 1Q /n /m "请选择操作: "
    if errorlevel 2 goto exit
    if errorlevel 1 goto stop
)

if /i "!SERVICE_STATE!"=="STOPPED" (
    echo [1] 启动 %SERVICE_NAME%
    echo [Q] 退出
    echo ==============================
    choice /c 1Q /n /m "请选择操作: "
    if errorlevel 2 goto exit
    if errorlevel 1 goto start
)

echo 当前状态为 !SERVICE_STATE!，没有可用的交互操作。
goto exit

:auto_start
if /i "!SERVICE_STATE!"=="STOPPED" goto start
echo.
if /i "!SERVICE_STATE!"=="RUNNING" (
    echo %SERVICE_NAME% 当前已在运行，只允许执行 stop。
) else (
    echo %SERVICE_NAME% 当前状态为 !SERVICE_STATE!，无法执行 start。
)
goto end

:auto_stop
if /i "!SERVICE_STATE!"=="RUNNING" goto stop
echo.
if /i "!SERVICE_STATE!"=="STOPPED" (
    echo %SERVICE_NAME% 当前已停止，只允许执行 start。
) else (
    echo %SERVICE_NAME% 当前状态为 !SERVICE_STATE!，无法执行 stop。
)
goto end

:start
echo.
echo 正在启动 %SERVICE_NAME% 服务...
sc start "%SERVICE_NAME%"
echo.
echo 正在启动 Proxifier.exe...
start "" "%PROXIFIER_EXE%"
if errorlevel 1 (
    echo 启动 Proxifier.exe 失败，请手动启动。
)
goto end

:stop
echo.
echo 正在停止 Proxifier.exe...
taskkill /f /im Proxifier.exe >nul 2>&1
echo.
echo 正在停止 %SERVICE_NAME% 服务...
sc stop "%SERVICE_NAME%"
goto end

:exit
echo.
echo 已退出。
goto end

:end
echo.
set "COUNTDOWN=5"
:countdown
if !COUNTDOWN! gtr 0 (
    echo 程序将在 !COUNTDOWN! 秒后自动退出...
    timeout /t 1 >nul
    set /a COUNTDOWN-=1
    goto countdown
)
exit /b