# 工程边界审核两项修复与复审说明

日期：2026-11-14。对应 `reading-review-boundary-astra-review.md` 的 P1、P2。用户授权修复两项、补回归、验证门禁后交 Astra 复审；不提交、不改识别算法、人工标注、整页确认或已接受限制。

## P1：固定正式构建对象

`scripts/build-extension.mjs` 新增参数校验及标准化：

- 只接受 build / zip；只允许 browser（chrome / edge / firefox）与 mode（production / development）。支持短、长及等号形式。
- 其他位置根目录、`-c/--config` 及其等号／紧凑写法、入口过滤、参数分隔符、未知参数、重复参数、缺失或非法值，均在任何子进程启动前失败。
- 实际传给 WXT 的参数重新构造为命令、固定的绝对仓库根目录、`--config <根目录/wxt.config.ts>` 及经过校验的选项，不再原样转发调用方参数。
- 校验子进程和 WXT 的 cwd 仍是同一个根目录。缺少工具、非零／信号退出和构建失败继续向上传播。
- 正式入口与底层 WXT 独立构建的工程分工不变；README 与 RELEASE 补充受限参数约定。

## P2：工具直接声明运行依赖

在 `tools/reading-review/package.json` 的 dependencies 中声明 `happy-dom: ^20.11.2`，锁文件工具 importer 绑定现有版本 20.11.2。没有升级 happy-dom，也不删除根项目扩展测试所需的声明。

## 回归测试及先失败后通过

- 编排测试新增 build / zip 参数拒绝矩阵、受支持参数形式及固定根目录／配置断言，保留原缺失／失败／终止传播和公开入口检查。
- 新增 `tools/reading-review/tests/dependencies.test.ts`：把未修改的 preview 和工具 package 放到仓库外临时目录，仅连接工具自己声明的运行依赖，调用真实 Node 导入并渲染预览。没有使用仓库祖先目录或 devDependencies 兜底。
- 修复前，新参数用例两项失败，隔离预览用例因 ERR_MODULE_NOT_FOUND 失败，见 `output/reading-review-boundary/{regression-before.log,dependencies-before.log}`。
- 修复后，编排 12 项、隔离依赖 1 项均通过，见对应 `*-after.log`。

## 门禁与构建验证

| 检查 | 结果 |
| --- | --- |
| `pnpm verify` | 扩展 144 文件／1,462 项、工具 6 文件／58 项，类型与测试均通过 |
| 真实根目录 `pnpm build` | 人工检查通过后 Chrome 构建通过 |
| 真实人工要求 | 13 项：11 满足、2 精确匹配既有已接受限制、0 阻断 |
| 缺失快照时的所有正式入口 | build、Edge / Firefox build、zip、Edge / Firefox zip、zip:all 均退出 1，WXT 未启动 |
| 同条件 development mode | 正式 build 退出非零，没有跳过检查 |
| 隔离真实 WXT：替换目录／配置、工具缺失、工具失败 | 14 个负例全部阻断，不产生未检查工程产物 |
| 隔离真实 WXT：校验成功后 build / zip | 两者均成功，检查记录和 manifest 均对应 A 工程 |

完整验证日志：`output/reading-review-boundary/{fixes-verify.log,fixes-build.log,fixes-gate-matrix.json,fixes-blocked-*.log}`。

隔离 A/B 复现与实际小型 ZIP：`output/reading-review-boundary/fixes-repro-aex8wW/`；完整记录为其 `evidence.json`，摘要为 `output/reading-review-boundary/fixes-smoke.json`。此处使用记录根目录／退出状态的检查桩和真实 WXT，验证编排与参数解析；不会将检查桩冒充真实人工校验。原审核目录 `astra-repro-4rr4FI/` 保留旧漏洞现场，其中 wrapper 仍是旧版，不代表当前代码。

真实人工检查报告：仓库同级 `OnlyTranslate-review-data/checks/check-1794658279111-cab7b1eb/report.json`。

## 范围保护

`output/reading-review-boundary/fixes-protected.json` 记录：231 个识别源码及真实人工数据保护文件全部不变，没有新增此类文件；原发布 ZIP SHA-256 仍为 `d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`。未覆盖发布 ZIP，未提交或 push。

请 Astra 独立复审当前源码、测试和证据，重点确认原 P1/P2 是否关闭、参数归一化是否引入新入口、依赖声明是否真正消除了根项目兜底。仅报告发现和验收结论，不直接改实现或真实人工数据；本文件不预设复审通过。
