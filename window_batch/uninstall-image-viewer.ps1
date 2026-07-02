
param(
    [switch]$NoPause
)

$script:Status = [ordered]@{
    Ok = 0
    Warn = 0
    Fail = 0
}

$script:Language = if ([Globalization.CultureInfo]::CurrentUICulture.Name -like 'zh*') {
    'zh'
} else {
    'en'
}

$script:Text = @{
    zh = @{
        StatusOK = '成功'
        StatusWARN = '提醒'
        StatusFAIL = '失败'
        StatusINFO = '信息'
        PauseContinue = '按 Enter 键继续...'
        RemovingTarget = '正在删除 {0}'
        RegKeyMissing = '注册表项不存在。'
        RegKeyRemoved = '注册表项已删除。'
        RegKeyRemoveFailed = '注册表项删除失败：{0}'
        RegPathMissing = '注册表路径不存在。'
        RegValueMissing = '注册表值不存在。'
        RegValueRemoved = '注册表值已删除。'
        RegValueRemoveFailed = '注册表值删除失败：{0}'
        AppDataEmpty = 'APPDATA 为空，已拒绝删除文件。'
        RemovingProgramDir = '正在删除程序目录：{0}'
        UnsafeTarget = '目标路径未通过安全检查，未删除任何文件。'
        ProgramDirMissing = '程序目录不存在。'
        TargetNotDirectory = '目标存在但不是目录，已拒绝删除。'
        ProgramDirRemoved = '程序目录已删除。'
        ProgramDirRemoveFailed = '程序目录删除失败：{0}'
        ManualRemovalPath = '可手动删除此路径：{0}'
        Title = '百度网盘“智能看图”功能卸载脚本'
        SourceLine = '出处：https://xzonn.top/posts/Remove-Intelligent-Image-Viewer.html'
        RefactorLine = '使用 Codex 重构，推荐使用 PowerShell 7。'
        AdminRelaunch = '需要管理员权限，正在使用 {0} 重新启动...'
        CannotDetermineScriptPath = '无法确定当前脚本路径，不能自动提权。'
        ExitPrompt = '按 Enter 键退出...'
        ElevationFailed = '自动提权启动失败：{0}'
        CleanupIntro = '此脚本将执行以下清理操作：'
        Cleanup1 = '1. 删除智能看图文件关联注册表项'
        Cleanup2 = '2. 删除智能看图当前用户配置注册表项'
        Cleanup3 = '3. 删除系统已注册应用列表中的智能看图记录'
        Cleanup4 = '4. 删除智能看图程序目录'
        StartPrompt = '按 Enter 键开始，或直接关闭窗口取消...'
        RemovingRegistry = '正在删除注册表项...'
        RemovingFiles = '正在删除程序文件...'
        Finished = '卸载处理完成'
        Summary = '成功：{0}  提醒：{1}  失败：{2}'
        RestartHint = '建议重启计算机，以确保所有更改生效。'
        RemainingPathHint = '如果问题仍然存在，请手动检查以下路径：'
    }
    en = @{
        StatusOK = 'OK'
        StatusWARN = 'WARN'
        StatusFAIL = 'FAIL'
        StatusINFO = 'INFO'
        PauseContinue = 'Press Enter to continue...'
        RemovingTarget = 'Removing {0}'
        RegKeyMissing = 'Registry key does not exist.'
        RegKeyRemoved = 'Registry key removed.'
        RegKeyRemoveFailed = 'Failed to remove registry key: {0}'
        RegPathMissing = 'Registry path does not exist.'
        RegValueMissing = 'Registry value does not exist.'
        RegValueRemoved = 'Registry value removed.'
        RegValueRemoveFailed = 'Failed to remove registry value: {0}'
        AppDataEmpty = 'APPDATA is empty, refusing to remove files.'
        RemovingProgramDir = 'Removing program directory: {0}'
        UnsafeTarget = 'Target path failed safety check; nothing was removed.'
        ProgramDirMissing = 'Program directory does not exist.'
        TargetNotDirectory = 'Target exists but is not a directory; refusing to remove it.'
        ProgramDirRemoved = 'Program directory removed.'
        ProgramDirRemoveFailed = 'Failed to remove program directory: {0}'
        ManualRemovalPath = 'Manual removal path: {0}'
        Title = 'Baidu Netdisk ImageViewer uninstall script'
        SourceLine = 'Source: https://xzonn.top/posts/Remove-Intelligent-Image-Viewer.html'
        RefactorLine = 'Refactored with Codex. PowerShell 7 is recommended.'
        AdminRelaunch = 'Administrator permission is required. Relaunching with {0}...'
        CannotDetermineScriptPath = 'Cannot determine script path for elevation.'
        ExitPrompt = 'Press Enter to exit...'
        ElevationFailed = 'Failed to relaunch elevated: {0}'
        CleanupIntro = 'This script will perform the following cleanup operations:'
        Cleanup1 = '1. Remove the ImageViewer file association registry key'
        Cleanup2 = '2. Remove the ImageViewer current-user configuration registry key'
        Cleanup3 = '3. Remove the ImageViewer entry from the registered applications list'
        Cleanup4 = '4. Remove the ImageViewer program directory'
        StartPrompt = 'Press Enter to start, or close this window to cancel...'
        RemovingRegistry = 'Removing registry entries...'
        RemovingFiles = 'Removing program files...'
        Finished = 'Uninstall finished'
        Summary = 'OK: {0}  WARN: {1}  FAIL: {2}'
        RestartHint = 'Restart the computer to make sure all changes take effect.'
        RemainingPathHint = 'If the issue remains, check this path manually:'
    }
}

