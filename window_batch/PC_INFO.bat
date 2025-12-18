@echo off&title PC Information

setlocal enabledelayedexpansion

set "OUTPUT_FILE=%~dp0PCINFO.txt"
echo %OUTPUT_FILE%

echo Gathering system information...
echo.

rem Windows Information
echo Windows Information:
echo Windows Information: > %OUTPUT_FILE%
set "caption="
for /f "tokens=2 delims==" %%i in ('wmic os get Caption /value') do set "caption=%%i"
set "version="
for /f "tokens=2 delims==" %%i in ('wmic os get Version /value') do set "version=%%i"
set "build="
for /f "tokens=2 delims==" %%i in ('wmic os get BuildNumber /value') do set "build=%%i"
echo Caption: !caption!
echo Version: !version!
echo Build: !build!
echo Caption: !caption!Version: !version!Build: !build! >> %OUTPUT_FILE%

rem CPU Information
echo.
echo CPU Information:
echo CPU Information: >> %OUTPUT_FILE%
set "cpu_name="
for /f "tokens=2 delims==" %%i in ('wmic cpu get Name /value') do set "cpu_name=%%i"
set "cores="
for /f "tokens=2 delims==" %%i in ('wmic cpu get NumberOfCores /value') do set "cores=%%i"
set "logical="
for /f "tokens=2 delims==" %%i in ('wmic cpu get NumberOfLogicalProcessors /value') do set "logical=%%i"
echo Name: !cpu_name!
echo Cores: !cores!
echo Logical Processors: !logical!
echo Name: !cpu_name!Cores: !cores!Logical Processors: !logical! >> %OUTPUT_FILE%

rem Graphics Card Information
echo.
echo Graphics Card Information:
echo Graphics Card Information: >> %OUTPUT_FILE%
set "gpu_list="
for /f "tokens=2 delims==" %%i in ('wmic path win32_VideoController get Name /value') do (
    echo %%i
    if defined gpu_list (
        set "gpu_list=!gpu_list!%%i"
    ) else (
        set "gpu_list=%%i"
    )
)
echo !gpu_list! >> %OUTPUT_FILE%

rem Memory Information
echo.
echo Memory Information:
echo Memory Information: >> %OUTPUT_FILE%
for /f "skip=1 tokens=1,2" %%a in ('wmic memorychip get Capacity^,Speed') do (
    if "%%a" neq "" if "%%b" neq "" (
        for /f %%g in ('powershell -command "[math]::Round(%%a / 1073741824)"') do set capacity=%%g
        echo Size: !capacity! GB, Speed: %%b MHz
        echo Size: !capacity! GB, Speed: %%b MHz >> %OUTPUT_FILE%
    )
)

rem Motherboard Information
echo.
echo Motherboard Information:
echo. >> %OUTPUT_FILE%
echo Motherboard Information: >> %OUTPUT_FILE%
set "manufacturer="
for /f "tokens=2 delims==" %%i in ('wmic baseboard get Manufacturer /value') do set "manufacturer=%%i"
set "product="
for /f "tokens=2 delims==" %%i in ('wmic baseboard get Product /value') do set "product=%%i"
echo Manufacturer: !manufacturer!
echo Product: !product!
echo Manufacturer: !manufacturer!Product: !product! >> %OUTPUT_FILE%

rem Disk Information
echo.
echo Disk Information:
echo Disk Information: >> %OUTPUT_FILE%
set "disk_list="
for /f "tokens=2 delims==" %%i in ('wmic diskdrive get Model /value') do (
    echo %%i
    if defined disk_list (
        set "disk_list=!disk_list!%%i"
    ) else (
        set "disk_list=%%i"
    )
)
echo !disk_list! >> %OUTPUT_FILE%

rem Network Information
echo.
echo Network Information:
echo Network Information: >> %OUTPUT_FILE%
set "net_list="
for /f "tokens=2 delims==" %%i in ('wmic nic where "NetConnectionStatus=2" get Name /value') do (
    echo %%i
    if defined net_list (
        set "net_list=!net_list!%%i"
    ) else (
        set "net_list=%%i"
    )
)
echo !net_list! >> %OUTPUT_FILE%

echo.
echo System information gathered and saved to %OUTPUT_FILE%.
pause
