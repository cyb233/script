# HTML 工具

本目录收录无需安装依赖、可直接在浏览器中打开使用的静态 HTML 工具。

## 幻兽帕鲁服务器配置生成器

[`PalWorldServerConfig.html`](./PalWorldServerConfig.html) 是依据 Palworld Server Guide 1.0.0 和游戏默认配置制作的中文服务器配置生成器，用于生成 `PalWorldSettings.ini` 内容。

### 功能

- 按中文分类浏览服务器、玩家、帕鲁、资源、PvP、公会和网络等配置；
- 实时生成完整的 `OptionSettings` 单行配置；
- 支持搜索、仅查看已修改配置和仅查看官方文档未收录配置；
- 官方文档未收录的参数默认锁定，可在确认风险后手动允许编辑；
- 支持导入已有配置、单项或全部恢复默认、复制以及下载 INI 文件；
- 支持浅色/深色主题及移动端布局；
- 所有数据仅在浏览器本地处理。

### 使用方法

1. 使用浏览器打开 [`PalWorldServerConfig.html`](./PalWorldServerConfig.html)。
2. 根据需要调整配置，右侧会实时生成文件内容。
3. 复制配置或下载 `PalWorldSettings.ini`。
4. 将文件放入服务器对应目录：

   - Windows：`Pal/Saved/Config/WindowsServer/PalWorldSettings.ini`
   - Linux：`Pal/Saved/Config/LinuxServer/PalWorldSettings.ini`

服务器通常需要先启动一次，才会创建上述目录。请勿只修改 `DefaultPalWorldSettings.ini`，该文件的修改不会直接作为服务器运行配置生效。

### 未收录参数

默认配置中有部分参数没有出现在当前官方配置参数表中。生成器仍会保留这些参数及其默认值，以确保输出结构完整，但默认禁止编辑。启用“允许编辑未收录配置”后可以修改这些值，请自行确认服务器版本是否支持。

`AllowConnectPlatform` 虽出现在官方文档中，但已标记为当前版本不可用，因此生成器不输出该参数，改用 `CrossplayPlatforms`。

### 参考资料

- [Palworld 官方配置参数文档](https://docs.palworldgame.com/settings-and-operation/configuration)
- [Palworld 官方科技 ID 列表](https://docs.palworldgame.com/settings-and-operation/technologyids)
