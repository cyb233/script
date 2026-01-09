@echo off&chcp 936>nul
title WinSW Java 服务管理脚本
setlocal enabledelayedexpansion

REM =========================
REM 固定配置
REM =========================
set SERVICE_EXE=service.exe
set SERVICE_XML=service.xml

REM =========================
REM 默认值
REM =========================
set DEF_ID=java-service
set DEF_JVM_OPTS=
set DEF_JAR_OPTS=

REM =========================
REM 检查 WinSW
REM =========================
if not exist "%SERVICE_EXE%" (
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
REM XML 不存在：创建流程
REM =========================
if not exist "%SERVICE_XML%" (

    echo.
    echo =====================================
    echo 未检测到 service.xml
    echo 开始创建 WinSW Java 服务配置
    echo =====================================
    echo.

    REM -------- Service ID --------
    set /p SID=请输入 Service ID（默认：%DEF_ID%）：
    if "!SID!"=="" set SID=%DEF_ID%

    REM -------- Name --------
    set /p SNAME=请输入服务显示名称（默认：!SID!）：
    if "!SNAME!"=="" set SNAME=!SID!

    REM -------- Description --------
    set /p SDESC=请输入服务描述（默认：Java 服务 !SID!）：
    if "!SDESC!"=="" set SDESC=Java 服务 !SID!

    REM -------- 自动探测 jar --------
    set AUTO_JAR=
    for %%f in (*.jar) do (
        set AUTO_JAR=%%f
        goto jar_found
    )

:jar_found
    if "!AUTO_JAR!"=="" (
        echo.
        echo [错误] 当前目录未找到任何 jar 文件
        pause
        exit /b 1
    )

    set /p JAR=请输入 jar 文件名（默认：!AUTO_JAR!）：
    if "!JAR!"=="" set JAR=!AUTO_JAR!

    if not exist "!JAR!" (
        echo.
        echo [错误] jar 文件不存在：!JAR!
        pause
        exit /b 1
    )

    REM -------- JVM 参数 --------
    set /p JVM_OPTS=请输入 JVM 参数（默认：%DEF_JVM_OPTS%）：
    if "!JVM_OPTS!"=="" set JVM_OPTS=%DEF_JVM_OPTS%

    REM -------- 应用参数 --------
    set /p APP_ARGS=请输入程序启动参数（默认：%DEF_JAR_OPTS%）：
    if "!APP_ARGS!"=="" set APP_ARGS=%DEF_JAR_OPTS%

    echo.
    echo 正在生成 UTF-8 编码的 service.xml ...
    echo.

    powershell -NoProfile -Command "$xml='<?xml version=''1.0'' encoding=''utf-8''?><service><id>!SID!</id><name>!SNAME!</name><description>!SDESC!</description><executable>java</executable><arguments>!JVM_OPTS! -jar ""!JAR!"" !APP_ARGS!</arguments><log mode=''roll'' /><onfailure action=''restart'' /></service>'; [System.IO.File]::WriteAllText('!SERVICE_XML!', $xml, [System.Text.Encoding]::UTF8)"

    if not exist "%SERVICE_XML%" (
        echo.
        echo [错误] 创建 service.xml 失败
        pause
        exit /b 1
    )

    echo service.xml 创建完成
    echo.

    choice /m "是否立即安装并启动该服务？"
    if errorlevel 2 exit /b 0

    echo.
    echo 正在安装服务...
    "%SERVICE_EXE%" install

    if errorlevel 1 (
        echo.
        echo [错误] 安装服务失败
        pause
        exit /b 1
    )

    echo 正在启动服务...
    "%SERVICE_EXE%" start

    if errorlevel 1 (
        echo.
        echo [错误] 启动服务失败
        pause
        exit /b 1
    )

    echo.
    echo 服务已成功安装并启动
    pause
    exit /b 0
)

REM =========================
REM XML 已存在：命令菜单
REM =========================
:menu
echo.
echo =====================================
echo WinSW 服务管理菜单
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

if not "!CMD!" == "status" (
    if errorlevel 1 (
        echo.
        echo [错误] 命令执行失败
        pause
        exit /b 1
    )
)

if "!CMD!" == "uninstall" (
    choice /m "是否删除 service.xml？"
    if errorlevel 1 (
        del "%SERVICE_XML%"
    )
)

set CMD=
pause
goto :menu
