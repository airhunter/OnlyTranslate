# 当前未提交改动审核说明

复审更新：首次 Astra 报告中的三项已有修复、回归及同快照差分，复审请先读 [修复说明](reading-review-astra-fixes.md)，再独立核对实现。首次报告保留为历史证据，以下是初审范围。

审核请求日期：2026-11-14。用户要求：整理当前改动，交给 **Astra 子代理** 审核，**先不要提交**。

## 审核对象与工作方式

- 工作目录：`C:\coding\translates_project\OnlyTranslate`。
- 分支：`codex/smart-reading-blocks`。
- 当前 HEAD：`f9c97a5d6a92c07463c30b125dc852894acf8455`，`fix(content): 扩展识文区外阅读块判断并补充快照对比工具`。
- 审核 **全部相关未提交改动，包括未跟踪文件**。只看 `git diff` 会漏掉评审台主体、测试集及新测试。
- HEAD 中既有 B+ 代码是上下文；本轮不重新扩大到整仓重构。
- `store-assets/product-hunt/` 是无关未跟踪目录，排除在此次审核之外，不修改。
- `entrypoints/main/siteProfiles/teapaw.ts` 在 status 中显示 M，但当前 `git diff` 没有内容变更；不要自行恢复、删除或重写。
- 只审核，不改产品代码、真实裁决、接受记录或 Git 状态。不 commit、push、建分支、发布、创建 tag，也不删除历史产物。
- 可运行只读检查或隔离的针对性测试。若需要复现，测试数据只放临时目录或忽略的 output，不操作真实标注。不要直接运行 ZIP 命令覆盖冻结的 v1.15.0 基线包。
- 请独立检查实现，不把本说明的结论、已通过测试或历史报告当成正确性的证明。

## 用户已明确授权的范围

1. 用户先要求提交当时的 B+ 代码，已形成 HEAD f9c97a5。
2. 随后要求在同一分支搭建 5～10 页试点：采集、发布版实翻基线、可视化差分和人工裁决。该阶段不改识别算法，工具工作暂不提交。
3. 用户明确要求：人工验证集必须在正式 build/zip 自动执行并阻断失败，开发热更新不受影响。
4. 用户随后授权修复 Josh 前十处技术误判，剩余两处推广旁注不动；用同一批快照比较，不改人工标注，不提交。
5. 用户已明确选择：**保留剩余两项原裁决，登记为已接受的已知限制，不阻断发布。** 因此此次存在独立的接受清单；这不是代理擅自把失败改成通过。
6. 用户现在只要求审核，尚未授权按发现的问题继续修复或提交。

## 改动组 A：本地评审台

新增 `scripts/reading-review/`：

- `server.mjs`：本机 HTTP 后端、样本清单、任务串行调度、固定基线、历史对比、裁决批量保存。
- `worker.mjs`、`driver.mjs`：页面采集、发布包身份核对、独立浏览器、发布版真实翻译观察、当前源码采集器构建。
- `catalogue.mjs`、`collector.ts`、`replay.mjs`：独立原文索引、当前识别目标、归档 DOM 回放及身份/摘要校验。
- `model.mjs`：按原文位置覆盖比较，人工裁决校验、历史及已接受限制匹配。
- `preview.mjs`：禁用原站脚本、事件与外部导航的本地预览和归档资源重写。
- `ui/`：测试集列表、固定基线与最新候选、折叠历史、文字高亮、搜索、定位、批量裁决草稿与保存、已知限制展示。
- 相应 `.d.mts` 类型声明。

新增 `pnpm review:reading`。原文快照、资源、实翻与运行保存在仓库外 `C:\coding\translates_project\OnlyTranslate-review-data`。清单、规范、真实裁决及接受记录进入 `tests/corpus/`。不新增数据库或 npm 依赖。

需重点审核：保存的原子性和并发冲突、草稿恢复、固定基线不会被重复运行覆盖、失败或不完整运行不会当作有效结果、原文覆盖比较不会因容器合并/拆分而误报、回放和预览的隔离与输入校验、后台任务错误处理。

## 改动组 B：构建前检查与两项明确接受

- `check.mjs` 自动发现所有已确认裁决，包括历史快照；重建当前采集器并在相同本地 DOM 回放，不调用翻译接口，不借用旧候选成绩。
- 校验页面/快照身份、原文锚点、文字摘要、HTML、归档资源和规范版本；检查前后校验输入与源码是否变化；记录机器报告和可视化候选运行。
- `build-gate.mjs` 与 `wxt.config.ts` 的 `build:before` 将非零结果传回正式 build/zip；仅 command=serve 跳过。
- 新增 `pnpm test:reading`；`pnpm verify` 保持类型与单元测试职责，不冒充真实快照检查。
- `.gitignore` 忽略 output 和浏览器临时产物；`tsconfig.json` 排除构建/归档目录，避免发布源码归档参与当前类型检查。
- `tests/corpus/accepted-issues.json` 只包含 e1331/e1333 两项用户明确接受的限制。

