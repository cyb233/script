# Clash 配置脚本

## 使用说明

1. 本目录收录 Clash / Mihomo 相关的 override 脚本、额外配置示例与规则集。
2. 可按需将 `override.js`、`extra_config.json` 或 `rulesets/` 中的内容整合到自己的配置中使用。
3. 如需本地测试 `override.js` 输出，可使用 `test-override.js` 对配置文件进行验证。

## 目录结构

- [`override.js`](./override.js)：Clash / Mihomo override 脚本，用于整理策略组与规则目标
- [`test-override.js`](./test-override.js)：override 本地测试脚本，支持输出到终端或写入文件
- [`extra_config.json`](./extra_config.json)：额外配置示例，包含 rule-providers 与 rules
- [**rulesets/**](./rulesets/)：自定义规则集目录
  - [`schwi-direct.yaml`](./rulesets/schwi-direct.yaml)：直连规则集
  - [`schwi-jp.yaml`](./rulesets/schwi-jp.yaml)：日本相关规则集
  - [`schwi-proxies.yaml`](./rulesets/schwi-proxies.yaml)：代理规则集
  - [`schwi-reject.yaml`](./rulesets/schwi-reject.yaml)：拦截规则集
  - [`schwi-tw.yaml`](./rulesets/schwi-tw.yaml)：台湾相关规则集

## 相关链接

- [爱发电](https://afdian.net/@Schwi)
- [fanbox](https://schwi.fanbox.cc/)
