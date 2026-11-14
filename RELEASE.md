# 发布流程

OnlyTranslate 使用 `release-it` 维护版本号、Git tag、`CHANGELOG.md` 和 GitHub Release。发布前还需要同步维护扩展内展示给用户看的更新说明。

## 发布前准备

1. 确定下一个版本号。

```bash
pnpm exec release-it --release-version
```

2. 更新用户版更新说明。

编辑 `entrypoints/utils/releaseNotes.ts`，在 `releaseNotes` 数组最前面添加目标版本。

要求：

- 每个版本使用 `version` 和 `notes` 字段。
- `notes` 必须包含 `zh-CN`、`en-US`、`zh-TW`、`ja-JP` 四种语言。
- 每种语言都需要 `title` 和 `items`。
- `items` 建议控制在 `3-5` 条，优先描述用户能直接感知到的新功能、优化和修复。
- 只记录会进入扩展包的变化；网站、商店素材等独立发布内容不写入扩展更新说明。
- Popup 和 Options 关于页会共用这里的内容，因此不要只写 GitHub Release 面向开发者的变更摘要。

3. 运行发布前校验。

```bash
pnpm release:check <version>
```

例如：

```bash
pnpm release:check 0.5.1
```

校验会检查目标版本的扩展内更新说明是否位于数组最前面、是否补齐四种语言、每种语言是否有 `3-5` 条说明，以及 release-it 产物配置是否正确。

4. 运行发布前基础验证。

```bash
pnpm verify
```

`pnpm verify` 会运行类型检查和完整测试集。完整测试集包含 `tests/fixtures/translation-target` 下的内容识别 fixture 回归样本，用于防止 smart/full 识文规则、站点 profile 和 DOM 目标选择出现跷跷板回归。

如果本次发布包含内容识别、翻译目标选择、站点 profile 或 DOM 插入相关改动，建议先单独运行聚焦检查：

```bash
pnpm test:content
```

5. 打包并校验发布产物。

```bash
pnpm zip:all
```

`pnpm zip:all` 依次生成 Chrome、Edge 和 Firefox 的扩展 ZIP。正式发布时，`release-it` 提升版本号后会重新打包，并运行 `pnpm release:check <version> --check-zip`；该检查要求目标版本的三个包都存在，并分别检查发布产物的体积预算：

- 任一发布 ZIP 超过 `1.5 MB`（`1,500,000` 字节）时告警。
- 任一 `content-scripts/*.js` 超过 `800 KiB`（`819,200` 字节）时提示审查内容脚本拆分。
- 任一浏览器的 ZIP 相比 `releaseNotes` 中的上一版本同浏览器包增长超过 `15%` 时提示检查构建内容。

体积预算告警不会直接阻断发布。出现告警后，需要确认增长来自预期功能或资源，并在继续发布前检查是否存在重复依赖、误打包资源或可延迟加载的内容脚本代码。单版本增长检查依赖 `.output` 中保留上一版本对应浏览器的 ZIP；缺少上一版本产物时，校验会明确提示无法比较。

注意：正式发布前如果 `package.json` 版本号尚未提升，`pnpm zip:all` 生成的 ZIP 文件名仍会使用当前版本号。目标版本的 ZIP 存在性校验由 `before:github:release` 钩子在版本号提升后执行，校验通过才会上传三个浏览器包。

## 正式发布

所有正式构建必须使用根目录的 `pnpm build`／`pnpm zip` 及其 Edge、Firefox 变体。仓库级 `scripts/build-extension.mjs` 先执行独立评审工具的人工验证集检查，通过后才调用 WXT；`zip:all` 和 release-it 继续经过这些入口。正式入口即使指定 development mode 也不能跳过校验。可先运行 `pnpm test:reading` 查看报告，完整说明见 [识文评审台流程](docs/testing/reading-review.md)。

扩展运行代码和 WXT 配置不依赖评审工具，开发服务及热更新不受影响。直接执行底层 `wxt build`／`wxt zip` 只构建扩展，不执行人工验证；它们不是正式交付入口，不得用于绕过质量门禁。工程边界见 [评审工具工程说明](tools/reading-review/README.md)。

正式入口固定本仓库和 `wxt.config.ts`，仅允许浏览器（chrome / edge / firefox）与模式（production / development）参数；不能通过位置目录、`-c/--config`、入口过滤或其他未知参数改变被校验对象。非法或重复参数在启动校验与构建之前即失败。

检查只使用本地已归档快照和本次源码，不调用翻译接口。未经明确接受的未满足裁决、快照或资源缺失、定位或规范版本失效、没有有效人工要求、回放异常都阻断构建。报告保存在配置数据目录的 `checks/<检查ID>/report.json`；缺少本地数据时先恢复对应快照和资源，不得通过清空标注或修改预期绕过。算法修复和产品口径调整仍分别遵守原有讨论、回归与用户确认流程。

用户保存的整页识文目标确认同样参与检查，包括无逐块标注的页面。相同快照的覆盖不变无需重复确认；覆盖变化或确认上下文失效时阻断，交用户复核。逐块裁决和已接受限制继续单独检查，整页确认不能豁免它们或完整性错误。

用户可以明确接受个别已知限制并允许发布，记录在 `tests/corpus/accepted-issues.json`，原内容裁决保持不变。例外精确绑定快照、原文、裁决修订和已接受的原文覆盖结果；不能豁免其他失败或数据完整性错误。报告必须分别列出满足项、已接受的未满足项和仍阻断项；含例外的发布检查通过不等于算法全部满足要求。撤销时追加同 ID、更高 revision 的 `revoked` 记录，不删除原确认历史。

如果本次发布涉及识文、站点规则或翻译插入，发布前还要按照 [识文评审台流程](docs/testing/reading-review.md) 完成可用测试集的快照回放，并记录运行批次、已确认要求的检查结果、未审核差异和采集失败。真实翻译未完成的运行不能作为合格基线。未覆盖的页面和未审核内容不能计为通过。

发布完成后，核实发布 ZIP 和对应 tag 的身份，新增该版本的运行记录。需要切换日常对照版本时保留原基线及人工裁决，不自动覆盖或清空标注。

确认校验、测试和打包都通过后，执行：

```bash
pnpm release
```

`release-it` 会执行以下工作：

- 更新 `package.json` 版本号。
- 根据 Conventional Commits 更新 `CHANGELOG.md`。
- 创建 release commit。
- 创建并推送 `v<version>` tag。
- 创建 GitHub Release。
- 在 GitHub Release 上上传 `.output/OnlyTranslate-v<version>-chrome.zip`、`.output/OnlyTranslate-v<version>-edge.zip` 和 `.output/OnlyTranslate-v<version>-firefox.zip`。

如果在 Windows PowerShell 中执行 `pnpm release` 遇到环境变量语法问题，可以改用等价命令：

```powershell
$env:GITHUB_TOKEN=(gh auth token); pnpm exec release-it <version> --ci
```

## 发布后核对

```bash
gh release view v<version> --repo airhunter/OnlyTranslate
git status --short
```

确认 GitHub Release 已发布、三个浏览器 ZIP 均已上传、本地工作区干净。Firefox 商店审核所需的源码 ZIP 由 WXT 另行生成，不作为 GitHub Release 的浏览器安装包上传。
