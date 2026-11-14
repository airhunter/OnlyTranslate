# 两项推广旁注的已知限制接受记录

用户确认日期：2026-11-14。当前分支仍为 `codex/smart-reading-blocks`，未提交、未 push、未发布。

## 用户决定

用户明确选择：“保留原裁决，登记为已接受的已知限制，不阻断发布”。

因此保留 Josh 页面 e1331、e1333 原来的 `translate` 裁决，不将它们改成 exclude、either 或 pending。当前算法仍未选中这两块；用户接受本阶段的限制，不要求继续修改推广识别规则，也不让这两项阻断后续构建／发布检查。

正式接受记录单独保存在 `tests/corpus/accepted-issues.json`，含用户确认原因和日期。原裁决文件 `tests/corpus/decisions/josh-css-has.json` 的 SHA256 仍为 `5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`。

## 精确范围

| 项目 | 标题 | 正文 |
| --- | --- | --- |
| 接受记录 ID | josh-newsletter-title | josh-newsletter-body |
| 原文块 | e1331 | e1333 |
| 原裁决 ID | ed15fae5-9324-4084-b7fa-e1f235bf450e | 3f5129b4-d2c0-4bd4-9269-08740a1064f6 |
| 原要求 | 应翻译 | 应翻译 |
| 当前被接受的结果 | 未选中 | 未选中 |

两项均绑定页面 `josh-css-has`、快照 `f725f40a43c530131676b8de`、完整 HTML 摘要、各自原文摘要及口径版本 1。新快照、新裁决 ID、不同的未满足覆盖结果都不能沿用。修改原因／状态需保留 revision 历史；撤销追加同 ID 的更高 revision 和 revoked 状态，不删除历史。

接受决定不豁免缺失快照、错误原文锚点、损坏资源、回放异常或其他未满足项。识别算法以后若满足原裁决，则正常计为满足，不再计为未满足的已知限制。

## 实现与报告

只修改评审工具、门禁报告和流程文档，识别源码保持十项修复后的摘要 `9bb5cd67f7a43559ccc640cfab11dab028883fa3abf1962b562a224a9153d452`。

比较结果仍保留 `violation: true`，另外标出对应 `acceptedIssue` 和 `blockingViolation: false`。界面显示“已接受 · 不阻断”和用户原因；原来的“该翻”按钮仍是已保存裁决，不冒充算法已经修复。

真实回放结果为：**13 项要求，满足 11 项，未满足 2 项，其中已接受 2 项，阻断项 0。发布检查通过，包含已接受的已知限制。**

`pnpm test:reading` 已以状态 0 完成，报告为：

`C:\coding\translates_project\OnlyTranslate-review-data\checks\check-1794587568686-279b1b48\report.json`

正式 `pnpm build` 也已成功完成；其构建前检查重新执行真实回放，报告为：

`C:\coding\translates_project\OnlyTranslate-review-data\checks\check-1794587734380-5efc5884\report.json`

只验证了本地 Chrome 构建，没有执行发布、创建 tag 或生成 ZIP。锁定的 `OnlyTranslate-v1.15.0-chrome.zip` 摘要仍为 `d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`，未被覆盖。

## 验证证据

- `pnpm verify`：类型检查通过，145 个测试文件、1466 项测试通过。
- 新测试覆盖精确接受、其他块仍阻断、部分覆盖变化失效、新裁决失效、撤销接受、错误快照／HTML／文字／口径绑定、缺失数据与接受记录中途变更。
- API 测试使用隔离临时 corpus，确认原 translate 裁决、未满足事实、已接受及非阻断状态并存。
- Playwright 浏览器测试使用隔离临时 corpus，确认界面计数、已接受徽标、原因与原“该翻”选择；没有向真实裁决写入测试记录。截图为 `output/playwright/reading-review/accepted-issue-ui.png`。
- 本地真实评审 API 显示 confirmed=13、violations=2、acceptedIssues=2、blockingViolations=0，两项原 verdict 均为 translate。
- `git diff --check` 通过；代码未提交。

日志：`output/playwright/reading-review/accepted-issues-verify.log`、`accepted-issues-check.log`、`accepted-issues-build.log`。
