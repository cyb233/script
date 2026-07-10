# Script 仓库目录

本仓库收集了个人常用的脚本与静态工具，涵盖 Clash、HTML、Python、Tampermonkey、Windows 批处理等多个方向的自动化与增强工具。

## 目录结构

- [**clash/**](./clash/)  
  Clash / Mihomo 相关配置文件与规则脚本  
  - [`override.js`](./clash/override.js)：Clash / Mihomo override 脚本  
  - [`extra_config.json`](./clash/extra_config.json)：额外配置示例  
  - [`test-override.js`](./clash/test-override.js)：override 本地测试脚本

- [**html/**](./html/)  
  可直接在浏览器中运行的静态 HTML 工具  
  - [`PalWorldServerConfig.html`](./html/PalWorldServerConfig.html)：幻兽帕鲁中文服务器配置生成器，支持生成、导入、复制及下载 `PalWorldSettings.ini`  

- [**python/**](./python/)  
  各类 Python 脚本  
  - [`flickr_apollo.py`](./python/flickr_apollo.py)：抓取 Flickr Project Apollo Archive 原图下载链接

- [**proxifier/**](./proxifier/)  
  Proxifier 配置、规则分片与自动生成脚本（push 后由 GitHub Actions 自动回写 `Schwi.ppx`）  
  - [`Schwi.ppx`](./proxifier/Schwi.ppx)：生成后的 Proxifier 配置文件  
  - [`build-config.json`](./proxifier/build-config.json)：Proxifier 配置生成规则  
  - [`generate_profile.py`](./proxifier/generate_profile.py)：将 `rules/` 分片组装为 `Schwi.ppx` 的生成脚本  
  - [README](./proxifier/README.md)：Proxifier 目录使用说明

- [**tampermonkey/**](./tampermonkey/)  
  Tampermonkey 用户脚本  
  - [**ani/**](./tampermonkey/ani/)  
    - [`ani-skip-ad-and-agreement.user.js`](./tampermonkey/ani/ani-skip-ad-and-agreement.user.js)：动画疯跳过广告和年龄确认  
      [README](./tampermonkey/ani/ani-skip-ad-and-agreement)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/531907-%E5%8A%A8%E7%94%BB%E7%96%AF%E8%B7%B3%E8%BF%87%E5%B9%BF%E5%91%8A%E5%92%8C%E5%B9%B4%E9%BE%84%E7%A1%AE%E8%AE%A4)
  - [**bilibili/**](./tampermonkey/bilibili/)  
    - [`bili.user.js`](./tampermonkey/bilibili/bili.user.js)：颜色标识 B 站收藏番剧作品更新状态  
      [README](./tampermonkey/bilibili/bili)
    - [`bili-digital-card.user.js`](./tampermonkey/bilibili/bili-digital-card.user.js)：Bilibili 收藏集奖励筛查  
      [README](./tampermonkey/bilibili/bili-digital-card)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/523758-bilibili-%E6%94%B6%E8%97%8F%E9%9B%86%E5%A5%96%E5%8A%B1%E7%AD%9B%E6%9F%A5%E8%84%9A%E6%9C%AC)
    - [`bili-gift-box.user.js`](./tampermonkey/bilibili/bili-gift-box.user.js)：Bilibili 盲盒统计  
      [README](./tampermonkey/bilibili/bili-gift-box)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/534331-bilibili-%E7%9B%B2%E7%9B%92%E7%BB%9F%E8%AE%A1)
    - [`bilibili-dynamic-screening.user.js`](./tampermonkey/bilibili/bilibili-dynamic-screening.user.js)：Bilibili 动态筛选  
      [README](./tampermonkey/bilibili/bilibili-dynamic-screening)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/524990-bilibili-%E5%8A%A8%E6%80%81%E7%AD%9B%E9%80%89)
    - [`bilibili-party-square.user.js`](./tampermonkey/bilibili/bilibili-party-square.user.js)：Bilibili 庆会广场  
      [README](./tampermonkey/bilibili/bilibili-party-square)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/527547-bilibili-%E5%BA%86%E4%BC%9A%E5%B9%BF%E5%9C%BA)
    - [`emojis.user.js`](./tampermonkey/bilibili/emojis.user.js)：下载 Bilibili 直播间的 Emojis  
      [README](./tampermonkey/bilibili/emojis)
  - [**ehentai/**](./tampermonkey/ehentai/)  
    - [`eh.user.js`](./tampermonkey/ehentai/eh.user.js)：e站收藏统计  
      [README](./tampermonkey/ehentai/eh)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/477539-e%E7%AB%99%E6%94%B6%E8%97%8F%E7%BB%9F%E8%AE%A1)
  - [**fanbox/**](./tampermonkey/fanbox/)  
    - [`fanbox.user.js`](./tampermonkey/fanbox/fanbox.user.js)：Fanbox 投稿批量下载与增强脚本  
      [README](./tampermonkey/fanbox/fanbox)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/482310-%E4%B8%8B%E8%BD%BD%E4%BD%A0%E8%B5%9E%E5%8A%A9%E7%9A%84fanbox)

- [**window_batch/**](./window_batch/)  
  Windows 批处理与 PowerShell 脚本  
  - [`Cut_Video.bat`](./window_batch/Cut_Video.bat)：简单视频切片，按指定时间段分割视频文件  
  - [`FFmpeg_Batch_Convert.bat`](./window_batch/FFmpeg_Batch_Convert.bat)：FFmpeg 批量转换  
  - [`ffmpeg_auto_update.ps1`](./window_batch/ffmpeg_auto_update.ps1)：FFmpeg 自动更新  
  - [`make_CS2_OP_with_img.ps1`](./window_batch/make_CS2_OP_with_img.ps1)：CS2 OP 制作  
  - [`port.ps1`](./window_batch/port.ps1)：本地端口占用监控

## 相关链接

- [爱发电](https://afdian.net/@Schwi)
- [fanbox](https://schwi.fanbox.cc/)

## License

详见 [LICENSE](LICENSE)
