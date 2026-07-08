# Proxifier 规则生成说明

此目录下的 `Schwi.ppx` 为**生成产物**，不要直接手改。

## 源文件结构

- [`rules/Options.xml`](./rules/Options.xml)：对应 `<Options>`
- [`rules/ProxyList.xml`](./rules/ProxyList.xml)：对应 `<ProxyList>`
- [`rules/ChainList.xml`](./rules/ChainList.xml)：对应 `<ChainList>`
- [`rules/RuleList-*.xml`](./rules/)：按顺序拼接的 `<RuleList>` 分组片段
- [`build-config.json`](./build-config.json)：生成配置
- [`generate_profile.py`](./generate_profile.py)：生成脚本

## 规则

1. `RuleList-*.xml` 文件名必须带顺序前缀，例如：
   - `RuleList-010-core-direct.xml`
   - `RuleList-020-devtools.xml`
   - `RuleList-999-default.xml`
2. 每个 `RuleList-*.xml` 都必须使用 `<RuleList>` 作为根节点。
3. 注释统一要求前后带空格，例如：
   - `<!-- Development tools and shells -->`
4. `Proxy` 的 `id` 必须从 `100` 开始连续编号。
5. `Chain` 的 `id` 必须从 `200` 开始连续编号。
6. `Default` 规则必须唯一且位于最后一个规则分组中。

## 本地生成

在仓库根目录执行：

```bash
python proxifier/generate_profile.py
```

生成结果会覆盖：

- [`Schwi.ppx`](./Schwi.ppx)

## GitHub Actions

工作流文件：

- [`.github/workflows/proxifier-generate.yml`](../.github/workflows/proxifier-generate.yml)

当以下文件发生提交变更时会自动触发：

- `proxifier/rules/**`
- `proxifier/build-config.json`
- `proxifier/generate_profile.py`
- `.github/workflows/proxifier-generate.yml`

### push / workflow_dispatch

- GitHub Actions 会重新生成 `proxifier/Schwi.ppx`
- 如果生成结果有变化，或仓库中原本没有被跟踪的 `Schwi.ppx`，workflow 会自动将其提交回当前分支

### pull_request

- GitHub Actions 会重新生成 `proxifier/Schwi.ppx`
- 如果检测到 `Schwi.ppx` 仍有 tracked diff，或者它只是 CI 临时生成的未跟踪文件，workflow 会直接失败
- 此时需要先在本地执行生成脚本，再把更新后的 `Schwi.ppx` 一并提交