接受逻辑必须满足：原 translate 裁决不变；未满足事实仍报告；只有精确匹配页面、快照/HTML、原文、裁决 ID/口径/方向与已接受覆盖的记录不阻断。新裁决、不同未满足结果和 revoked 记录不能沿用；完整性错误与其他失败仍阻断。不能报告“13 项全部满足”。

重点检查是否存在静默跳过、失效豁免继续有效、错误被误计为通过、主路径或动态路径绕过、用户未确认的数据被计入正确率，以及 API/UI 与 CLI 的口径不一致。

## 改动组 C：十处技术误判修复

只修改两个识别源码文件：

1. `entrypoints/utils/contentUnitClassifier.ts`：
   - 编辑器工具栏：短 header、多个按钮，旁边有 textarea/pre 编辑区域；不靠 Code Playground 文字黑名单。
   - 文章元信息：紧凑的更新时间字段与日期值，或访问计数字段与值/语义控件；不全局排除日期和短标题。
2. `entrypoints/main/dom.ts`：
   - li/dd 中的文字 div 可包含受保护的行内 code，整体作为目标；代码仍由已有占位符机制保护。
   - 不放宽全局 code 黑名单，不处理两处推广旁注。

重点审核跨站误伤、嵌套/隐藏/交互/保护边界、动态收集一致性、真正代码被翻译的风险、长页面复杂度。新增正反例不能只验证所实现的条件，应尝试找能推翻规则的样本。

## 相关测试、数据及文档

- `tests/utils/readingReview.test.ts`：覆盖比较、API、批量原子保存/并发、固定历史基线、草稿、已接受限制展示。
- `tests/utils/readingReviewCheck.test.ts`：真实检查流程的隔离测试、失效数据、输入变更、门禁子进程、已接受限制精确边界与撤销。
- `tests/utils/autoTranslateTarget.test.ts`：新增行内代码双语插入和动态收集测试。
- 新 fixture：`editor-metadata-inline-code.html`、对应 smart JSON 及 full JSON。
- `tests/corpus/`：pages、release、check-policy、annotation-policy、decisions、accepted-issues。
- `AGENTS.md`、`RELEASE.md`、`docs/testing/reading-review*.md`：工作流及阶段性证据。早期报告记录历史状态，不应混淆为最新状态。

## 版本、差分与验证证据

发布基线：v1.15.0，源码提交 `65d20abd7af0aa55ae59ee57b515692bd941ca22`。锁定 ZIP SHA256：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`。

五页试点实翻已保存 169 条译文（Teapaw 8、Josh 111、Lil’Log 22、Ziggit 11、Python 17）。原文目标差分与译文数量不是同一个统计。

十项修复的同快照比较见 `output/playwright/reading-review/ten-fixes/before.json` 与 `after.json`：Josh 新增 1 块、减少 9 块，均对应已有用户裁决；另外四页无差异。Josh 扫描量 1710→1626，其他页不变。修复前/后识别源码摘要分别为 `3ab1cf7c7c8ddbaa3d76c277593b4045401b32f055c94ef93b70593e586a117a`、`9bb5cd67f7a43559ccc640cfab11dab028883fa3abf1962b562a224a9153d452`。

当前报告：13 项要求满足 11 项、未满足 2 项，其中已接受 2 项，阻断 0 项。**发布检查允许通过，算法没有全绿。**

最近验证结果（审核时可核验日志或复跑针对性测试）：

- 内容测试 444 项通过；十项修复后的完整验证 1460 项通过。
- 接受机制完成后的 `pnpm verify`：145 文件、1466 项通过。
- `pnpm test:reading`：状态 0，明确显示两项已接受限制。
- `pnpm build`：状态 0，真实执行了构建前检查。没有执行发布或 ZIP。
- 隔离 Playwright 测试验证接受徽标、原因和原 translate 选择共存。
- 原人工裁决文件 SHA256 仍为 `5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`。

日志位于 `output/playwright/reading-review/accepted-issues-{verify,check,build}.log`。机器报告位于外部数据目录 `checks/check-1794587568686-279b1b48/report.json` 和 `checks/check-1794587734380-5efc5884/report.json`。

## 期望审核输出

请先列实际可行动的问题，按严重程度排序。每项给出文件绝对路径与准确行号、触发场景、影响、代码证据或最小复现、建议修复方向。区分已证实缺陷、合理但未证实的风险、明确不在本期范围的限制。

不要把“用户已接受的两项仍未满足”本身当成未获授权的门禁绕过；要检查接受机制是否严格实现边界。也不要因现有测试通过就默认没有缺陷。

最后给出覆盖范围、做过的检查/测试、验证局限和结论：可进入提交前复核，还是应先修复哪些阻断项。没有发现时如实说明，不为凑数提出问题。
