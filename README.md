# Script 仓库目录

本仓库收集了个人常用的脚本，涵盖 Bilibili、Fanbox、Ehentai、Ani 等多个平台的自动化与增强工具。

## 目录结构

- [**clash/**](./clash/)  
  Clash 相关配置文件

- [**python/**](./python/)  
  各类 Python 脚本  
  - [`flickr_apollo.py`](./python/flickr_apollo.py)：Flickr Apollo 相关脚本

- [**tampermonkey/**](./tampermonkey/)  
  Tampermonkey 用户脚本  
  - [**ani/**](./tampermonkey/ani/)  
    - [`ani-skip-ad-and-agreement.user.js`](./tampermonkey/ani/ani-skip-ad-and-agreement.user.js)：动画疯跳过广告和年龄确认
      [README](./tampermonkey/ani/ani-skip-ad-and-agreement)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/531907-%E5%8A%A8%E7%94%BB%E7%96%AF%E8%B7%B3%E8%BF%87%E5%B9%BF%E5%91%8A%E5%92%8C%E5%B9%B4%E9%BE%84%E7%A1%AE%E8%AE%A4)
  - [**bilibili/**](./tampermonkey/bilibili/)  
    - [`bili-digital-card.user.js`](./tampermonkey/bilibili/bili-digital-card.user.js)：Bilibili 收藏集奖励筛查  
      [README](./tampermonkey/bilibili/bili-digital-card)
      [Greasyfork](https://greasyfork.org/scripts/bili-digital-card)
    - [`bili-gift-box.user.js`](./tampermonkey/bilibili/bili-gift-box.user.js)：Bilibili 盲盒统计  
      [README](./tampermonkey/bilibili/bili-gift-box)
      [Greasyfork](https://greasyfork.org/scripts/bili-gift-box)
    - [`bilibili-dynamic-screening.user.js`](./tampermonkey/bilibili/bilibili-dynamic-screening.user.js)：Bilibili 动态筛选  
      [README](./tampermonkey/bilibili/bilibili-dynamic-screening)
      [Greasyfork](https://greasyfork.org/scripts/bilibili-dynamic-screening)
    - [`bilibili-party-square.user.js`](./tampermonkey/bilibili/bilibili-party-square.user.js)：Bilibili 庆会广场
      [README](./tampermonkey/bilibili/bilibili-party-square)
      [Greasyfork](https://greasyfork.org/scripts/bili)
  - [**ehentai/**](./tampermonkey/ehentai/)  
    - [ehentai-helper.user.js](./tampermonkey/ehentai/eh.user.js)：e站收藏统计  
      [README](./tampermonkey/ehentai/eh)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/477539-e%E7%AB%99%E6%94%B6%E8%97%8F%E7%BB%9F%E8%AE%A1)
  - [**fanbox/**](./tampermonkey/fanbox/)  
    - [fanbox-downloader.user.js](./tampermonkey/fanbox/fanbox.user.js)：Fanbox 投稿批量下载与增强脚本  
      [README](./tampermonkey/fanbox/fanbox)
      [Greasyfork](https://greasyfork.org/zh-CN/scripts/482310-%E4%B8%8B%E8%BD%BD%E4%BD%A0%E8%B5%9E%E5%8A%A9%E7%9A%84fanbox)

- [**window_batch/**](./window_batch/)  
  Windows 批处理与 PowerShell 脚本  
  - [`Cut Video.bat`](./window_batch/Cut%20Video.bat)：视频剪切  
  - [`FFmpeg Batch Convert.bat`](./window_batch/FFmpeg%20Batch%20Convert.bat)：FFmpeg 批量转换  
  - [`ffmpeg_auto_update.ps1`](./window_batch/ffmpeg_auto_update.ps1)：FFmpeg 自动更新  
  - [`make_CS2_OP_with_img.ps1`](./window_batch/make_CS2_OP_with_img.ps1)：CS2 OP 制作

## 相关链接

- [爱发电](https://afdian.net/@Schwi)
- [fanbox](https://schwi.fanbox.cc/)

## License

详见 [LICENSE](LICENSE)
