# 人工验证集构建校验验收记录

最新决定：两项剩余限制已获用户明确接受，当前为 11 项满足、2 项已接受的未满足、0 项阻断；正式 build 已通过。见 [接受与验证记录](reading-review-accepted-issues.md)。以下为门禁初次验收历史。

后续更新：用户授权的十处技术误判现已修复，当前为 13 项要求满足 11 项、违反 2 项，见 [十处修复与同快照差分](reading-review-ten-fixes.md)。下文保留构建门禁初次验收时的历史结果。

日期：2026-11-12。分支：`codex/smart-reading-blocks`；原提交仍为 `f9c97a5`。本轮改动未提交，也未 push 或新建分支。

## 已完成

`pnpm test:reading` 自动发现仓库中已保存的人工裁决，用当前源码重新构建识别采集器，在对应本地快照上检查原文覆盖。不调用翻译接口，不使用旧运行充当本次结果。历史快照也检查，不只看 latest 指针。

正式 WXT build/zip 已通过 `build:before` 接入同一检查，覆盖 Chrome/Edge/Firefox 的命令与直接调用 WXT。只有开发 serve 跳过；正式构建使用 development mode 仍然检查。失败发生在 WXT 清理及重建扩展产物之前。

检查失败包括：未满足人工要求、没有有效确认、缺少快照或归档资源、原文定位失效、摘要或规范版本不匹配、回放异常，以及运行期间源码、清单、裁决或快照变化。待定撤销旧要求；都可以不限制是否选中。新结果追加为候选运行，报告和旧基线均保留；校验过程中身份失效的候选会另记无效标志。

约束已写入 AGENTS.md、RELEASE.md 和 `reading-review.md`。算法源码无内容 diff，真实裁决文件未改，未处理无关的 `store-assets/product-hunt/`。

## 真实人工要求结果

当前只有 Josh 快照 `f725f40a43c530131676b8de` 有 13 项有效确认：满足 1 项，违反 12 项。三次真实回放结果一致，没有回放工具错误。

| 块 | 用户要求 | 当前未达标情况 |
| --- | --- | --- |
| e216、e498、e1779、e1976、e2157、e2358 | 不该翻 | Code Playground 被选中 |
| e1331 | 该翻 | Curious about this control? 未完整选中 |
| e1333 | 该翻 | 自定义控件／课程说明未完整选中 |
| e2975 | 该翻 | Sets the category data attribute… 未完整选中 |
| e3277、e3278、e3280 | 不该翻 | Last updated on、日期、# of hits 被选中 |

没有为了通过检查修改这些要求。因此当前正式 build/zip **按用户要求被阻断**。修复算法或调整产品口径属于后续工作，不能把本轮工具测试通过理解为算法已满足这 13 项要求。

## 验收证据

- 评审台与构建校验针对性测试：24 项通过；均使用隔离临时 corpus。
- `pnpm verify`：类型检查通过，145 个测试文件、1456 项测试通过。日志：`output/playwright/reading-review/build-gate-verify.log`。
- 独立 `pnpm test:reading`：正常完成真实回放，因 12 项违反以状态 1 退出。
- 直接 `node node_modules/wxt/bin/wxt.mjs build`：状态 1，明确显示人工验证集未通过，正式构建已停止。日志：`output/playwright/reading-review/build-gate-build.log`。
- 直接 `node node_modules/wxt/bin/wxt.mjs zip --mode development`：同样状态 1，不能通过 mode 绕过。日志：`output/playwright/reading-review/build-gate-zip.log`。
- 指向空的本地数据目录运行检查：没有启动真实采集器回放，以状态 1 报快照不存在；未误报为通过。
- 原 `.output/OnlyTranslate-v1.15.0-chrome.zip` 的 SHA256 仍为 `d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`，未覆盖。
- 开发路径的 serve 跳过和正式命令失败传播有专项自动测试；本轮没有为测试启动开发扩展或改动真实网页。

机器报告位于 `C:\coding\translates_project\OnlyTranslate-review-data\checks\`：

- `check-1794456991133-0820bef0/report.json`：独立检查。
- `check-1794457065533-ecac6bbd/report.json`：正式 build 阻断。
- `check-1794457138182-17cb2f43/report.json`：zip development mode 阻断。

人工裁决文件保存时 SHA256：`5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`，路径 `tests/corpus/decisions/josh-css-has.json`。用户后续继续标注会自然改变此摘要，不要据此阻止正常修订。

## 下一步边界

评审台仍可用 `pnpm review:reading` 启动，数据目录不变。可以继续人工审核和扩大测试集；正式构建会自动使用新保存的确认。未审核内容仍不计准确率，未标注页面不会被宣称全部正确。

如需处理上述 12 项，先按原约定讨论识别方案、保存同快照对照，再在获得授权后改算法。不要跳过门禁，也不要自动替用户改判。
