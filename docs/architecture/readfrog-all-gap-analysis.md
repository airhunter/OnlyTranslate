# Read Frog all 模式能力差异表

核对日期：2026-10-19  
OnlyTranslate 基线：`d8569f3` 的 Full Page  
Read Frog 基线：`fcb00beb21a9d674c0262346fbc422fbbf317c03` 的 `pageTranslation.page.range = all`  
状态：源码与文档核对完成；已有实机结果按发布版观察解读，按维护者要求停止追加测试

2026-10-20 收口说明：Chrome 中的 OnlyTranslate 已确认是发布版，具体安装版本未独立核实，不能将实机现象直接归于当前分支。博客/论坛 32 个模式组合已观察，Threads 不完整；结论、第一阶段范围与未来验收标准统一见 [收口方案](../testing/fullpage-mode-comparison-20261019.md)。本轮只整理文档，不改功能代码。

真实网站补充：已完成 [Lil’Log 与 Ziggit 的主页/正文双语配对观察](../testing/fullpage-real-comparison-20261019.md)。它确认外围文案和站点 UI 规则差异，也发现卡片摘要“DOM 有译文但不可见”不能算显示通过；不等于仅译文、Threads 或整张表已实机验收。

## 比较口径

本表比较网页文字覆盖、过滤、展示、动态处理和恢复，不比较翻译服务质量、价格、OCR、视频、划词或学习功能。Read Frog 的 all 是翻译范围，与 bilingual、translationOnly 展示模式独立；比较时必须使用相同展示模式、语言方向和相近服务类型。

“源码确认”表示已追踪相关入口与处理路径，不代表任意网站均可用；“部分支持”表示存在代码能力，但有模式、目标收集或服务条件；“待验证”表示不能仅凭所见源码断言实际页面覆盖。查看上游测试源码也不等于在本机运行过测试。

目标是对齐 Read Frog all 的可核实能力，保留明确的安全保护，并记录有意差异。不能把“all”解释为所有可见文字、所有属性、所有控件都无条件翻译，也不能只凭 helper 中存在属性名单就宣称整个页面的属性均能被翻译。[官方页面翻译说明][RF-D1] [官方翻译控制说明][RF-D2]

## 内容收集与范围

