# PC_INFO.ps1 - Gather and display PC information, saving it to a UTF-8 encoded text file.

param()

$OutputFile = Join-Path $PSScriptRoot "PCINFO.txt"

Write-Host "Gathering system information..."
Write-Host ""

# Windows Information
Write-Host "Windows Information:"
"Windows Information:" | Out-File -FilePath $OutputFile -Encoding UTF8

$os = Get-CimInstance Win32_OperatingSystem
$caption = $os.Caption
$version = $os.Version
$build = $os.BuildNumber

Write-Host "Caption: $caption"
Write-Host "Version: $version"
Write-Host "Build: $build"

"Caption: $caption" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Version: $version" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Build: $build" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

# CPU Information
Write-Host ""
Write-Host "CPU Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"CPU Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$cpu = Get-CimInstance Win32_Processor
$name = $cpu.Name
$cores = $cpu.NumberOfCores
$logical = $cpu.NumberOfLogicalProcessors

Write-Host "Name: $name"
Write-Host "Cores: $cores"
Write-Host "Logical Processors: $logical"

"Name: $name" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Cores: $cores" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Logical Processors: $logical" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

# Graphics Card Information
Write-Host ""
Write-Host "Graphics Card Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Graphics Card Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$gpus = Get-CimInstance Win32_VideoController
foreach ($gpu in $gpus) {
  Write-Host $gpu.Name
  "$($gpu.Name)" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
}

# Memory Information
Write-Host ""
Write-Host "Memory Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Memory Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$memories = Get-CimInstance Win32_PhysicalMemory
foreach ($mem in $memories) {
  $capacityGB = [math]::Round($mem.Capacity / 1GB)
  $speed = $mem.Speed
  Write-Host "Size: $capacityGB GB, Speed: $speed MHz"
  "Size: $capacityGB GB, Speed: $speed MHz" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
}

# Motherboard Information
Write-Host ""
Write-Host "Motherboard Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Motherboard Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$mb = Get-CimInstance Win32_BaseBoard
$manufacturer = $mb.Manufacturer
$product = $mb.Product

Write-Host "Manufacturer: $manufacturer"
Write-Host "Product: $product"

"Manufacturer: $manufacturer" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Product: $product" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

# Disk Information
Write-Host ""
Write-Host "Disk Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Disk Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$disks = Get-CimInstance Win32_DiskDrive
foreach ($disk in $disks) {
  Write-Host $disk.Model
  "$($disk.Model)" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
}

# Network Information
Write-Host ""
Write-Host "Network Information:"
"" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
"Network Information:" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append

$nics = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.NetEnabled }
foreach ($nic in $nics) {
  Write-Host $nic.Name
  "$($nic.Name)" | Out-File -FilePath $OutputFile -Encoding UTF8 -Append
}

Write-Host ""
Write-Host "System information gathered and saved to $OutputFile."