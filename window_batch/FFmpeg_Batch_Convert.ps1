param (
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Files
)

if (-not $Files -or $Files.Count -eq 0) {
    Add-Type -AssemblyName System.Windows.Forms
    $ofd = New-Object System.Windows.Forms.OpenFileDialog
    $ofd.Multiselect = $true
    $ofd.Filter = "视频文件|*.mp4;*.mkv;*.avi;*.mov;*.flv|所有文件|*.*"
    if ($ofd.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $Files = $ofd.FileNames
    } else {
        Write-Host "未选择文件，脚本退出。"
        exit
    }
}

function Ask-Choice($message) {
    Write-Host "$message [Y/N]: " -NoNewline
    $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Write-Host ""
    return $key.Character -eq 'Y' -or $key.Character -eq 'y'
}

# 是否直接复制流
$doCopy = Ask-Choice "是否直接复制视频音频流而不转码"

foreach ($input in $Files) {
    $output = [System.IO.Path]::ChangeExtension($input, $null) + "_fix.mp4"
    Write-Host "Processing: $input"

    if ($doCopy) {
        # 直接copy
        ffmpeg -i "$input" -c copy "$output"
    } else {
        # 获取视频码率
        $vbit = & ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of default=nokey=1:noprint_wrappers=1 "$input"
        # 获取音频码率
        $abit = & ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of default=nokey=1:noprint_wrappers=1 "$input"

        $vparam = ""
        $aparam = ""

        if ($vbit) {
            $vkb = [int]($vbit.Trim()) / 1000
            $vparam = "-b:v ${vkb}k"
            Write-Host "Video bitrate: $vkb kbps"
        } else {
            Write-Host "No video bitrate detected, using encoder default."
        }

        if ($abit) {
            $akb = [int]($abit.Trim()) / 1000
            $aparam = "-b:a ${akb}k"
            Write-Host "Audio bitrate: $akb kbps"
        } else {
            Write-Host "No audio bitrate detected, using encoder default."
        }

        ffmpeg -i "$input" -c:v hevc_nvenc $vparam -c:a aac $aparam "$output"
    }

    Write-Host "Output: $output"
}

Write-Host "All files processed.`n"

# 如果有多个文件，才询问是否合并
if ($Files.Count -le 1) { Read-Host "按任意键退出..."; exit }

Write-Host "文件顺序如下："
foreach ($input in $Files) {
    $outname = [System.IO.Path]::ChangeExtension($input, $null) + "_fix.mp4"
    Write-Host $outname
}
Write-Host ""

if (-not (Ask-Choice "是否要合并以上文件为一个视频")) { Read-Host "按任意键退出..."; exit }

# 写入临时文件列表
$listPath = "list.txt"
Remove-Item $listPath -ErrorAction SilentlyContinue
foreach ($input in $Files) {
    $outname = [System.IO.Path]::ChangeExtension($input, $null) + "_fix.mp4"
    Add-Content $listPath "file '$outname'"
}

# 执行合并
ffmpeg -f concat -safe 0 -i $listPath -c copy merged_output.mp4

Write-Host "合并完成，输出文件: merged_output.mp4"
Read-Host "按任意键退出..."
