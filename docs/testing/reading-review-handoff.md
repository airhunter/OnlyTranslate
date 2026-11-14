# 识文评审台中途交接

2026-11-14 最新进度：用户明确接受剩余两项已知限制，保留原裁决并允许发布检查放行；实现与真实 build 验证完成，见 [接受记录](reading-review-accepted-issues.md)。识别算法本轮未改，全部后续工作仍未提交。

最新进度：已按用户授权修复十处误判，同批五页差分与测试完成，参见 [十处修复记录](reading-review-ten-fixes.md)。两处推广旁注暂未处理，代码和人工验证体系仍未提交。

**2026-11-12 更新：已续做并完成构建门禁，最新状态见 [构建校验验收记录](reading-review-build-check.md)。以下保留 11 月 11 日关机时的历史状态，不能据此认为门禁仍未实现。当前仍未提交，算法和真实裁决未改。**

保存时间：2026-11-11 23:31（Asia/Shanghai）。用户要求先保存过程、关机，回头继续。本次停在构建校验接入途中，不继续开发。

## 范围与已确认决定

- 当前分支：`codex/smart-reading-blocks`，不新建分支。
- 现有 B+ 代码此前已按用户要求提交：`f9c97a5d6a92c07463c30b125dc852894acf8455`，提交标题为 `fix(content): 扩展识文区外阅读块判断并补充快照对比工具`。
- 后续评审台及构建校验工作全部保持未提交；不要 commit、push。
- 本轮只建验证体系，不修改识别算法，不替用户修改人工裁决。
- 用户最新明确选择：**正式 build／zip 都必须通过人工验证集，失败阻断；开发热更新不受影响。**
- 截止保存时，这个构建门禁尚未接完，不能声称现在已经会自动阻断。

## 已完成的评审闭环

- 本地评审台：`pnpm review:reading`，地址 `http://127.0.0.1:4188`。
- 已采集五页：Teapaw、Josh Comeau CSS :has()、Lil’Log、Ziggit、Python Appetite。
- 发布版真实翻译基线共保存 169 条译文；各页分别为 8、111、22、11、17 条，最终有效发布版运行均无待处理和失败。
- 发布基线为 `v1.15.0`，源码提交 `65d20abd7af0aa55ae59ee57b515692bd941ca22`。
- 官方 ZIP：`.output/OnlyTranslate-v1.15.0-chrome.zip`，SHA256 为 `d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`，此前已和官方发布包核对。
- 同一快照的原文覆盖差分：Teapaw +17/-0，Josh +19/-0，其余三页 +0/-0。这些是变化量，不是准确率。
- 回放禁用原站脚本，验证快照身份、HTML 和归档资源摘要。采集与回放会话隔离，普通网页 Service Worker 被阻止。旧的无效 Ziggit 回放已标记无效，不算通过。
- 可视化差分、定位原文、任意块补标、查看发布版译文及整页截图已经可用。
- 支持连续选择多个块，再“统一保存本页”；草稿按页面和快照保存在浏览器 localStorage，刷新可恢复。正式保存为一次原子批量写入，带并发冲突检查。
- 默认只展示固定发布基线与最新有效候选；旧运行折叠在“历史记录”，临时查看历史不会改变默认。基线只能由显式操作调整，历史结果保留。
- “疑似漏译”目前只是提示：可见原文块、两版均未选中、规范化文字长度至少 80 且有句末标点。不是算法已证实的漏译，不能直接当人工标注。

## 数据与文件位置

- 完整快照、资源、运行、任务：`C:\coding\translates_project\OnlyTranslate-review-data`，在仓库外。关机前无需另外导出；不要删除此目录。
- 环境变量 `ONLYTRANSLATE_REVIEW_DATA` 可指定数据目录；默认端口 4188，可由 `ONLYTRANSLATE_REVIEW_PORT` 调整。
- 网页清单：`tests/corpus/pages.json`。
- 发布身份：`tests/corpus/release.json`。
- 人工规范：`tests/corpus/annotation-policy.md`。
- 已保存的真实人工裁决：`tests/corpus/decisions/*.json`，保留修订历史；不要用测试数据覆盖。
- 未统一保存的草稿在原浏览器 localStorage，键为 `onlytranslate-reading-review-drafts-v1`；下次使用同一浏览器配置恢复，不清理站点数据。
- 每快照固定基线指针：外部数据目录下 `snapshots/<page>/<snapshot>/comparison.json`。
- 工具代码：`scripts/reading-review/`；测试：`tests/utils/readingReview.test.ts`。
- 使用文档：`docs/testing/reading-review.md`；早期试点报告：`docs/testing/reading-review-pilot.md`。试点报告的测试数量是当时记录，以本交接的验证边界为准。