function Get-Text {
    param(
        [string]$Key,
        [object[]]$FormatArgs
    )

    $template = $script:Text[$script:Language][$Key]
    if ($null -eq $template) {
        $template = $script:Text.en[$Key]
    }

    if ($FormatArgs.Count -gt 0) {
        return ($template -f $FormatArgs)
    }

    return $template
}

function Write-Status {
    param(
        [ValidateSet('OK', 'WARN', 'FAIL', 'INFO')]
        [string]$Level,
        [string]$Message
    )

    switch ($Level) {
        'OK' { $script:Status.Ok++ }
        'WARN' { $script:Status.Warn++ }
        'FAIL' { $script:Status.Fail++ }
    }

    $label = Get-Text -Key ("Status{0}" -f $Level)

    Write-Host ("[{0}] {1}" -f $label, $Message)
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Pause-IfNeeded {
    param([string]$Message = (Get-Text -Key 'PauseContinue'))

    if (-not $NoPause) {
        [void](Read-Host $Message)
    }
}

function Get-CurrentPowerShellHost {
    try {
        $currentProcessPath = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
        if (-not [string]::IsNullOrWhiteSpace($currentProcessPath)) {
            return $currentProcessPath
        }
    }
    catch {
    }

    if ($PSVersionTable.PSEdition -eq 'Core') {
        $pwsh = Get-Command 'pwsh.exe' -ErrorAction SilentlyContinue
        if ($pwsh) {
            return $pwsh.Source
        }
    }

    $windowsPowerShell = Get-Command 'powershell.exe' -ErrorAction SilentlyContinue
    if ($windowsPowerShell) {
        return $windowsPowerShell.Source
    }

    return 'powershell.exe'
}

function Remove-RegistryKeyIfExists {
    param(
        [string]$DisplayName,
        [string]$LiteralPath
    )

    Write-Host (Get-Text -Key 'RemovingTarget' -FormatArgs $DisplayName)

    if (-not (Test-Path -LiteralPath $LiteralPath)) {
        Write-Status -Level WARN -Message (Get-Text -Key 'RegKeyMissing')
        return
    }

    try {
        Remove-Item -LiteralPath $LiteralPath -Recurse -Force -ErrorAction Stop
        Write-Status -Level OK -Message (Get-Text -Key 'RegKeyRemoved')
    }
    catch {
        Write-Status -Level FAIL -Message (Get-Text -Key 'RegKeyRemoveFailed' -FormatArgs $_.Exception.Message)
    }
}

function Remove-RegistryValueIfExists {
    param(
        [string]$DisplayName,
        [string]$LiteralPath,
        [string]$ValueName
    )

    Write-Host (Get-Text -Key 'RemovingTarget' -FormatArgs $DisplayName)

    if (-not (Test-Path -LiteralPath $LiteralPath)) {
        Write-Status -Level WARN -Message (Get-Text -Key 'RegPathMissing')
        return
    }

    try {
        $item = Get-ItemProperty -LiteralPath $LiteralPath -Name $ValueName -ErrorAction SilentlyContinue
        if ($null -eq $item -or $item.PSObject.Properties.Name -notcontains $ValueName) {
            Write-Status -Level WARN -Message (Get-Text -Key 'RegValueMissing')
            return
        }

        Remove-ItemProperty -LiteralPath $LiteralPath -Name $ValueName -Force -ErrorAction Stop
        Write-Status -Level OK -Message (Get-Text -Key 'RegValueRemoved')
    }
    catch {
        Write-Status -Level FAIL -Message (Get-Text -Key 'RegValueRemoveFailed' -FormatArgs $_.Exception.Message)
    }
}

function Remove-ImageViewerDirectory {
    if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
        Write-Status -Level FAIL -Message (Get-Text -Key 'AppDataEmpty')
        return
    }

    $targetPath = Join-Path $env:APPDATA 'baidu\BaiduNetdisk\module\ImageViewer'
    $fullPath = [IO.Path]::GetFullPath($targetPath)
    $expectedSuffix = '\baidu\BaiduNetdisk\module\ImageViewer'

    Write-Host (Get-Text -Key 'RemovingProgramDir' -FormatArgs $fullPath)

    if (-not $fullPath.EndsWith($expectedSuffix, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Status -Level FAIL -Message (Get-Text -Key 'UnsafeTarget')
        return
    }

    if (-not (Test-Path -LiteralPath $fullPath)) {
        Write-Status -Level WARN -Message (Get-Text -Key 'ProgramDirMissing')
        return
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
        Write-Status -Level FAIL -Message (Get-Text -Key 'TargetNotDirectory')
        return
    }

    try {
        Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
        Write-Status -Level OK -Message (Get-Text -Key 'ProgramDirRemoved')
    }
    catch {
        Write-Status -Level FAIL -Message (Get-Text -Key 'ProgramDirRemoveFailed' -FormatArgs $_.Exception.Message)
        Write-Host (Get-Text -Key 'ManualRemovalPath' -FormatArgs $fullPath)
    }
}

Write-Host '=========================================='
Write-Host (Get-Text -Key 'Title')
Write-Host '=========================================='
Write-Host (Get-Text -Key 'SourceLine')
Write-Host (Get-Text -Key 'RefactorLine')
Write-Host

if (-not (Test-IsAdministrator)) {
    $powerShellHost = Get-CurrentPowerShellHost
    Write-Status -Level INFO -Message (Get-Text -Key 'AdminRelaunch' -FormatArgs (Split-Path -Leaf $powerShellHost))

    if ([string]::IsNullOrWhiteSpace($PSCommandPath)) {
        Write-Status -Level FAIL -Message (Get-Text -Key 'CannotDetermineScriptPath')
        Pause-IfNeeded (Get-Text -Key 'ExitPrompt')
        exit 1
    }

    $arguments = @(
        '-NoProfile'
        '-ExecutionPolicy'
        'Bypass'
        '-File'
        ('"{0}"' -f $PSCommandPath)
    )

    if ($NoPause) {
        $arguments += '-NoPause'
    }

    try {
        Start-Process -FilePath $powerShellHost -ArgumentList $arguments -Verb RunAs -ErrorAction Stop
        exit 0
    }
    catch {
        Write-Status -Level FAIL -Message (Get-Text -Key 'ElevationFailed' -FormatArgs $_.Exception.Message)
        Pause-IfNeeded (Get-Text -Key 'ExitPrompt')
        exit 1
    }
}

Write-Host (Get-Text -Key 'CleanupIntro')
Write-Host (Get-Text -Key 'Cleanup1')
Write-Host (Get-Text -Key 'Cleanup2')
Write-Host (Get-Text -Key 'Cleanup3')
Write-Host (Get-Text -Key 'Cleanup4')
Write-Host
Pause-IfNeeded (Get-Text -Key 'StartPrompt')

Write-Host
Write-Host (Get-Text -Key 'RemovingRegistry')
Write-Host

Remove-RegistryKeyIfExists `
    -DisplayName 'HKEY_CLASSES_ROOT\BaiduNetdiskImageViewerAssociations' `
    -LiteralPath 'Registry::HKEY_CLASSES_ROOT\BaiduNetdiskImageViewerAssociations'

Remove-RegistryKeyIfExists `
    -DisplayName 'HKEY_CURRENT_USER\Software\Baidu\BaiduNetdiskImageViewer' `
    -LiteralPath 'Registry::HKEY_CURRENT_USER\Software\Baidu\BaiduNetdiskImageViewer'

Remove-RegistryValueIfExists `
    -DisplayName 'HKEY_CURRENT_USER\Software\RegisteredApplications\BaiduNetdiskImageViewer' `
    -LiteralPath 'Registry::HKEY_CURRENT_USER\Software\RegisteredApplications' `
    -ValueName 'BaiduNetdiskImageViewer'

Write-Host
Write-Host (Get-Text -Key 'RemovingFiles')
Write-Host

Remove-ImageViewerDirectory

Write-Host
Write-Host '=========================================='
Write-Host (Get-Text -Key 'Finished')
Write-Host (Get-Text -Key 'Summary' -FormatArgs $script:Status.Ok, $script:Status.Warn, $script:Status.Fail)
Write-Host '=========================================='
Write-Host
Write-Host (Get-Text -Key 'RestartHint')
Write-Host (Get-Text -Key 'RemainingPathHint')
Write-Host (Join-Path $env:APPDATA 'baidu\BaiduNetdisk\module\ImageViewer')
Write-Host

Pause-IfNeeded (Get-Text -Key 'ExitPrompt')

if ($script:Status.Fail -gt 0) {
    exit 1
}

exit 0
