# Astra 三项发现的修复与复审说明

日期：2026-11-14。对应首次报告 `reading-review-astra-audit.md`。用户已授权修复这三项、补回归、同快照比较并交 Astra 复审；没有授权提交。分支和 HEAD 仍为 `codex/smart-reading-blocks` / `f9c97a5`。

## 修复范围

### P1：历史快照被重复采集覆盖

将归档写入从 worker 拆至 `scripts/reading-review/archive.mjs`，供真实采集流程和隔离测试共用。每次采集生成独立 UUID，而非 HTML 摘要 ID；完整的 HTML、截图和元数据先写 `.pending-*` 目录，再原子 rename 到最终目录，随后更新 latest。当前服务已按 validId 排除暂存目录。失败不改变 latest、不覆盖旧快照。资源先以 wx 写入同目录临时文件，完整后通过硬链接原子发布到摘要名，随后移除该临时链接；已有资源须通过摘要检查，不以新采集修复或覆写旧文件，也不因中途中断在摘要路径暴露半文件。

现有五页快照保持原有 ID 和内容，不迁移、不重新采集、不改固定基线或用户数据。

### P2：行内代码聚合绕过后代保护

新聚合分支改为遍历所有后代，要求每个后代都是允许的内联元素、受保护 code 或 SVG 图形元素（不含 foreignObject），并调用已有 `isSafeInlineRunElement` 统一检查 CSS 可见性、ARIA 交互角色、编辑状态、notranslate、hidden 等边界。该函数只为本分支增加受保护 code 的显式入口，其他调用默认行为不变。

遇不安全后代，不再把整个 div 提升成翻译目标，继续交给既有扫描路径；不改全局 code 白名单、推广规则或其他用途标准。原正常列表说明仍整体收录，变量 code 仍用已有占位符保留。

Astra 第一轮复审确认原三项已解决，但发现递归标签白名单误排普通 SVG 的 path/g，导致整条列表说明漏收。已先补正例复现失败（svg-red.log），再允许真实 SVG 命名空间的图形后代，同时保留逐节点保护检查和 foreignObject 的聚合排除。新增静态、动态和实际插入的普通 SVG 正例，以及 SVG 中隐藏文字、foreignObject 内菜单项的反例；没有修改 SVG 中普通可见文字的既有独立收集口径。首次复审报告 reading-review-astra-rereview.md 保留历史结论。

### P2：发布缓存身份未核验

将准备逻辑从 worker 拆至 `scripts/reading-review/release.mjs`。校验 ZIP 的本次字节和完整 commit 后，在新的 verified 临时目录解压 ZIP 字节副本，并从完整 commit 重新 git archive。校验扩展及源码 package 版本后才返回输入，记录 sourceArchiveHash；不再读取原同版本 extension/source 缓存。解压中断留下的目录不会被下次复用。

采用每次重新准备输入，避免引入新的缓存信任机制。旧目录保留，未删除或重签原历史运行。

## 回归与真实验证

- 新增 `tests/utils/readingReviewIntegrity.test.ts`，6 项测试：同 HTML／不同 CSS 及视口仍创建新快照、旧元数据与截图及固定指针不变、重复采集新身份、失败不暴露半成品或更新 latest、已有坏资源不覆盖、同版本坏缓存不复用、解压失败重试、ZIP 和 tag 失配阻断。用临时目录和模拟外部命令，不写真实数据。
- `autoTranslateTarget.test.ts` 新增 13 个参数化反例，覆盖 display:none、visibility:hidden、menuitem、深层 navigation、深层隐藏 span、sr-only、dialog/complementary/contentinfo 角色、大小写角色、已翻译后代、SVG 隐藏文字及 foreignObject 内菜单项；检查静态目标、动态目标，以及实际翻译函数的请求输入和插入文本均不含受保护内容。正常代码和 SVG 正例也验证实际插入及动态收集。
- 拆分后先保留旧行为执行回归，日志 `output/playwright/reading-review/astra-fixes/red.log` 记录 10 项失败；再补齐的保护边界在 `boundary-red.log` 中复现 6 项失败。最终内容测试 458 项通过，完整 verify 为 146 个文件、1486 项通过；半成品测试使用不同 HTML，检查失败目录确实不对外暴露。
- 补齐 `model.d.mts` 中已有 readJson/validId 的导出声明，以便新测试通过类型检查；无相关运行时行为变化。
- 真实 Chromium 隔离验证：相同 HTML、外部 CSS 从可见改为 display:none，两次归档 ID 不同，旧元数据、截图与原固定指针保持；13 种受保护后代都不进入目标文本，正常带 code/em/SVG 的说明仍被收录。记录 `chromium.json`，脚本 `chromium.mjs`。
- 使用真实锁定 v1.15.0 ZIP 和 commit 完成新输入准备及采集器编译，没有调用实翻服务。源码归档摘要为 `225c160ffae34403ed485ab0bba43081d4c3142f6a67e68f8d08538633ca6e26`；证据 `release-inputs.json`。
- 新的真实人工检查仍为 13 项中 11 满足、2 已接受的未满足、0 阻断；最终机器报告 `C:\coding\translates_project\OnlyTranslate-review-data\checks\check-1794631903343-832aa615\report.json`。

