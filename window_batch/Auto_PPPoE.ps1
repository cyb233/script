<#
.SYNOPSIS
直接拨号连接宽带连接。

.DESCRIPTION
脚本会调用 Windows 的 rasdial.exe 执行拨号。
拨号名称、账号和密码在脚本顶部配置。

.PARAMETER NoPause
执行结束后不暂停；适合从其他脚本或任务计划调用。

.PARAMETER Help
显示帮助信息并退出，不执行拨号。

.PARAMETER InstallTask
按开机和 RAS 事件触发器添加或更新任务计划程序。

.EXAMPLE
.\Auto_PPPoE.ps1

.EXAMPLE
.\Auto_PPPoE.ps1 -NoPause

.EXAMPLE
.\Auto_PPPoE.ps1 -Help

.EXAMPLE
.\Auto_PPPoE.ps1 -InstallTask
#>

param(
    [switch]$NoPause,
    [switch]$Help,
    [switch]$InstallTask
)

if ($Help) {
    Write-Host @"
基础宽带拨号脚本

用途：直接拨号宽带连接，或添加或更新“自动宽带连接”任务计划。

使用方式：
  .\Auto_PPPoE.ps1              执行拨号，结束后暂停
  .\Auto_PPPoE.ps1 -NoPause     执行拨号，结束后不暂停
  .\Auto_PPPoE.ps1 -Help        显示本帮助信息
  .\Auto_PPPoE.ps1 -InstallTask 添加或更新“自动宽带连接”任务计划

配置：
  请修改脚本开头的 BroadbandName、PppoeUsername 和 PppoePassword。

任务计划：
  -InstallTask 会先请求管理员权限，再提示输入当前 Windows 用户密码。
  修改拨号配置后，请重新执行 -InstallTask 更新任务动作。
"@
    exit 0
}

# 宽带拨号配置。运行前只需要修改下面的配置项。
# 连接名称必须与 Windows“网络连接”中显示的名称一致。
$BroadbandName = "宽带连接"
# 宽带拨号账号和密码。密码会出现在当前 PowerShell 进程的命令参数中。
$PppoeUsername = "123456"
$PppoePassword = "123456"
# 任务计划程序名称和初始启用状态；修改后重新执行 -InstallTask。
$ScheduledTaskName = "测试自动宽带连接"
$ScheduledTaskEnabled = $false

$ErrorActionPreference = "Stop"
$skipPause = $NoPause
$exitCode = 0

function ConvertTo-XmlText {
    param([AllowNull()][string]$Value)

    if ($null -eq $Value) {
        return ""
    }
    return [System.Security.SecurityElement]::Escape($Value)
}

