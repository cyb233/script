@echo off&title PC Information
rem PC_INFO.bat - Gather and display PC information, saving it to a UTF-8 encoded text file.

setlocal enabledelayedexpansion

set "OUTPUT_FILE=%~dp0PCINFO.txt"
set "TEMP_FILE=%~dp0temp_pcinfo.txt"

echo Gathering system information...
echo.

rem Windows Information
echo Windows Information:
echo Windows Information: > %TEMP_FILE%
set "caption="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic os get Caption /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "caption=%%i"
set "version="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic os get Version /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "version=%%i"
set "build="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic os get BuildNumber /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "build=%%i"
echo Caption: !caption!
echo Version: !version!
echo Build: !build!
echo Caption: !caption! >> %TEMP_FILE%
echo Version: !version! >> %TEMP_FILE%
echo Build: !build! >> %TEMP_FILE%

rem CPU Information
echo.
echo CPU Information:
echo. >> %TEMP_FILE%
echo CPU Information: >> %TEMP_FILE%
set "cpu_name="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic cpu get Name /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "cpu_name=%%i"
set "cores="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic cpu get NumberOfCores /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "cores=%%i"
set "logical="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic cpu get NumberOfLogicalProcessors /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "logical=%%i"
echo Name: !cpu_name!
echo Cores: !cores!
echo Logical Processors: !logical!
echo Name: !cpu_name! >> %TEMP_FILE%
echo Cores: !cores! >> %TEMP_FILE%
echo Logical Processors: !logical! >> %TEMP_FILE%

rem Graphics Card Information
echo.
echo Graphics Card Information:
echo. >> %TEMP_FILE%
echo Graphics Card Information: >> %TEMP_FILE%
set "gpu_list="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic path win32_VideoController get Name /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do (
    echo %%i
    echo %%i >> %TEMP_FILE%
)

rem Memory Information
echo.
echo Memory Information:
echo. >> %TEMP_FILE%
echo Memory Information: >> %TEMP_FILE%
for /f "skip=1 tokens=1,2" %%a in ('powershell -command "wmic memorychip get Capacity,Speed | ForEach-Object { $_ -replace \"`r\", \"\" }"') do (
    if "%%a" neq "" if "%%b" neq "" (
        for /f %%g in ('powershell -command "[math]::Round(%%a / 1073741824)"') do set capacity=%%g
        echo Size: !capacity! GB, Speed: %%b MHz
        echo Size: !capacity! GB, Speed: %%b MHz >> %TEMP_FILE%
    )
)

rem Motherboard Information
echo.
echo Motherboard Information:
echo. >> %TEMP_FILE%
echo Motherboard Information: >> %TEMP_FILE%
set "manufacturer="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic baseboard get Manufacturer /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "manufacturer=%%i"
set "product="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic baseboard get Product /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do set "product=%%i"
echo Manufacturer: !manufacturer!
echo Product: !product!
echo Manufacturer: !manufacturer! >> %TEMP_FILE%
echo Product: !product! >> %TEMP_FILE%

rem Disk Information
echo.
echo Disk Information:
echo. >> %TEMP_FILE%
echo Disk Information: >> %TEMP_FILE%
set "disk_list="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic diskdrive get Model /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do (
    echo %%i
    echo %%i >> %TEMP_FILE%
)

rem Network Information
echo.
echo Network Information:
echo. >> %TEMP_FILE%
echo Network Information: >> %TEMP_FILE%
set "net_list="
for /f "tokens=2 delims==" %%i in ('powershell -command "wmic nic where 'NetEnabled=true' get Name /value | ForEach-Object { $_ -replace \"`r\", \"\" }"') do (
    echo %%i
    echo %%i >> %TEMP_FILE%
)

rem Convert output file to UTF-8 encoding
powershell -command "Get-Content %TEMP_FILE% | Set-Content -Encoding UTF8 %OUTPUT_FILE%"
del %TEMP_FILE%

echo.
echo System information gathered and saved to %OUTPUT_FILE%.
pause