## 当前人工要求与阻断含义

上一轮读取评审 API 时，Josh 有 13 项当前有效人工要求，候选版违反其中 12 项。此数字是当时结果，续做时重新读取，不写死进检查器。

其中包括 Code Playground、日期等应排除，以及用户指定应该翻译的说明文本。**这些是用户裁决，不得为了构建通过而改标注或悄悄调整算法。** 校验接完后当前版可能按预期无法正式构建，应准确报告原因。

## 构建门禁：已做的准备，尚未完成

已经落盘但尚未完整验证的改动：

1. 新增 `scripts/reading-review/replay.mjs`：从 worker 抽出共用回放；支持可选的原文 catalogue 一致性校验。发布实翻可能注入节点，因此默认不开 catalogue 严格比较，普通校验回放再显式开启。
2. `worker.mjs` 改为导入共用回放，源码摘要调用改为共用 `fingerprintSources`。此前只做过 `node --check`，尚未重跑完整回放回归。
3. `driver.mjs` 新增 `fingerprintSources(root)`，按 entrypoints 文件内容计算摘要，并预留 `build-check-*` 独立浏览器会话。
4. 新增 `tests/corpus/check-policy.json`，schemaVersion=1、annotationPolicyVersion=1、minimumConfirmed=1，避免空标注集静默通过。

**尚未实现：** `scripts/reading-review/check.mjs` 不存在；`package.json` 尚无 `test:reading`；`wxt.config.ts` 尚无构建门禁 hook；门禁专项测试、文档尚未写。

下一步按此顺序继续：

1. 实现检查 CLI，自动发现所有已保存裁决（含非最新快照），按同块最新记录判定；pending 撤销旧确认，either 可接受选中或未选中。
2. 校验规范版本、块锚点和文字摘要、快照和归档资源完整性。缺数据、无已确认要求、回放失败要失败，不能当通过。
3. 用本次源码新建采集器，在同一批本地快照上回放，不调用翻译接口、不打开线上页面，不借用旧候选成绩。运行前后校验源码摘要。
4. 输出机器可读报告，明确满足数、违反数、错误及快照和源码身份；逐项列出违反的人工要求。
5. 接入 WXT `build:before`：仅 `wxt.config.command === 'serve'` 跳过，其他正式 build/zip 调用检查 CLI，非零退出阻断。
6. 增加临时隔离数据的测试，确认缺数据不放行、历史快照标注被检查、pending/either 正确、原始 WXT 命令也不能绕过；保持开发热更新不受影响。
7. 更新 AGENTS.md、RELEASE.md、使用文档，解释门禁和数据恢复。用当前真实要求验证预期阻断，不改算法和裁决去追绿。
8. 跑针对性测试及 `pnpm verify`，将真实预期门禁失败和工具实现错误分开报告，仍不提交。

WXT hook 已核对当前文档与本机安装源码：`build:before` 在清理构建产物之前执行；zip 也先执行 internalBuild，单一 hook 即覆盖两者。应按 command 区分 dev，不按 mode，防止 build --mode development 绕过。没有必要同时挂 zip hook 导致重复检查。

## 验证状态

- 历史界面／批量保存完成时，`pnpm verify` 已通过：144 个测试文件、1444 项测试。日志：`output/playwright/reading-review/history-verify.log`。
- 对应针对性测试 12 项通过：`output/playwright/reading-review/history-tests.log`。
- 隔离数据的浏览器实测已覆盖批量保存、刷新恢复、冲突保护、固定基线和历史切换。
- **以上完整通过结果早于最新 replay 抽取和门禁准备，不能替代对最新代码的验证。**
- 保存时没有启动新的测试、构建或采集任务；下次关机重启后重新启动服务即可。

## 续做前检查

先读本文件，再检查 git status 和真实裁决，保留所有工作区改动。当前 `entrypoints` 与已提交版本没有内容 diff；`teapaw.ts` 虽显示 M，但此前核对为无内容变化。`store-assets/product-hunt/` 是无关未跟踪文件，不处理。

重启评审台可运行：

```powershell
$env:npm_config_manage_package_manager_versions='false'
pnpm review:reading
```

接着从“实现 check.mjs”继续。不要重新做发布版实翻，不要把中途状态描述为已经完成构建阻断。
