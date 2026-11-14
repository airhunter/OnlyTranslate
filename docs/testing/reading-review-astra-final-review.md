# Astra 最终复审报告

日期：2026-11-14。审核对象：原三项修复及首次复审提出的 SVG 回归修复。前两份报告 `reading-review-astra-audit.md`、`reading-review-astra-rereview.md` 保留历史结论。

**结论：原三项缺陷和 SVG 新回归均已解决。本次范围内未发现仍需阻断的已证实缺陷，可进入提交前复核。此结论不授权提交或发布，也不表示全站识别完全正确。**

冻结识别源码摘要：`5eaa130c3b0ed9376fead033ebb09a7a5eb71b55725e1a8727fb78dbfeccf2ae`。本次独立计算与最新五页 after.json、真实门禁报告一致。

## 逐项结论

| 问题 | 最终结论 | 本次核验 |
| --- | --- | --- |
| 同 HTML 重新采集覆盖历史快照 | 已解决，未回退 | 重读 archive.mjs 和真实调用边界，重新执行隔离归档测试；UUID、pending 目录原子发布、旧快照及固定指针保留、坏资源不覆写仍成立 |
| 行内代码聚合绕过隐藏/控件保护 | 已解决，未回退 | 全后代安全检查仍执行；静态、动态、实际请求和插入反例重新运行通过 |
| 发布输入复用未经核验的缓存 | 已解决，未回退 | 重读 release.mjs，重新执行隔离输入测试；每次新目录、已验证 ZIP 字节副本和完整 commit 归档路径保持，无旧缓存复用 |
| 普通 SVG/path/g 导致列表说明漏收 | 已解决 | 独立重跑上一轮同一最小复现，当前代码恢复选中原说明 div；新增静态、动态和插入正例通过，SVG 隐藏文字及 foreignObject 控件反例也通过 |

SVG 相关实现位于 `C:\coding\translates_project\OnlyTranslate\entrypoints\main\dom.ts:1481` 附近。放行条件要求真实 SVG 命名空间，并排除 foreignObject；所有后代仍通过角色、sr-only、已翻译标记及共享安全检查。因此此次修复没有通过直接跳过整个 SVG 子树来恢复正常图标。

正常 SVG 复现的当前结果包含 `div#sample`，原文为：

```text
Sets the __ONLY_TRANSLATE_INLINE_0_w1fybi__ parameter normally.
```

这与上轮修复前的正常收录一致，不再只剩文章标题和介绍段落。SVG 原节点在实际双语插入后保留，code 仍通过占位符恢复。普通可见 foreignObject 的文字若由既有独立路径收集，不是隐藏信息泄漏，本次未将其扩列为缺陷。

## 本次独立执行

```powershell
node node_modules/vitest/vitest.mjs run tests/utils/readingReviewIntegrity.test.ts tests/utils/autoTranslateTarget.test.ts tests/utils/autoTranslateTargetFixtures.test.ts
node node_modules/vitest/vitest.mjs run --config output/astra-review/rereview.config.ts
```

结果：正式测试 **3 文件、315 项通过**（完整性 6、目标及插入 183、fixture 126）；另一个上一轮 SVG 诊断复现执行成功，确认说明目标已恢复。诊断脚本未启用修复前内存替换，使用当前真实源码。

另外独立执行以下只读核验：

- 重新计算当前识别源码摘要，确认与 latest after.json 和门禁报告一致。
- 重新读取五页原始快照，通过 replayPayload 核验 HTML 和全部已归档资源摘要。
- 使用当前 compare 对已保存 before/after 重新计算原文覆盖，五页均 0 增、0 减，扫描量不变。
- 独立核对真实裁决、接受记录和官方 ZIP 的 SHA256。
- `git diff --check` 通过。

| 页面 | 本次重新核算的新增／减少 | 扫描量前→后 |
| --- | --- | --- |
| Teapaw | 0／0 | 194→194 |
| Josh | 0／0 | 1626→1626 |
| Lil’Log | 0／0 | 240→240 |
| Ziggit | 0／0 | 1539→1539 |
| Python | 0／0 | 84→84 |

以上五页结果是独立重算保存产物并验证输入，不冒充本次重新执行 Chromium 全页回放。

## 读取核验的主代理证据

已阅读最新修复说明、对应实现及测试，并核对这些已保存证据：

- 最新 `chromium.json`：归档使用相同 HTML/不同 CSS，两个 ID 不同，旧 metadata/截图/固定指针完整；13 个受保护反例无 `Private hidden message`，code/em/SVG 正例恢复收录，共 14 个场景。
- 最新机器门禁报告 `C:\coding\translates_project\OnlyTranslate-review-data\checks\check-1794631903343-832aa615\report.json`：sourceHash 与当前一致，13 项要求中 11 项满足、2 项未满足且已接受、0 项阻断，ok=true。
- 修复说明记录完整内容测试 458 项、完整 verify 146 文件/1486 项通过；本次未重复这些完整命令，也不把该数量表述为复审独立重跑结果。
- 发布输入准备的真实 v1.15.0 证据沿用上轮，当前 release 输入实现未回退；本次没有重新执行真实扩展加载或实翻。

两项接受限制仍是未满足项，没有被写成算法修复或 13 项全部满足。

## 数据与审核边界

本次独立计算的文件摘要仍为：

- `tests/corpus/decisions/josh-css-has.json`：`5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`
- `tests/corpus/accepted-issues.json`：`d916121d28826ae4454757f8c61c6fcb30604e4a3d7225e3cd48f3e6b3a74a3d`
- `.output/OnlyTranslate-v1.15.0-chrome.zip`：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`

本次未发现新的已证实阻断项。审核覆盖原四个发现的触发条件、此次 SVG 的放行与保护边界、隔离回归、当前五页证据身份及真实数据摘要；不代表任意网站、SVG 结构或动态状态已全面覆盖。没有重新运行正式 build/zip、全量 verify 或真实浏览器五页回放。

未改产品代码、真实快照、人工裁决、接受记录或前两份审核报告；未提交、push、建分支或发布。本次仅新增最终审核报告。此前明确的非本轮问题和当前串行采集范围外的并发限制，不扩列为新的修复要求。
