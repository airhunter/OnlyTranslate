# 全页翻译第一阶段实现与验收

日期：2026-10-22  
分支：`codex/page-translation-redesign`  
基线：`d8569f394868537741899b260cfcc5598942e15e`（1.13.0，工作区未提交）  
范围：已确认的 P1-0 至 P1-4；不包含后续属性翻译、标签页标题、iframe 或结构自动选范围。

2026-10-23 更正：下文 10 月 22 日的请求、交互检查没有覆盖侧栏实际排版，不能据此认定双语布局全部通过。维护者截图指出的侧栏竖排已按文末追加记录修正并复验。

## 本次实现

| 项目 | 最终行为 |
| --- | --- |
| P1-0 仅译文 | 原位更新 Text，保留原链接、按钮、事件和输入状态。严格校验分隔标记与保护占位，连续响应无法对应时仅增加一次分行请求。宿主或源内容变化使旧结果作废，不能重新接纳旧快照；重试只回原协议文本时也显示失败。 |
| P1-1 覆盖 | 显式 Full Page 复用现有正文目标，补导航、侧栏、菜单、按钮、summary、表头/单元格和静态表单文案。输入、编辑区、代码/公式、隐藏区域、notranslate/translate=no 和扩展 UI 继续保护。 |
| P1-2 分组 | 连续正文沿用原分组，零散静态文字补可恢复的 direct-text 目标；多个独立操作不串为一个目标。短标签不再统一要求至少三个字符；短拉丁字母标签不以不可靠的同语言推断为由跳过，自动源语言交给服务。 |
| P1-3 双语显示 | 紧凑控件行内显示，不插 br 或改成块布局。有明确截断限制的摘要，原文与译文各保留原行数，仅调整它们实际所属的截断链；恢复原结构和扩展仍持有的样式，不覆盖网站后来改过的样式。 |
| P1-4 动态 | Full Page 初始与动态扫描使用相同范围。菜单显现、details 展开、文本更新和节点复用会继续处理；自身写入不触发重译。移除的目标清理原记录与队列引用；同批移出、改内容、再插入也不能被旧标记挡住。 |

识文保留原范围与回退路径，正文检测和通用 contentFilter 没有为了界面覆盖而放宽。共用显示、恢复及过期响应修复同样适用于识文。

Ziggit 根据已有真实 DOM 与 fixture，Full Page 放开普通帖子操作区域，保留布局容器、屏幕阅读器文案及重复选择层保护。Threads 仍遵循此前明确要求的帖子/回复正文适配。本轮没有移除其他网站的全部 hard-skip，也没有推断未经观察的网站 DOM。

## 自动化与构建

- `pnpm test:content`：10 文件 / **386 项通过**，包括新增通用界面 full/smart 对照、Ziggit full fixture。
- `pnpm verify`：类型检查通过，139 文件 / **1,301 项通过**。
- `corepack pnpm build`：Chrome 构建成功，产物 `.output/chrome-mv3`。
- 新增动态回归覆盖连接中的文字更新、子树替换、分批或同批节点回收复用，以及过期双语错误、仅译文宿主属性变化、控件标签、输入保护和样式恢复。

## 浏览器与真实服务

使用维护者指定的 `corepack pnpm dev` 打开的独立 Chrome，加载 `.output/chrome-mv3-dev`。原生工具无法区分同名进程，沿用维护者已明确授权的 Playwright/CDP 连接方式，只连接开发实例的本机端口 9223，没有操作日常 Chrome 发布版或继续竞品对照。

开发扩展 ID：`lbcchhmdaojgfbdbfbefjljcijoodimf`。设置页实际通过工作区 Vite 开发服务器加载，翻译使用真实微软、Google 服务，没有 mock 响应。Google 本轮单条探测已恢复，不能把 10 月 20 日的 429 当成本轮状态，也不表示此服务以后不会限流。

### 受控交互、布局与动态验证

样例：[full-page-acceptance.html](../../tests/manual/full-page-acceptance.html)。页面先注册真实点击、提交事件和原节点引用，再从扩展工具栏触发翻译。

- 微软双语：菜单与 details 在展开后进入翻译，按钮鼠标/Enter 各一次、表单提交一次、链接默认锚点跳转均通过；原节点及编辑后的输入状态保留。
- 微软和 Google 仅译文：同样的交互、输入、代码保护通过；没有泄露结构标记。段落更新、移出 DOM 后改内容并复用原节点，均生成新译文；恢复保留新源文，不回写旧段落。
- 双语摘要：桌面原文、译文各 54px（两行），容器 108px；390px 测试视窗内依旧各两行，document clientWidth/scrollWidth 一致，无横向溢出。恢复后原文结构与两行截断恢复，source wrapper 清除。
- 微软、Google 实际用词仍可能有歧义，例如 Home 或 Save changes；本阶段改动不把“出现中文”当成服务措辞质量保证。

