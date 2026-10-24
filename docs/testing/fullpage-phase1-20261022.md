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

## 2026-10-23：通用短文案与文字高度约束补充

维护者补充的 Wikimedia 截图暴露出上一轮范围不足：普通 DIV/SPAN 短标题仍走正文换行路径，遇到固定高度会覆盖后续介绍。本次保留原翻译目标集合，补通用展示逻辑：

- 不超过 24 字符、4 个词的单行短文案优先行内显示，普通 DIV/SPAN/标题同样适用。显式 br、保留换行的文字及独立段落/列表保持块级边界。
- 紧凑译文以普通空格分隔，行末可自然折行，避免原外边距与满宽译文叠加后超宽。
- 只沿附近单一文字分支调整小型文字容器：保留原最小高度，让 height/max-height 随译文流动。最多回溯六层；其他正文、媒体、编辑控件、滚动区域、绝对定位、页面布局边界和超过约十二行的留白区域会阻止向外扩张。
- 移除 Ziggit/Discourse 专用行高 CSS。通用逻辑覆盖固定高度的文字包装和 Flex 控件，保留外围 display。
- 恢复时保留网站后来更新的属性，准确还原扩展仍持有的样式；源快照排除这些自有样式，避免节点重新插入时被误判为新源内容。Chromium 下先同步 CSSOM 再移除空样式属性，保持源 HTML 一致。

自动化：`pnpm test:content` **391 项通过**；`pnpm verify` 类型检查及 **1,328 项通过**；Chrome 构建成功。新增普通卡片 fixture、短文案边界、高度调整范围、样式恢复及含嵌套样式的动态节点回归。

几何验证使用开发 Chrome 中的本地结构样本及确定性译文，窗口宽度 1200/480px：长标题从 24px 增至 120px，后续介绍在标题之后；固定行高 Flex 控件随换行增高，译文未越界，页面未新增横向溢出。实际点击译文保留原链接事件；恢复后原始 HTML、链接和 Text 节点均一致。数据与源码哈希见 [通用文字流回归](./assets/fullpage-layout-20261023/generic-text-flow.json)，[窄窗口截图](./assets/fullpage-layout-20261023/generic-text-flow-480.png)。此项是本地代码与排版回归，不计作新的竞品或真实服务同页测试。

## 2026-10-23：单一内部控件的提示译文挂载

读取开发 Chrome 中 Ziggit 更新提示的实际 DOM，确认结构为绝对定位的 `.show-more` 外壳、带蓝色背景和点击事件的内部 `a`、文字 `span`。原挂载把较长的 “See 3 new or updated topics” 当作普通块文案，译文追加到外壳，因而落在蓝色控件外。

修正只涉及通用双语挂载：不再用短文案阈值决定是否寻找内部控件。原文沿唯一有效文字分支全部属于一个内部链接/按钮时，先进入该控件，再复用原有标签挂载和紧凑排版。多个文字分支、显式换行、受保护内容和无内部控件的普通正文保持原路径。翻译目标集合、站点规则和绝对定位均不修改。

新增实际提示结构及无站点类名的普通按钮 fixture，并覆盖译文点击、控件移除、迟到响应、原 Text/控件身份及恢复。原有纯链接标题回归改为要求译文同属原链接，恢复后链接 HTML 不变。`pnpm test:content` **395 项通过**；`pnpm verify` 类型检查和 **1,340 项通过**；Chrome 构建成功。

浏览器检查使用 `corepack pnpm dev` 的测试 Chrome，在隔离扩展页中加载最新翻译模块和提取的结构样本，调用真实微软翻译，禁用该隔离模块的内存缓存开关，不写入用户配置、不模拟服务响应。1200/360px 下蓝色控件均为 208×55px，译文边界在控件内；普通按钮窄屏换行增高，无文档横向溢出。两处中文实际触发原点击监听；移除内部控件后无游离译文，恢复不复活已删除控件。恢复比较忽略原有清理逻辑留下的空 `class` 属性，内容、样式、原控件和 Text 身份一致，自有标记清零。

证据：[几何与交互数据](./assets/fullpage-layout-20261023/single-control-notification.json)、[360px 截图](./assets/fullpage-layout-20261023/single-control-notification-360.png)。这是实际结构样本上的真实服务排版回归，不计作新一轮完整网站或竞品同页对照。独立分支修改尚未提交或 Push。

## 2026-10-23：IBM 导航与复合卡片真实页面回归

在 `corepack pnpm dev` 的 Chrome 中重新加载 IBM 美国主页，复现维护者的两处问题。导航是开放 Shadow DOM 内的 Flex 链接，原站 `white-space:nowrap` 被自有标签的通用换行规则覆盖，连英文也被挤散；案例卡片则由 Logo、标题区和独立指标区组成，内部区域有固定高度，外层纵向 Flex 裁切溢出。原来的单一文字分支策略无法穿过 Logo 和多个文字区。

本次通用修正不增加 IBM 域名、类名或站点检测规则：