| 编号 | 能力 | Read Frog all | OnlyTranslate Full Page | 差异结论 |
| --- | --- | --- | --- | --- |
| A01 | 初始扫描根 | 页面控制器从 documentElement 发起遍历，避免把 html 本身当整段翻译，head 仍在默认排除中 [RF-1] [RF-2] [RF-3] | full 从 body 收集，遍历有针对正文的选择与排除 [OT-1] [OT-2] | 源码确认。body 外由脚本挂载的页面元素可能存在覆盖差异；不能只修改 root 而不保留 head 排除 |
| A02 | Header、Footer、Nav | all 不启用 mainContentIgnoreTags；默认这些标签会被遍历，仍受站点排除规则影响 [RF-2] [RF-3] | footer、含 nav 的 header、navigation 等角色在收集或决策层被跳过 [OT-2] [OT-3] | 源码确认的覆盖缺口。full 应取消正文模式的这类整块排除 |
| A03 | 按钮、菜单、标签页、select/option | BUTTON、SELECT 不在默认禁止遍历标签中；按钮与 OPTION 等有行内译文样式规则，站点规则仍可排除 [RF-3] [RF-4] | button、select、menuitem、tab、toolbar 等在通用链路被排除；决策还拒绝交互祖先 [OT-2] [OT-3] | 源码确认的覆盖缺口。须贯通收集、提取、展示和动态扫描；不能只放开 button 标签 |
| A04 | 侧栏、推荐、元数据 | all 不靠我们这套阅读内容分类作统一否决，仍有站点 selector、数字与文本过滤 [RF-2] [RF-5] | full 的 decision 仍调用 classifyContentUnit，UI、noise、metadata 高置信 skip 对 full 也生效 [OT-3] [OT-4] | 源码确认。full 不应默认把“不是阅读内容”当作拒绝理由；不能据此统一承诺用户名或推荐卡片必翻 |
| A05 | Threads 网站范围 | 内置 Threads 规则使用排除、保留文本 selector 和布局 CSS；不是我们这套只允许帖子正文的白名单。all 仍适用站点规则 [RF-6] | select、skipTarget 将 smart/full 都限制为识别到的帖子与回复，未知结构被拒绝 [OT-5] | 源码确认规则不同；哪些真实节点因此不同仍待同页核对。不能清空所有 profile，也不能保留整套正文白名单后声称 full 已对齐 |
| A06 | 块与连续行内文字分组 | 遍历标记块、行内、段落，按连续行内片段组织请求；存在巨型段落拆分 [RF-1] [RF-7] | 已有 grabNode、正文块、direct-text run、换行目标和候选合并 [OT-1] [OT-2] | 两边均有基础，不能称我们没有分组。需补交互区域的分组样本，而不是重写所有正文分段 |
| A07 | HTML 内的显示属性 | 支持 markup 的服务可走仅译文 HTML 请求，白名单含 title、alt、placeholder、label、部分 aria 属性，并保护其余属性；微软服务被禁止用于仅译文 [RF-5] [RF-8] [RF-9] [RF-14] [RF-17] | 某些路径发送 HTML，可能带入属性，但没有同等的统一白名单、身份标记与响应属性回填校验；双语主要提取文本 [OT-2] [OT-6] | 部分支持差异。应对齐“进入 HTML 翻译片段后的属性处理”；不能表述为 Read Frog 全页独立属性扫描已确认 |
| A08 | 无正文的独立 input、img 等属性 | INPUT、TEXTAREA、IMG 默认禁止遍历；请求准备还要求非空可翻正文。未在已核对主链路发现全页独立 attribute collector [RF-3] [RF-5] | input 等也被排除；没有独立收集全页 placeholder/alt/title 的路径 [OT-2] | 待验证，不能作为 Read Frog 已完整覆盖、我们必须照搬的缺口。属性 helper 的测试不证明独立控件端到端可达 |
| A09 | 标签页标题 document.title | 独立 translateTitle 开关及标题观察器，含请求版本、网站标题更新与恢复 [RF-7] | document.title 用于翻译上下文；未发现页面翻译会话中的标题翻译及恢复写入 [OT-6] | 源码确认的能力缺口。与元素的 title 属性是两件事 |

## 排除规则与短文本

| 编号 | 能力 | Read Frog all | OnlyTranslate Full Page | 差异结论 |
| --- | --- | --- | --- | --- |
| B01 | 短文案长度过滤 | 最小字符、单词数默认 0，可由配置或站点规则提高；仍过滤纯 @handle 等内容 [RF-10] [RF-D2] | decision 对少于 3 字符统一拒绝；部分抓取也有最短文本限制 [OT-2] [OT-3] | 源码确认。Go、OK 等短标签可能在我们这里提前丢失；不应把默认 0 误读为不再有任何过滤 |
| B02 | 已是目标语言的短文本 | 目标语言自动跳过需要至少 50 字符；更短文本不因该检测跳过，避免误判 [RF-13] | shouldTranslateText 直接通过 detectlang 比较，franc 的 minLength 为 0；没有相同短文本门槛 [OT-7] | 源码确认策略差异，具体短词结果待验证。full 覆盖短文案时要同时修正这条判断，不能只放开长度 |
| B03 | 纯数字与非正文符号 | 请求准备显式过滤纯数字；代码/数学原子可排除出正文资格判断 [RF-5] | 有 mainly numeric、JSON、代码与公式保护 [OT-2] | 两边有保护，规则不完全相同；保留现有保护并以样本对照，不需要为 all 删除所有非语言过滤 |
| B04 | translate=no 与 notranslate | translate=no 未作为遍历禁令；html/body 的 notranslate 有例外；嵌套 notranslate 属于不继续遍历但可随父级提取文字的路径 [RF-2] [RF-1] | 收集、文本边界、决策及内容分类多处将其作为硬排除 [OT-2] [OT-3] [OT-4] | 源码确认，但不能概括为 Read Frog 一律尊重或一律忽略。full 应单独设计对应策略，扩展 UI 与真实代码保护必须保留 |
| B05 | PRE 与纯文本网页 | PRE 默认排除，但 document.contentType 为 text/plain 且没有显式站点加禁时有例外 [RF-2] [RF-3] | pre 在统一排除标签内；未见相同 text/plain 文档例外 [OT-2] [OT-3] | 源码确认。应区分纯文本阅读页与 HTML 中的代码块 |
| B06 | 可编辑内容与输入值 | INPUT/TEXTAREA 默认不遍历，但所核对通用过滤未确认与我们的 isContentEditable 保护完全等价；HTML helper 允许 input button/reset/submit 的 value [RF-2] [RF-3] [RF-8] | 输入控件与 contenteditable 明确排除，当前不处理其显示值 [OT-2] [OT-3] | 保留我们的输入与编辑保护，不为逐字复制规则而降低安全基线。提交控件 value 同时是数据的情况须单独验证 |
| B07 | 隐藏区域和图标字体 | 排除 hidden、display:none、visibility:hidden、部分屏幕阅读专用类和图标字体，跟踪被阻止区域的重新显现 [RF-2] [RF-7] | 有 hidden、aria-hidden、CSS 可见性和动态补扫；full 的 UI 子树剪枝可能使显现后的菜单仍被拒绝 [OT-2] [OT-8] | 基础都有；补菜单/弹窗显现对照，不把隐藏预加载内容当必须立即翻译的目标 |

