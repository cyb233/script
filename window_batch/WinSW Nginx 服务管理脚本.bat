@echo off&chcp 936>nul
title WinSW Nginx 服务管理脚本
setlocal enabledelayedexpansion

REM =========================
REM 固定配置
REM =========================
set SERVICE_EXE=nginx-service.exe
set SERVICE_XML=nginx-service.xml

REM =========================
REM 检查 WinSW
REM =========================
if not exist "%SERVICE_EXE%" (
    REM 尝试查找 WinSW-x64.exe
    if exist "WinSW-x64.exe" (
        echo [提示] 未找到 %SERVICE_EXE%，检测到 WinSW-x64.exe
        echo 正在重命名 WinSW-x64.exe 为 %SERVICE_EXE% ...
        ren "WinSW-x64.exe" "%SERVICE_EXE%"
        if errorlevel 1 (
            echo [错误] 重命名失败
            pause
            exit /b 1
        )
    ) else (
        echo [错误] 未找到 %SERVICE_EXE%
        echo 请将 WinSW-x64.exe 重命名为 %SERVICE_EXE% 并放在当前目录
        pause
        exit /b 1
    )
)

REM =========================
REM 命令菜单
REM =========================
:menu
echo.
echo =====================================
echo WinSW Nginx 服务管理菜单
echo =====================================
echo.
echo 1. 安装服务（install）
echo 2. 卸载服务（uninstall）
echo 3. 启动服务（start）
echo 4. 停止服务（stop）
echo 5. 重启服务（restart）
echo 6. 查看状态（status）
echo 7. 刷新配置（refresh）
echo 0. 退出
echo.

set /p CHOICE=请输入操作编号（0-7）： 

if "%CHOICE%"=="0" exit /b 0
if "%CHOICE%"=="1" set CMD=install
if "%CHOICE%"=="2" set CMD=uninstall
if "%CHOICE%"=="3" set CMD=start
if "%CHOICE%"=="4" set CMD=stop
if "%CHOICE%"=="5" set CMD=restart
if "%CHOICE%"=="6" set CMD=status
if "%CHOICE%"=="7" set CMD=refresh

if not defined CMD goto :menu

echo.
echo 执行命令：%SERVICE_EXE% !CMD!
echo.

"%SERVICE_EXE%" !CMD!

if not "!CMD!"=="status" (
    if errorlevel 1 (
        echo.
        echo [错误] 命令执行失败
        pause
        exit /b 1
    )
)

set CMD=
pause
goto :menu