- 保留标签原有的 `nowrap`，让原站继续按完整单行文案计算控件宽度；恢复时撤回该内联约束。
- 最多向上六层，在单个链接内部寻找正常文档流中的纵向裁切 Flex 卡片。只让通往译文的内部区域随内容增高；外层补 `min-height:min-content`，保留原来的百分比高度、等高布局、圆角裁切和 display。滚动区、定位叠层、编辑控件和页面布局边界不放开。
- 同一卡片的多段译文共享容器样式记录，最后一段恢复后才撤回共用约束，避免独立恢复时遗留样式或提前裁切其他译文；网站之后自行修改的样式继续保留。

IBM 真页使用微软翻译＋Full Page＋双语，未替换服务响应。1440、1100、900、390px 逐字检查译文和导航原文边界，未新增文档横向溢出；桌面三处菜单文字都在原控件内，390px 使用原站移动导航。四张案例卡片的标题译文均在标题区、底部译文均在指标区，两区不重叠。前三种宽度的卡片继续等高；移动端按原站单列布局自然增高。

实际点击中文「软件」打开菜单，再点击关闭；通过案例中文标题打开新标签，地址与原链接的 Scuderia Ferrari 案例地址一致。恢复后自有译文、标签、包装和直接文字目标残留为零，卡片链接及 Logo 保留，调整的高度重要样式清零。响应式切换会使 IBM 自行重建导航，因此恢复按当前连接的原链接和 Text 核对，二者保持身份；不把旧节点的断开误判为扩展重建。

新增通用复合卡片 fixture、Shadow DOM 单行标签、独立分区和共享样式恢复、滚动/定位/编辑区边界回归。`pnpm test:content` **397 项通过**；`pnpm verify` 类型检查及 **1,349 项通过**；Chrome 构建成功。

证据：[几何与交互记录](./assets/fullpage-layout-20261023/ibm-layout.json)、[顶部导航](./assets/fullpage-layout-20261023/ibm-header-1440.png)、[1440px 卡片](./assets/fullpage-layout-20261023/ibm-cards-1440.png)、[900px 卡片](./assets/fullpage-layout-20261023/ibm-cards-900.png)。检查结束后 IBM 页已恢复原文。独立分支修改尚未提交或 Push。

## 2026-10-23：补齐 IBM 六项菜单覆盖与插槽备用文本

上一轮只核对了三个 `part="trigger"` 菜单的布局，没有覆盖 Consulting、Think 和 Developer Tools，不能据此认定菜单已完整翻译。这三项来自开放 Shadow DOM 的 `<slot>` 备用文本：真实浏览器中 `assignedNodes({flatten:true})` 在没有投影时也返回备用节点，旧判断因此把正在显示的文字误判为已被投影替代。

本次用未展平的实际分配节点判断备用内容是否隐藏。有投影时仍跳过备用内容，无投影时正常收集；保留识文范围和不可见内容排除。补齐选区后还发现提取函数会把 Lit 的 Comment 节点当成文字提交服务，因此两个文本提取入口均排除 Comment，但保留原框架注释节点。不增加 IBM 专用规则。

新增六项菜单结构 fixture，并分别放入三个独立 ShadowRoot 复现备用插槽；测试补齐 Chromium 的 flatten 语义，核对六项各请求一次、没有框架注释混入、六个原链接点击事件及完整恢复。投影切换回归同时核对 full/smart：真实投影与备用内容不同时收集。另补注释提取与原节点保留测试。

WXT 开发 Chrome、IBM 真页、微软翻译＋Full Page＋双语复验：

- 1440px 逐项核对 Software、Infrastructure、Consulting、Support、Think、Developer Tools，六项都有干净译文，字形保持在原控件内。
- 1100/900px 双语文案较宽，使用原站左右翻页机制；实际点击原生箭头后，Developer Tools 的「开发者工具」能完整进入导航视野。原生箭头的 `aria-hidden` 并不代表其视觉隐藏状态，测试按容器实际显示与点击结果核对。
- 点击「软件」打开并关闭原菜单；点击「咨询」在新标签打开原 Consulting 链接，地址正确；原案例中文标题仍可打开对应案例页。
- 390px 使用原站移动头部；本次没有展开移动菜单来做六项内容覆盖承诺。四种宽度均复核已有卡片分区边界和文档横向溢出，未回归上轮卡片修复。
- 恢复后译文、标签和直接文字包装残留为零，当前原菜单及 Text、卡片链接和 Logo 保留，调整的高度重要样式清零；不要求响应式切换中由 IBM 重建的旧导航节点继续连接。

`pnpm test:content` **399 项通过**；`pnpm verify` 类型检查和 **1,352 项通过**；Chrome 构建成功。证据：[六项菜单及交互数据](./assets/fullpage-layout-20261023/ibm-menu-coverage.json)、[六项完整菜单](./assets/fullpage-layout-20261023/ibm-menu-complete-1440.png)、[窄屏末项翻页](./assets/fullpage-layout-20261023/ibm-menu-overflow-1100.png)。页面已恢复原文，修改尚未提交或 Push。
