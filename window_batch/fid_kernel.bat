@echo off
setlocal EnableExtensions

set "SERVICE_NAME=fid_kernel"

:: 检查是否具有管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 检测到当前不是管理员，正在尝试以管理员权限重新运行...
    echo CreateObject^("Shell.Application"^).ShellExecute "%~s0", "%*", "", "runas", 1 > "%temp%\getadmin.vbs"
    cscript //nologo "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /b
)

title fid_kernel 删除工具

echo ==============================
echo   fid_kernel 删除工具
echo ==============================

sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 1060 (
    echo 未检测到服务 %SERVICE_NAME%，无需处理。
    goto end
)

echo 检测到服务 %SERVICE_NAME%。
echo.
echo 正在停止服务...
sc stop "%SERVICE_NAME%"

echo.
echo 正在删除服务...
sc delete "%SERVICE_NAME%"

:end
echo.
pause
exit /b
