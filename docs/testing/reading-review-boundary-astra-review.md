# Astra 审核：评审台与扩展工程边界

审核模型：GPT-6 Astra，xhigh。日期：2026-11-14。分支 `codex/smart-reading-blocks`，HEAD `7adaf68`。

结论：**发现 1 项 P1、1 项 P2，建议修复后复审。** 默认正式入口都已接入检查，但参数可使检查与构建对象分离；工具依赖尚未完全自声明。此次只审核并保留隔离复现资料，没有修改实现、识别算法、人工数据或发布 ZIP，没有提交或 push。

## P1：正式入口允许检查 A 工程后构建 B 工程

位置：`scripts/build-extension.mjs:20–26`。

- 第 20 行仅验证命令名称为 build 或 zip。
- 第 22 行始终对固定 root 执行检查，没有把实际构建参数交给检查器。
- 第 26 行把完整 args 原样交给 WXT。

WXT 接受另一项目根目录及 `-c/--config`。因此，正式入口传入另一目录或替代配置时，当前仓库的检查可以通过，但实际产物来自另一份源码：

```text
pnpm build <另一项目目录>
pnpm build --config <设置了其他 root 的配置>
```

**已复现。** 审核将原样 wrapper 复制到隔离 A 工程，检查子进程使用“记录检查目录并成功退出”的桩；构建阶段使用真实已安装的 WXT 0.21.4。没有改真实标注，也没有模拟 WXT。

| 参数 | 检查记录 | 实际产物 | 退出码 |
| --- | --- | --- | --- |
| `build <B目录>` | checkedRoot 为 A | manifest.name 为 unchecked-project-b，页面内容来自 B | 0 |
| `build --config <root=B的配置>` | checkedRoot 为 A | manifest.name 为 unchecked-config-b，页面内容来自 B | 0 |

复现证据：[cli-evidence.json](../../output/reading-review-boundary/astra-repro-4rr4FI/cli-evidence.json)。其所在目录保留原样 wrapper、A/B 工程、替代配置及实际产物。zip 使用相同参数转发路径，静态确认同样受影响；本轮没有生成 ZIP。

影响：正式入口执行过人工校验，却无法保证被交付源码就是被校验源码。这是正式 wrapper 的对象错位，区别于底层 WXT 可以无工具独立构建的既定设计。

最小建议：正式入口固定本仓库及既定配置，拒绝其他位置根目录及 `-c/--config` 等改变构建输入的参数。若要支持多根目录或配置，必须先解析实际构建对象，再把相同对象交给校验和构建。

## P2：工具运行代码仍依赖根工程提供 happy-dom

位置：`tools/reading-review/package.json:12–17`；直接使用位置 `tools/reading-review/preview.mjs:1`，服务通过 `server.mjs:7` 导入。

preview 直接导入 happy-dom 的 Window，用于构建、清理及改写预览 DOM。服务启动即导入该模块，但工具自己的 package 和锁文件 importer 未声明 happy-dom，当前借助根扩展的依赖解析成功。

**静态确认，并进行了隔离导入验证。** 当前解析结果指向根 node_modules 下的 happy-dom@20.11.2。把未修改的 preview.mjs 和工具 package 放到仓库外临时目录后导入，报错：

```text
ERR_MODULE_NOT_FOUND
Cannot find package 'happy-dom' imported from .../preview.mjs
```

这次没有联网重装依赖，隔离导入输出未单独保存为证据文件。直接导入与自身声明缺失已确认。

影响：仅安装工具声明的依赖，或者根扩展以后不再安装 happy-dom 时，工具服务会因缺少模块无法启动，安装边界尚不独立。

最小建议：在工具 package 中直接声明 happy-dom；它是服务运行依赖，宜放入 dependencies，并更新工作区锁文件对应 importer。根工程继续保留扩展测试需要的声明。

## 依赖与入口核查结论

扩展运行代码及 WXT 配置未发现对评审台的反向导入。采集适配器仍单向调用真实识别函数，Vite 采集构建使用 configFile: false；根类型配置排除工具目录，两边测试配置分开。源码和配置边界基本成立，安装边界存在上述 P2 缺口。

已追踪 build、build:edge、build:firefox、zip、zip:edge、zip:firefox；zip:all 顺序调用三个有门禁的入口；release-it 的 before:github:release 调用 zip:all 再检查发布产物。工具缺失、非零退出或信号终止都会阻止 WXT，构建失败向上传播；开发入口仍直接运行 WXT。

底层原生 WXT 没有门禁是本轮明确选定的边界，不单独作为缺陷。默认正式入口未发现遗漏，但所有被接受参数下的校验与构建对象一致性尚不成立，见 P1。

## 测试盲区与验证范围

- `tests/utils/buildExtension.test.ts:12–20` 验证 browser、mode 参数转发，未验证另一根目录或替代配置。第 37–52 行的 WXT 桩仅记录参数，没有执行真实 WXT 参数解析，无法发现对象错位。
- 工具测试在完整仓库的依赖环境中运行，不能发现未声明的直接依赖。
- `tools/reading-review/tsconfig.json:11` 只包含 tests/**/*.ts，类型检查通过不代表浏览器适配器经过类型检查。这是验证范围限制，没有据此另列当前行为缺陷。

| 本次独立验证 | 结果 |
| --- | --- |
| 编排定向测试 | 7/7 通过 |
| 工具独立 TypeScript 检查 | 退出码 0 |
| 工具单元测试 | 57/57 通过 |
| 两种替换输入的真实 WXT 隔离构建 | 均复现检查 A、构建 B |
| 工具直接依赖检查 | 确认缺少 happy-dom |
| 保护清单重新计算 | 231 个文件均未变 |
| 原发布 ZIP SHA-256 | 与审核前一致 |

工具 API 测试最初因沙箱本机 HTTP EACCES 失败，通过既有权限机制重跑后全部通过，未列为实现问题。pnpm 初次执行的自安装缓存 symlink 权限问题也未列为实现问题，审核改用已安装的 Node 工具入口执行定向测试与类型检查。

原发布 ZIP SHA-256：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`。

本次没有重跑真实 corpus 校验、发布版翻译或 ZIP 打包；既有记录只作为背景，未冒充独立复测。没有其他已确认的独立实质问题。