## 展示与生命周期

| 编号 | 能力 | Read Frog all | OnlyTranslate Full Page | 差异结论 |
| --- | --- | --- | --- | --- |
| C01 | 双语和仅译文 | 支持的服务下两种展示均适用 all；双语主要为 plain，仅译文为 html；微软服务明确禁止仅译文，界面拒绝形成该组合 [RF-4] [RF-5] [RF-9] [RF-17] | 已有双语与仅译文；Google/微软仅译文走原节点备份和文本显示，其他路径可能整体替换 HTML [OT-6] [OT-9] | 有基础但服务边界不同。实机双语用微软、仅译文改用双方支持的 Google，不能假定所有服务支持相同模式 |
| C02 | 保留原有交互节点 | 仅译文优先按结构对齐，改原 Text 节点与允许的属性；对齐失败保留原节点引用并用 wrapper 暂存/替换 [RF-9] | 安全仅译文路径保留原节点；其他路径仍可能 innerHTML/outerHTML 替换 [OT-6] [OT-9] | 已有部分能力，存在交互扩容风险。不能把原有正文 HTML 替换直接用于新增控件 |
| C03 | 恢复与迟到响应 | 原位写入保存原值，应用前校验 source snapshot 与会话，另有 wrapper 恢复；上游包含恢复测试 [RF-9] [RF-15] [RF-16] | 已有 sessionVersion、sourceHTML/text 检查、安全原节点恢复和条件恢复 [OT-6] [OT-9] | 两边均有保护；新增 Text/属性目标需复用或扩展，而不是宣布从零补恢复 |
| C04 | 可视区与后台请求 | IntersectionObserver 触发近视区段落，巨型目标会拆分，遍历分片并检查取消 [RF-1] [RF-7] | 首屏近视区优先，另有后台队列继续翻译已收集的非首屏节点 [OT-6] | 调度策略不同，不能说只有竞品支持首屏优先。保留我们的后台策略，验证 full 扩容后的成本与响应性 |
| C05 | 动态内容与范围 | MutationObserver 跟进新增、移除、characterData 与显隐属性，并区分扩展自身变更 [RF-7] | 同样有新增、文字更新、显隐补扫、去重与自身插入处理；dynamic 仍会拒绝 UI 子树 [OT-6] [OT-8] | 有基础但范围有缺口。初次和动态路径必须同时对齐，不可只修首屏 |
| C06 | 仅修改文字属性的动态更新 | 页面 observer 的 attributeFilter 是 style/class/hidden/aria-hidden；未确认会独立跟进 title/placeholder/aria-label 的单独修改 [RF-7] | 观察显隐等属性，没有显示属性的独立翻译维护 [OT-6] | 待验证，不应在对齐目标中额外承诺全属性实时跟进 |
| C07 | open Shadow DOM | 遍历与观察跨 open Shadow Root，维护孤立树的观察 [RF-1] [RF-7] | 已有 composed tree、根发现、样式与动态观察 [OT-1] [OT-6] [OT-8] | 两边均有，不重复建设；补交互、slot 和恢复样本。未核实任意 closed Shadow DOM 支持 |
| C08 | iframe 页面 | 后台枚举非顶层 frame 并注入 host；活动页面翻译可跟进新完成的 frame，受站点启用及注入权限等条件约束 [RF-11] | 主 content 入口未启用 allFrames；feature loader 只注入请求来源 frame，DOM 路径明确排除 iframe [OT-2] [OT-10] | 源码确认机制缺口。需核实启动、停止、恢复、语言配置与跨 frame 状态；不是直接读取父页面的 contentDocument |
| C09 | 结构自动选择 main/all | 范围 schema 只有 main/all；自动按网站或语言开始翻译属于另一个功能 [RF-12] [RF-D2] | 当前只有 smart/full，也没有网页结构自动选择范围 [OT-11] | 不是 Read Frog all 对齐缺口。用户提出的自动范围作为独立后续需求，不与本次基线混在一起 |