本节产物均在忽略目录 `output/playwright/reading-review/astra-fixes/`；旧 Astra 诊断脚本提取的是旧 worker 函数，复审应以当前导出的归档／发布准备函数和新增正式回归为准。

## 同一批五页快照差分

修复前直接冻结上一轮 after.json（识别源码摘要 `9bb5cd67f7a43559ccc640cfab11dab028883fa3abf1962b562a224a9153d452`），最终修复源码摘要为 `5eaa130c3b0ed9376fead033ebb09a7a5eb71b55725e1a8727fb78dbfeccf2ae`，采集器摘要为 `81f4b5e5e871739d44bef66d4a1dcff2a276692dc86dfe26af854359fd5b0a2c`。before.json 与 after.json 记录了不同的采集器摘要，不是新版自比较。

| 页面 | 快照 ID | 目标数 前→后 | 新增／减少 | 扫描量 前→后 |
| --- | --- | --- | --- | --- |
| Teapaw | a15d480469e97ea9cf14c64f | 15→15 | 0／0 | 194→194 |
| Josh | f725f40a43c530131676b8de | 120→120 | 0／0 | 1626→1626 |
| Lil’Log | 746df28629938d77d2402873 | 22→22 | 0／0 | 240→240 |
| Ziggit | fadc07a466e17f30175a8d31 | 11→11 | 0／0 | 1539→1539 |
| Python | 960bca572fcd880e7f5d3c27 | 17→17 | 0／0 | 84→84 |

每页都验证原文索引、HTML 和资源摘要，预算均未超出。这仅说明当前五页未出现变化，不代表保护反例不存在，也不代表其他网页已覆盖。

## 未改的数据与限制

- 原人工裁决 SHA256：`5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`。
- 两项接受记录 SHA256：`d916121d28826ae4454757f8c61c6fcb30604e4a3d7225e3cd48f3e6b3a74a3d`。
- 官方发布 ZIP SHA256：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`。
- 没有修改上述文件、规则退役或推广识别，没有重新实翻或覆盖旧基线，也没有声称新实现能反向证明所有历史输入可信。
- 不安全容器不整体提升，可能仍留下可见文字由后续识别改进处理；本轮没有借此修改内容口径或静默放行隐藏内容。
- 不清理失败暂存或旧 release 目录；它们不参与新快照/发布输入选择，后续清理需单独处理。

## 交给 Astra 的复审任务

请针对首次三项分别给出：已解决／未解决／新回归，核对测试是否真正防止原触发条件。尤其检查原子可见性、旧快照兼容、同版本或中断缓存无法影响新输入、聚合后代的保护是否仍有绕过，以及真实裁决和已接受限制是否原样保留。

复审只读，不改产品代码或真实数据，不提交、push 或发布。请一并确认首次复审的 SVG 回归已解决且保护反例仍成立。可在隔离目录追加复现。允许新增独立结果文档 `docs/testing/reading-review-astra-final-review.md`，保留前两份报告，不改写历史结论。
