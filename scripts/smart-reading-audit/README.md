# 识文目标对比

用两个独立 Playwright 会话分别采集公开网页和离线回放。回放会话从空白页启动，无需加载扩展。

```text
npx --yes --package @playwright/cli playwright-cli -s=smart-audit-live open about:blank --browser chrome
npx --yes --package @playwright/cli playwright-cli -s=smart-audit-offline open about:blank --browser chrome
node scripts/smart-reading-audit/audit.mjs build output/playwright/smart-audit/baseline.js
node scripts/smart-reading-audit/audit.mjs capture smart-audit-live teapaw-home output/playwright/smart-audit
node scripts/smart-reading-audit/audit.mjs collect smart-audit-offline output/playwright/smart-audit/teapaw-home.snapshot.json output/playwright/smart-audit/baseline.js output/playwright/smart-audit/baseline.json
```

新版本构建为另一个采集产物，使用同一份 `.snapshot.json` 和 HTML 生成 `candidate.json`，再运行差分。

```text
node scripts/smart-reading-audit/audit.mjs compare output/playwright/smart-audit/baseline.json output/playwright/smart-audit/candidate.json output/playwright/smart-audit/diff.json
```

每次采集目标都分别运行站点规则开启和关闭两组。结果记录构建时的 Git 提交、`entrypoints` 的 Git diff 摘要及含未跟踪源码的摘要、快照及产物摘要、目标路径、文字前 200 字、决策来源和扫描统计。差分按目标路径及完整文字摘要识别增删，分段变化需人工复核。不同构建即使指向同一个提交，也可按源码与产物摘要区分。

回放保留原网址、视口、滚动位置、HTML 和已捕获的样式表。网页脚本及外部请求会被阻断，图片、字体和 iframe 未归档。对虚拟化页面要采集关注区域已渲染的状态。Ziggit 另有 `initial` 和 `focused` 快照，可作为 `collect` 的最后一个参数。

每页的 `exclusions` 是待修复的多翻反例，目前只做探针记录，不作为失败断言。整页 PNG 是公开原页的辅助证据。目标采集和差分无需调用翻译服务。

批量采集以 fixture URL 去重。采集清单记录每个 URL 是否保存、跳过或失败。批量回放可使用已保存的真实页面，或直接使用识文 fixture 的结构样本，两类结果单独存放。

```text
node scripts/smart-reading-audit/audit.mjs capture-corpus smart-audit-live output/playwright/smart-audit/live
node scripts/smart-reading-audit/audit.mjs compare-corpus smart-audit-offline baseline.js candidate.js output/playwright/smart-audit/live-diffs output/playwright/smart-audit/live
node scripts/smart-reading-audit/audit.mjs compare-corpus smart-audit-offline baseline.js candidate.js output/playwright/smart-audit/fixture-diffs
```

`unselectedStrongOutsideBlocks` 只统计已经检查过的区外块。`budgetDeferredReadingSubtrees` 单独记录预算终止时未检查的子树根数，其内部还有多少强正文未评估。
