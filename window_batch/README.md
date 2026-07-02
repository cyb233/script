# Windows 批处理脚本

## 使用说明

1. 根据需求选择对应脚本，优先查看脚本文件名和注释说明。
2. `.bat` / `.cmd` 脚本可直接双击运行，也可在 `cmd` 中执行。
3. `.ps1` 脚本建议在 PowerShell 中运行；如遇执行限制，可按需调整 PowerShell 执行策略。
4. 涉及端口、驱动、服务安装/卸载等操作时，建议使用管理员权限运行。
5. 部分脚本依赖 FFmpeg、SteamCMD、WinSW 等工具，使用前请先确认相关环境已安装。
6. 部分批处理脚本可能受系统终端编码影响；如中文提示显示异常，建议优先在对应终端环境中运行并根据本机编码设置调整后再使用。

## 目录结构
- [`Cut_Video.bat`](./Cut_Video.bat)：简单视频切片，按指定时间段分割视频文件
- [`download_server.bat`](./download_server.bat)：SteamCMD 下载服务器
- [`ffmpeg_auto_update.ps1`](./ffmpeg_auto_update.ps1)：自动检测并更新 FFmpeg 到最新版
- [`FFmpeg_Batch_Convert.bat`](./FFmpeg_Batch_Convert.bat)：FFmpeg 批量转换视频/音频格式
- [`FFmpeg_Batch_Convert.ps1`](./FFmpeg_Batch_Convert.ps1)：FFmpeg 批量转换并可选合并输出视频
- [`gif_frame.bat`](./gif_frame.bat)：提取 GIF 帧并导出为 PNG / JPG
- [`make_CS2_OP_with_img.ps1`](./make_CS2_OP_with_img.ps1)：根据图片自动生成 CS2 游戏开场动画
- [`PC_INFO.bat`](./PC_INFO.bat)：收集并导出电脑信息
- [`PC_INFO.ps1`](./PC_INFO.ps1)：收集并导出电脑信息到 UTF-8 文本文件
- [`ProxifierDrv.bat`](./ProxifierDrv.bat)：一键开启 / 关闭 Proxifier 驱动
- [`TwitchDropsMiner_auto_update.ps1`](./TwitchDropsMiner_auto_update.ps1)：Twitch Drops Miner dev-build 自动更新脚本
- [`fid_kernel.bat`](./fid_kernel.bat)：fid_kernel 删除工具
- [`port.bat`](./port.bat)：端口监控批处理入口
- [`port.ps1`](./port.ps1)：监控本地端口占用并显示占用进程信息
- [`uninstall-image-viewer.ps1`](./uninstall-image-viewer.ps1)：百度网盘“智能看图”功能卸载脚本
- [`WinSW Nginx 服务管理脚本.bat`](./WinSW%20Nginx%20%E6%9C%8D%E5%8A%A1%E7%AE%A1%E7%90%86%E8%84%9A%E6%9C%AC.bat)：WinSW Nginx 服务管理脚本
- [`WinSW Java 服务管理脚本.bat`](./WinSW%20Java%20%E6%9C%8D%E5%8A%A1%E7%AE%A1%E7%90%86%E8%84%9A%E6%9C%AC.bat)：WinSW Java 服务安装与管理脚本
- [`nginx-service.xml`](./nginx-service.xml)：WinSW Nginx 服务示例配置

## 相关链接

- [爱发电](https://afdian.net/@Schwi)
- [fanbox](https://schwi.fanbox.cc/)