## 已确认差异与待验证事项

优先修正的源码差异是 A01–A05、B01–B02、B04–B05、C01–C03、C05；它们直接影响 full 能否覆盖普通页面区域，以及扩容后是否破坏交互。A09 的标签页标题、C08 的 iframe 是独立能力缺口，需要独立阶段和验收，不能直接从方案中删去后宣称已完整对齐。

A07 只确认 HTML 片段处理能力；A08、B06、C06 需要最小页面与实际服务验证。Read Frog 中有属性 helper 并不等于独立输入框、无文本图片、无正文按钮的属性已能端到端翻译。此前“Read Frog 支持全部占位提示，所以我们必须全局扫描所有属性”的推导不成立。

后续模式补测纠正了一个服务前提：Read Frog 的 `translation-only-gate.ts` 明确禁止微软服务与仅译文搭配，用户在 1.51.0 中也无法选择该组合；仅译文公平对照改为 Google，不能拿我们的微软仅译文当成竞品同服务结果。已观察到 Google 下 Read Frog 保留正文链接，而我们会把段落内的链接移入原文备份，须在第一阶段优先修正，详见 [模式补测记录](../testing/fullpage-mode-comparison-20261019.md)。

## 同页对照清单

四组本地通用结构的实测记录见 [Full Page 同页对照与第一阶段验收](../testing/fullpage-comparison-20261019.md)。Read Frog 商店版为 1.51.0，未证明与上述源码提交逐字对应。实测确认普通导航/按钮、表单静态文案、部分表头/分类/翻页和 summary 存在差异；侧栏与展开后的目录链接并非我们全部缺失。两边均翻译部分名字；两边在本轮双语表单样本均未翻原生 option 和 placeholder。不能把本地地址结果套用到原网站 profile。

以下保留完整验证计划；本轮只完成报告明确列出的双语结构样本，不把其他预期写成已通过：

| 样本 | 核对点 | 执行方式 |
| --- | --- | --- |
| 普通文章加 Header/Nav/Footer/Aside | 正文外文本、inline link、短导航是否命中 | 同一最小 HTML，分别执行 RF main/all 和 OT smart/full |
| 菜单、按钮、tab、select 与表格 | 收集范围、译文布局、节点身份、点击、焦点、选中值 | 双语与仅译文分别运行，先用确定性译文隔离服务因素，再用实际服务 |
| 独立 input/img 与带 title/aria 的正文链接 | 区分纯属性控件和已选中的 HTML 片段；记录服务是否保留属性 | 逐类输入原始 DOM，检查实际发出的请求和返回后的原元素，不能只调用 helper |
| Go、OK、On、纯数字、@handle、目标语言短词 | 最短长度、语言跳过与数字规则 | 固定语言对，记录被跳过原因和真实目标集合 |
| translate=no、html/body.notranslate、嵌套 notranslate | 比较层级差异和父级提取，排除扩展自身 UI | 独立结构分开测试，不用一个示例替代全部情况 |
| text/plain 与 HTML pre/code/math | 阅读页例外及代码保护 | 使用正确响应 Content-Type；不能用 HTML fixture 冒充 text/plain 文档 |
| 菜单展开、文字更新、属性独立更新、节点复用 | 动态覆盖、旧响应取消、自身译文循环与恢复 | 代码测试加真实扩展操作，不只检查初始收集 |
| Open Shadow Root 与同源/跨源/动态 iframe | 启用、暂停、恢复和状态同步，受限 frame 的反馈 | 真实浏览器与本地测试页；跨源、opaque sandbox 分别记录 |
| 已有 Threads 首页与详情、Partner Center 结构 | 原有正文回归和 full 范围差异 | 优先沿用真实 DOM 来源 fixture；不猜 class selector 的业务含义，补录当前页面后再验收 |