function Test-IsAdministrator {
    $principal = New-Object System.Security.Principal.WindowsPrincipal(
        [System.Security.Principal.WindowsIdentity]::GetCurrent()
    )
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-ElevatedTaskInstall {
    if ([string]::IsNullOrWhiteSpace($PSCommandPath)) {
        throw "无法确定脚本路径，不能请求管理员权限。"
    }

    $powershellPath = Join-Path $PSHOME "powershell.exe"
    if (-not (Test-Path -LiteralPath $powershellPath -PathType Leaf)) {
        $powershellPath = (Get-Process -Id $PID -ErrorAction SilentlyContinue).Path
    }
    if ([string]::IsNullOrWhiteSpace($powershellPath) -or -not (Test-Path -LiteralPath $powershellPath -PathType Leaf)) {
        throw "无法找到 PowerShell 可执行文件，不能请求管理员权限。"
    }
    $argumentList = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -InstallTask -NoPause"

    try {
        $elevatedProcess = Start-Process -FilePath $powershellPath -ArgumentList $argumentList -Verb RunAs -Wait -PassThru -ErrorAction Stop
    } catch {
        throw "无法请求管理员权限，任务计划未添加：$($_.Exception.Message)"
    }

    if ($elevatedProcess.ExitCode -ne 0) {
        throw "管理员进程注册任务失败，退出代码：$($elevatedProcess.ExitCode)。"
    }
}

function Install-BroadbandScheduledTask {
    if ([string]::IsNullOrWhiteSpace($ScheduledTaskName)) {
        throw "ScheduledTaskName 不能为空。"
    }
    if (-not (Get-Command -Name "Register-ScheduledTask" -ErrorAction SilentlyContinue)) {
        throw "当前系统未提供 Register-ScheduledTask，请在 Windows PowerShell 中运行此脚本。"
    }

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    if ($null -eq $identity.User) {
        throw "无法获取当前 Windows 用户 SID。"
    }

    $escapedTaskName = ConvertTo-XmlText $ScheduledTaskName
    $escapedUserName = ConvertTo-XmlText $identity.Name
    $escapedUserSid = ConvertTo-XmlText $identity.User.Value
    $escapedBroadbandName = ConvertTo-XmlText $BroadbandName
    $escapedUsername = ConvertTo-XmlText $PppoeUsername
    $escapedPassword = ConvertTo-XmlText $PppoePassword
    $taskEnabled = $ScheduledTaskEnabled.ToString().ToLowerInvariant()

    # 先定义事件查询 XML，再转义后嵌入任务 XML 的 Subscription 节点。
    # Rasman 20268：RAS/宽带连接已断开，用于断线后触发重新拨号。
    $rasmanSubscriptionXml = @'
<QueryList>
  <Query Id="0" Path="System">
    <Select Path="System">*[System[Provider[@Name='Rasman'] and EventID=20268]]</Select>
  </Query>
</QueryList>
'@
    # RasClient 20227：拨号连接建立失败并记录错误码，用于失败后触发重新拨号。
    $rasClientSubscriptionXml = @'
<QueryList>
  <Query Id="0" Path="Application">
    <Select Path="Application">*[System[Provider[@Name='RasClient'] and EventID=20227]]</Select>
  </Query>
</QueryList>
'@
    $rasmanSubscriptionXml = ($rasmanSubscriptionXml -replace "\s+", " ").Trim()
    $rasClientSubscriptionXml = ($rasClientSubscriptionXml -replace "\s+", " ").Trim()
    $escapedRasmanSubscription = ConvertTo-XmlText $rasmanSubscriptionXml
    $escapedRasClientSubscription = ConvertTo-XmlText $rasClientSubscriptionXml

    $actionArguments = if ([string]::IsNullOrWhiteSpace($PppoeUsername)) {
        "&quot;$escapedBroadbandName&quot;"
    } else {
        "&quot;$escapedBroadbandName&quot; &quot;$escapedUsername&quot; &quot;$escapedPassword&quot;"
    }

    # 参考任务包含事件触发器；New-ScheduledTaskTrigger 无法表达事件查询，因此使用 Register-ScheduledTask 的 -Xml 参数。
    $taskXml = @"
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>AutoPPPoE</Author>
    <URI>\$escapedTaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>$escapedRasmanSubscription</Subscription>
    </EventTrigger>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>$escapedRasClientSubscription</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$escapedUserSid</UserId>
      <LogonType>Password</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>StopExisting</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>$taskEnabled</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT72H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>rasdial.exe</Command>
      <Arguments>$actionArguments</Arguments>
    </Exec>
  </Actions>
</Task>
"@

    try {
        $null = [xml]$taskXml
    } catch {
        throw "任务计划 XML 无效：$($_.Exception.Message)"
    }

    $credential = Get-Credential -UserName $identity.Name -Message "请输入当前 Windows 用户密码，用于注册任务计划程序"
    if ($null -eq $credential) {
        throw "未提供 Windows 用户凭据，任务计划未添加。"
    }

    # 使用 Register-ScheduledTask 的 XML 参数集，保留参考 XML 中的 EventTrigger。
    $registerParams = @{
        TaskName = $ScheduledTaskName
        Xml      = $taskXml
        User     = $credential.UserName
        Password = $credential.GetNetworkCredential().Password
        Force    = $true
    }
    try {
        Register-ScheduledTask @registerParams -ErrorAction Stop | Out-Null
    } catch {
        $message = $_.Exception.Message
        if ($message -match "(?i)access is denied|拒绝访问") {
            throw "任务计划注册被拒绝访问。请使用管理员权限运行，或确认同名任务不是由其他账户创建：$message"
        }
        throw "任务计划注册失败：$message"
    }
    Write-Host "任务计划 '$ScheduledTaskName' 已添加或更新。"
}

try {
    if ([string]::IsNullOrWhiteSpace($BroadbandName)) {
        throw "BroadbandName 不能为空。"
    }
    if ($BroadbandName -match "[\[\]]") {
        throw "BroadbandName 不能包含 '[' 或 ']'。"
    }

    if ($InstallTask) {
        if (-not (Test-IsAdministrator)) {
            Write-Host "注册任务计划需要管理员权限，正在请求提升..."
            Invoke-ElevatedTaskInstall
            Write-Host "任务计划 '$ScheduledTaskName' 已添加或更新。"
        } else {
            Install-BroadbandScheduledTask
        }
        exit 0
    }

    $rasdialCommand = Get-Command -Name "rasdial.exe" -ErrorAction SilentlyContinue
    if ($null -eq $rasdialCommand) {
        throw "找不到 rasdial.exe，无法执行宽带拨号。"
    }

    $rasdialArguments = @($BroadbandName)
    if (-not [string]::IsNullOrWhiteSpace($PppoeUsername)) {
        $rasdialArguments += $PppoeUsername
        $rasdialArguments += $PppoePassword
    }

    Write-Host "正在拨号连接 '$BroadbandName'..."
    & $rasdialCommand.Source @rasdialArguments
    $rasdialExitCode = $LASTEXITCODE
    if ($rasdialExitCode -ne 0) {
        throw "宽带拨号失败，rasdial.exe 返回代码：$rasdialExitCode。"
    }
    Write-Host "宽带拨号成功。"
} catch {
    $exitCode = 1
    Write-Error $_.Exception.Message
} finally {
    if (-not $skipPause) {
        Read-Host "按 Enter 键退出"
    }
}

exit $exitCode
