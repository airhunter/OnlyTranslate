# 识文评审工具工程

这是同仓库内独立的开发工具，不是扩展的运行模块。扩展的入口、识别规则和 WXT 配置不引用本工程。工具读取扩展源码、发布包和本地快照；不维护另一套识别算法。

## 命令与依赖

在仓库根目录运行 `pnpm install` 安装两个工作区。工具声明自己的 Vite、Vitest、TypeScript 和 Node 类型依赖，不读取扩展的 WXT/Vue 测试或类型配置。

```powershell
pnpm --dir tools/reading-review dev
pnpm --dir tools/reading-review check
pnpm --dir tools/reading-review verify
```

根目录的 `pnpm review:reading`、`pnpm test:reading`、`pnpm verify:review` 是对应的便捷入口。`pnpm test` / `pnpm compile` 只验证扩展；`pnpm verify` 依次验证扩展和工具。工具单元测试只使用隔离临时数据，真实快照检查单独运行。

## 集成边界

- `adapters/onlytranslate.ts` 是浏览器采集适配器，调用扩展真实的 `getTranslatableText` 和 `resolveAutoTranslationTarget`。其代码随采集器单独打包，不注入正式扩展构建。
- `adapters/onlytranslate.mjs` 定位同仓库的扩展和采集入口。采集器由工具的 Vite 调用构建，`configFile: false`，不加载扩展 WXT 配置；中间产物放在 `output/`。
- 当前源码指纹、Git 发布身份及发布 ZIP 仍从被测扩展读取；接口或源码布局改变时修改工具适配，不在扩展里增加评审专用分支。
- 清单、原人工标注、整页确认和已接受限制继续保存在仓库的 `tests/corpus/`；完整快照、译文、资源及报告保存在原外部数据目录。此次工程拆分不迁移或重写这些数据。
- UI 和 worker 根据工具自身路径定位，不依赖启动时的当前目录；扩展根目录显式传递给各项操作。

## 正式构建门禁

仓库级 `scripts/build-extension.mjs` 顺序执行工具检查进程和扩展 WXT 构建进程。检查缺失、异常、非零退出或信号退出都立即停止，不启动构建；没有跳过检查的参数。

正式入口固定当前仓库根目录及 `wxt.config.ts`，只接受 browser（chrome / edge / firefox）与 mode（production / development）的短、长参数形式。位置根目录、替代配置、入口过滤、重复或未知参数均在启动任何子进程之前拒绝，不原样转发给 WXT。

正式交付使用根目录的 `pnpm build`、`pnpm zip` 及其 Edge / Firefox 变体。`pnpm zip:all` 和 release-it 仍经由这些入口，因此保留人工裁决与整页确认门禁。开发 `pnpm dev` 不调用工具。

底层 `pnpm exec wxt build` / `wxt zip` 仅是扩展自身构建，不含质量门禁，不能作为正式交付命令。独立构建能力与发布授权是两件事；发布流程必须使用仓库入口，不能因门禁失败改用底层命令。

使用规范和数据完整性要求见 [评审流程](../../docs/testing/reading-review.md) 和 [标注规范](../../tests/corpus/annotation-policy.md)。