每个样本记录范围、展示模式、服务类型、输入文字、实际进入请求的目标、显示结果、排除原因和操作/恢复结果。存在用户或内置站点规则时一并记录。不能仅凭两个页面都出现译文就认定同等覆盖。

## 对修改方案的约束

1. full 分离正文专用排除，smart 维持现有行为；任何共用 helper 改动都必须带模式上下文，避免影响划词与即时翻译。
2. 保留服务、队列、缓存、正文分组、Shadow DOM 与会话取消基础，补全页缺口，不整套照搬上游。
3. 遵循用户选择的双语/仅译文展示。紧凑区域优先补行内布局，只有实测需要时再讨论例外，不新增统一强制替换策略。
4. HTML 属性保护对齐 A07，不默认扩张成独立全属性扫描；A08、B06、C06 用端到端证据再定范围。
5. iframe 和标签页标题分别实施验证；未完成时明确保留差异，不使用“已完全对齐”描述。
6. 结构自动选择在 full 验收后处理，不引入自动开页翻译、任意网站规则编辑器或其他未提出功能。

具体阶段与回归要求见 [页面翻译范围与全页翻译设计草案](./page-translation-redesign.md)。本轮只修改差异与方案文档，不修改运行代码、测试代码、依赖和配置。

## 证据索引

Read Frog 链接固定到本次核对提交；本仓库链接对应本报告的 OnlyTranslate 基线。上游提交更新后，应重新核对关键路径，不能自动把结论套到新版。

[RF-D1]: https://www.readfrog.app/en/docs/page-translation
[RF-D2]: https://www.readfrog.app/en/docs/page-translation/translation-control
[RF-1]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/dom/traversal.ts
[RF-2]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/dom/filter.ts
[RF-3]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/constants/dom-rules.ts
[RF-4]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/ui/translation-utils.ts
[RF-5]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/core/translation-request.ts
[RF-6]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/site-rules/built-in/rules.json
[RF-7]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/entrypoints/host.content/translation-control/page-translation.ts
[RF-8]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/dom/translation-html-attributes.ts
[RF-9]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/core/translation-modes.ts
[RF-10]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/filter-small-paragraph.ts
[RF-11]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/entrypoints/background/iframe-injection.ts
[RF-12]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/types/config/translate.ts
[RF-13]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/target-language-skip.ts
[RF-14]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/dom/__tests__/translation-html-attributes.test.ts
[RF-15]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/core/__tests__/translation-only-restore.test.ts
[RF-16]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/host/translate/dom/translation-text-swap.ts
[RF-17]: https://github.com/mengxi-ream/read-frog/blob/fcb00beb21a9d674c0262346fbc422fbbf317c03/src/utils/providers/translation-only-gate.ts
[OT-1]: ../../entrypoints/main/translationTarget/collect.ts
[OT-2]: ../../entrypoints/main/dom.ts
[OT-3]: ../../entrypoints/main/translationTarget/decision.ts
[OT-4]: ../../entrypoints/utils/contentUnitClassifier.ts
[OT-5]: ../../entrypoints/main/siteProfiles/threads.ts
[OT-6]: ../../entrypoints/main/trans.ts
[OT-7]: ../../entrypoints/utils/translationDirection.ts
[OT-8]: ../../entrypoints/main/translationTarget/dynamic.ts
[OT-9]: ../../entrypoints/main/translationOnly.ts
[OT-10]: ../../entrypoints/content.ts
[OT-11]: ../../entrypoints/utils/model.ts