证据：[双语交互](./assets/fullpage-phase1-20261022/bilingual-fixture.json)、[桌面](./assets/fullpage-phase1-20261022/bilingual-desktop.png)、[窄屏](./assets/fullpage-phase1-20261022/bilingual-mobile.png)、[Google 仅译文](./assets/fullpage-phase1-20261022/google-single-fixture.json)、[微软仅译文](./assets/fullpage-phase1-20261022/microsoft-single-fixture.json)。重复检查可能命中本地缓存，network 数组不代表每个目标都重新请求了一次。

### 真实主页与正文

使用 [Lil’Log 主页](https://lilianweng.github.io/)、[Scaling Laws 正文](https://lilianweng.github.io/posts/2026-06-24-scaling-laws/)、[Ziggit 主页](https://ziggit.dev/)及[原讨论正文](https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822)。每个组合等待后台处理状态稳定，单次 loading=0 不作完成依据。

微软两站四页 × 两种展示模式共八组，以及 Google 文章仅译文补验均通过当前样本检查，全部在稳定窗口结束时为 0 加载 / 0 失败，没有点击人工重试。

| 页面与证据 | 服务 | 展示 | 处理标记数 | 加载 / 失败 | 仍连接原链接 / 初始链接 |
| --- | --- | --- | --- | --- | --- |
| [博客主页](./assets/fullpage-phase1-20261022/microsoft-bilingual-blog-home.json) | 微软 | 双语 | 42 | 0 / 0 | 16 / 16 |
| [博客正文](./assets/fullpage-phase1-20261022/microsoft-bilingual-blog-article.json) | 微软 | 双语 | 205 | 0 / 0 | 58 / 58 |
| [论坛主页](./assets/fullpage-phase1-20261022/microsoft-bilingual-forum-home.json) | 微软 | 双语 | 167 | 0 / 0 | 294 / 294 |
| [论坛正文](./assets/fullpage-phase1-20261022/microsoft-bilingual-forum-topic.json) | 微软 | 双语 | 42 | 0 / 0 | 38 / 41 |
| [博客主页](./assets/fullpage-phase1-20261022/microsoft-single-blog-home.json) | 微软 | 仅译文 | 42 | 0 / 0 | 16 / 16 |
| [博客正文](./assets/fullpage-phase1-20261022/microsoft-single-blog-article.json) | 微软 | 仅译文 | 199 | 0 / 0 | 58 / 58 |
| [论坛主页](./assets/fullpage-phase1-20261022/microsoft-single-forum-home.json) | 微软 | 仅译文 | 168 | 0 / 0 | 294 / 294 |
| [论坛正文](./assets/fullpage-phase1-20261022/microsoft-single-forum-topic.json) | 微软 | 仅译文 | 45 | 0 / 0 | 41 / 41 |
| [博客正文](./assets/fullpage-phase1-20261022/google-single-blog-article.json) | Google | 仅译文 | 199 | 0 / 0 | 58 / 58 |

- 博客双语主页的实际 `.post-entry .entry-content` 摘要，原文与译文各 44.80px，容器 89.59px，译文底边在容器内；此前只在 DOM 中存在但被父容器裁掉的问题在此样本中已消除。主页自我介绍没有截断限制，不能拿它代替摘要卡片验收。
- 博客正文在微软两种模式、Google 仅译文期间均保留 58 个原链接及原 href；恢复后的完整链接文字与地址数组一致。微软、Google 仅译文都实际打开同一篇 arXiv 引用，URL 和标题确认成功。
- 论坛仅译文实际点击中文主题入口，进入原 href 指定的主题。论坛双语正文中三条链接及一个代码块随网站帖子回收离开显示树；仍连接的原链接和代码文字保持原样，没有把它们从数量变化中误判为被译文删除。
- 所有组合停止翻译后清除了加载/失败 UI 与 source wrapper。博客两页、论坛主页及论坛仅译文正文的完整链接恢复数组与基线一致；论坛双语正文因回收，完整数组不相等，按连接中的原节点单独核对，未覆盖网站的新状态。

截图：[博客双语主页](./assets/fullpage-phase1-20261022/microsoft-bilingual-blog-home.png)、[论坛双语主页](./assets/fullpage-phase1-20261022/microsoft-bilingual-forum-home.png)、[Google 仅译文正文](./assets/fullpage-phase1-20261022/google-single-blog-article.png)。同目录的 `*-restored.json` 保存每组恢复结果。


论坛会虚拟化回收帖子，不能用整页 pre 或链接数量必须始终相等来判断译文是否破坏结构。核对当前仍连接的原链接及 code 节点的地址/原文，同时记录原始、当前和已断开的节点数量；博客静态页面额外要求完整 href 数组、全部原节点及恢复文字一致。处理标记数也不是成功译文数或整页覆盖率。

收尾已确认所有测试页无翻译标记、加载、失败提示或 source wrapper。开发 Chrome 留在博客原文主页，工具栏为 Full Page，服务微软，展示双语，供维护者直接体验；见 [最终运行状态](./assets/fullpage-phase1-20261022/review-browser-state.json)。

## 实现身份与边界

最终源文件 SHA-256：

- `trans.ts`：`3339c1183d90f45af5b668af61b36a04edf12dc8054e25ef31c07365c242ddcb`
- `translationOnly.ts`：`c4582280b58d29913d3f8977e68be7faa43f78201ffc12f8a5a46f75d4453a24`
- `translationTarget/fullPage.ts`：`062d6719d26776c980de520dbf6dbcbcf5ac45da5c9740ca1b0ca8681a839923`
- `translationLayout.ts`：`e0387b7fd1c0fdb76d05b44077b25dfaa8e24c98acfdfbd07ffa196f5aa9ee2d`

第一阶段开发及本轮样本验收完成，待维护者体验。此结论不表示 Read Frog all 全能力已对齐。独立属性、标题、iframe、自动选择识文/全页和特殊文档仍按后续阶段处理。未提交、Push、合并 main 或发布。

## 2026-10-23：双语侧栏布局修正与真实页面复验

截图中的 Ziggit 侧栏把译文追加在 `li` 内、原链接外，成为额外的 Flex 项。实测原链接宽约 222px，译文仅剩约 28px；`display:inline` 不会改变其 Flex 项身份。

本次保持翻译目标集合和正文规则，只调整双语插入与局部样式：

- 紧凑标签沿唯一有效文字分支向内插入，译文与原文留在同一个标签和原链接内；图标、多个文字分支及计数不合并。
- Flex/Grid 直接文字在脱离文档的容器中包装后再挂载，保留原 Text 和控件身份；自身包装不触发 MutationObserver 重译，恢复时撤回容器与标记。
- 短译文使用无正文上下边距的行内盒，空间不足时整体换行；文字区域允许换行，外围 Flex/Grid 保持不变。
- Ziggit/Discourse 的 `.sidebar-row` 有固定行高。仅对已含双语标签的相应侧栏行放开高度，并保留原最小行高，避免两行文字超出点击区域。此规则不用于任意网站的所有按钮。

使用 `corepack pnpm dev` 启动的独立 Chrome，通过此前授权的 CDP 连接测试；服务为真实微软翻译，Full Page＋双语，没有替换或伪造服务响应。检查范围包含截图视觉复核、文字逐字位置、可见性、交互与恢复，不能以 DOM 中存在中文代替可读性。

| 页面 | 窗口宽度 | 核查结果 |
| --- | --- | --- |
| Ziggit 主页 | 1440 / 1100px | 13 个侧栏标签译文均在原链接/按钮内部；短译文未竖排，中文字形在文字区及点击行边界内，无文字裁切；图标横向位置、行宽、外层子项数与原文一致 |
| Ziggit 讨论详情 | 1440 / 1100px | 同上；长 `memory-management` 标签译文四字整体位于第二行，文字与点击行均约 44.8px 高 |
| Lil’Log 主页 | 1440 / 900px | 导航译文在原链接边界内，卡片原文和译文摘要均有可见区域；翻译未新增页头裁切或文档横向溢出 |
| Lil’Log 正文 | 1440 / 900px | 导航与正文截图复核，页头译文留在原链接边界内；翻译未扩大原站已有横向溢出 |

两张论坛页面均实际点击中文「主题」打开 `https://ziggit.dev/latest`；点击中文「更多」打开网站菜单，Escape 关闭。恢复后 13 个原标签的内部 HTML 与原文一致，双语标签标记、译文及原文包装残留均为零。

博客窄屏原站限制单独记录：900px 下 Logo 原文已经位于 x≈−48px；正文原文文档宽度约 1064px，翻译后相同。这些不能记作本次翻译新增的问题，也不能声称原站窄屏布局本身已修复。

最终自动化：`pnpm test:content` **389 项通过**；`pnpm verify` 类型检查及 **1,309 项通过**；`corepack pnpm build` 成功。新增回归包括侧栏内层挂载、原链接点击与完整恢复、直接 Flex/Grid 文字节点身份、节点移位保护、相同节点重新插入及真实 MutationObserver 对自身包装的处理。

证据目录：[本轮截图与几何数据](./assets/fullpage-layout-20261023/)。其中 `forum-topic.json`、`forum-home.json` 保存逐字位置、宽窄窗口基线、实际点击结果及恢复结果；博客 JSON 记录翻译前后文档溢出和页头链接边界。代表截图：[论坛详情](./assets/fullpage-layout-20261023/forum-topic-bilingual-1440.png)、[论坛主页窄窗口](./assets/fullpage-layout-20261023/forum-home-bilingual-1100.png)、[博客主页窄窗口](./assets/fullpage-layout-20261023/blog-home-bilingual-900.png)。仍在独立分支，未提交或 Push。
