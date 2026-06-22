# Content Detection Architecture

OnlyTranslate 的识文链路已经从早期平铺规则演进为 `translationTarget/` 分层。这个分层的目标不是堆更多站点特判，而是把通用正文识别、站点差异和翻译插入行为分开维护。

## Core Pipeline

当前 smart 识文主链路按几个小模块组织：

- `collect`：收集可能需要翻译的 DOM 候选。
- `decision`：结合通用过滤、站点规则、内容单元分类，决定候选是否进入翻译目标。
- `dynamic`：处理 MutationObserver 触发的动态补扫。
- `scanContext`：维护单轮扫描缓存、预算和统计信息。
- `types`：定义候选、决策、上下文、统计信息等共享结构。
- `unitizer`：把复杂块拆成更稳定的 DOM text units。

`resolveAutoTranslationTarget()` 负责创建每轮扫描的上下文，并在 smart、smart fallback、body fallback 之间降级。识文改动应优先保持这条降级链可用，避免单个规则误判导致整页不可翻。

## Generic Layer Boundary

通用识文层只表达站点无关的概念：

- 当前节点是否像可读正文。
- 当前节点是否明显是 UI、广告、推荐、分享、导航或登录订阅区域。
- 当前节点是否超过扫描预算。
- 当前节点是否需要展开成更细的 DOM text units。
- 当前节点是否需要合并或去重。

通用层不应直接认识具体站点，例如 `github.com`、`cnn.com`、`ziggit.dev`。如果某个站点的 DOM 结构需要特殊处理，应放进 `siteProfiles/`。

## Site Profiles

`siteProfiles/` 是站点差异的正式归属。新增站点行为时，优先考虑 profile，而不是修改通用规则。

常用扩展点：

- `select`：兼容老链路中的节点选择或跳过。
- `allowTarget`：在新识文决策链中强允许目标。
- `skipTarget`：在新识文决策链中强跳过目标。
- `appendTarget`：控制译文插入位置。
- `afterBilingualAppend`：处理译文插入后的站点布局修正。
- `supplemental`：补充站点级正文候选。
- `expandTarget`：把站点特有容器拆成多个翻译目标。
- `shouldKeepNestedTarget`：控制嵌套目标合并时哪些父子关系应保留。

`expandTarget` 只负责产生候选。返回的节点仍应走完整 `decideTranslationTarget` 路径，不能绕过通用过滤和 profile 自身规则。

原始候选不会在 `expandTarget` 阶段被主动移除。若容器和子节点都通过决策链，最终是否丢弃容器由 `mergeTranslationDecisions` 和 `shouldKeepNestedTarget` 决定。

## Compatibility Facade

`compat.ts` 目前保留为兼容 facade，用于承接旧调用方。它不应继续成为新增站点规则的入口。

边界原则：

- 新增站点差异放进 `siteProfiles/`。
- profile 映射由 `siteProfiles/index.ts` 生成。
- `compat.ts` 只保留旧名称导出或必要的过渡包装。
- 新增识文代码应通过 profile 或 profile helper 获取当前站点能力。

## Heavy Pages

Heavy 页面指 DOM 很大、UI/导航/推荐/广告/按钮多、正文占比小、并且页面会动态更新的页面。优化这类页面时，不应写站点专属快路径来替代通用能力。

通用策略：

- 每轮 `resolveAutoTranslationTarget()` 创建共享 `ScanContext`。
- 使用 `WeakMap` 缓存 normalized text、可见性、content filter、content unit 分类等重复计算。
- 优先评估正文候选，避免默认全页 `querySelectorAll('*')` 分类。
- 剪掉明显 UI/noise 子树，例如导航、表单、工具栏、菜单、广告、推荐、分享、登录、订阅区域。
- 用元素数量控制扫描预算，避免依赖耗时阈值造成测试不稳定。
- 动态补扫应合并 mutation root，跳过已翻译节点、译文节点和明显 UI 子树。

站点 profile 可以作为加速器，但不能成为 Heavy 页面优化的主路径。

## Translation Markers

翻译标记常量应从统一模块导入，避免多处重复定义：

- `TRANSLATED_ATTR`
- `TRANSLATED_ID_ATTR`
- `BILINGUAL_CONTENT_CLASS`
- `BILINGUAL_WRAPPER_CLASS`

新增判断已翻译节点、译文节点或双语 wrapper 时，应复用这些常量。

## Change Guidelines

识文规则属于高影响面改动。修改前应明确：

- 预期匹配路径。
- 影响哪些页面或 fixture。
- fallback 行为。
- 可能出现的误跳过或误纳入风险。

不要为了修一个站点问题直接放宽或收紧通用规则。若 DOM 行为明显站点特有，应写 profile，并用 fixture 固化。
