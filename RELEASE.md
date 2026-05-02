# 发布流程

OnlyTranslate 使用 `release-it` 维护版本号、Git tag、`CHANGELOG.md` 和 GitHub Release。发布前还需要同步维护扩展内展示给用户看的更新说明。

## 发布前准备

1. 确定下一个版本号。

```bash
pnpm exec release-it --release-version
```

2. 更新用户版更新说明。

编辑 `entrypoints/utils/releaseNotes.ts`，在 `releaseNotes` 数组最前面添加目标版本。建议控制在 `3-5` 条，优先描述用户能直接感知到的新功能、优化和修复。

3. 运行发布前校验。

```bash
pnpm release:check <version>
```

例如：

```bash
pnpm release:check 0.3.0
```

4. 运行测试和打包验证。

```bash
pnpm test
pnpm zip
pnpm release:check <version> --check-zip
```

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
- 在 GitHub Release 上传 `.output/OnlyTranslate-v<version>-chrome.zip`。

## 发布后核对

```bash
gh release view v<version> --repo airhunter/OnlyTranslate
git status --short
```

确认 GitHub Release 已发布、附件已上传、本地工作区干净。
