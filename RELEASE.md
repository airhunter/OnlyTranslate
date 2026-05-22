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

4. 运行测试和打包验证。

```bash
pnpm test
pnpm zip
pnpm release:check <version> --check-zip
```

注意：正式发布前如果 `package.json` 版本号尚未提升，`pnpm zip` 生成的 zip 文件名仍会使用当前版本号。`release-it` 会在发布过程中先提升版本号，再通过 `before:github:release` 钩子重新运行 `pnpm zip` 并上传目标版本产物。

## 正式发布

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
- 在 GitHub Release 上上传 `.output/OnlyTranslate-v<version>-chrome.zip`。

如果在 Windows PowerShell 中执行 `pnpm release` 遇到环境变量语法问题，可以改用等价命令：

```powershell
$env:GITHUB_TOKEN=(gh auth token); pnpm exec release-it <version> --ci
```

## 发布后核对

```bash
gh release view v<version> --repo airhunter/OnlyTranslate
git status --short
```

确认 GitHub Release 已发布、附件已上传、本地工作区干净。
