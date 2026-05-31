# 识文与翻译执行架构整理设计

## 背景

OnlyTranslate 的 v0.5 系列已经引入 `translationTarget/` 分层，识文链路从早期的平铺规则演进为 `collect -> decision -> types`。这让 fixture 驱动回归测试有了稳定入口，也让 Heavy 页面优化可以通过 `ScanContext`、预算和缓存落地。

当前主要风险不再是某一条规则缺失，而是规则归属开始变模糊：

- 通用识文管道里出现站点域名特判，例如 GitHub Markdown list 拆分逻辑。
- `compat.ts` 和 `siteProfiles/` 同时暴露站点适配能力，入口边界不够清楚。
- 翻译标记常量在多个模块重复定义。
- `dom.ts`、`trans.ts` 中存在较多 `any`、隐式全局依赖和模块级可变状态。
- 部分通用启发式规则过激，容易造成误跳过或误纳入。

这次改造的目标是整体修复边界，而不是继续补规则。

## 目标

1. 让 `siteProfiles/` 成为站点适配的唯一正式归属。
2. 让通用识文层只表达站点无关的概念：正文候选、UI/noise 剪枝、内容单元分类、扫描预算、fallback。
3. 去除通用识文管道中的具体站点域名判断。
4. 统一翻译标记常量，减少重复声明和维护分叉。
5. 提升 `dom.ts`、`trans.ts` 的类型约束和状态可追踪性。
6. 修复已经明确的性能和误判风险，包括嵌套节点过滤、用户名识别、无条件 HTML beautify。

## 非目标

- 不重写翻译 API、翻译队列或服务选择逻辑。
- 不改变用户可见交互流程。
- 不一次性大拆 `content.ts`。入口文件会保留现状，除非实现中必须触碰。
- 不删除 `compat.ts`。它会先降级为兼容 facade，避免一次性破坏调用链。
- 不把所有启发式规则重写为新系统。本次只收口边界和修复明确风险。

## 架构原则

### 通用层不认识具体站点

`translationTarget/collect.ts`、`decision.ts`、`contentFilter.ts`、`contentUnitClassifier.ts`、`scanContext.ts` 不应直接判断 `github.com`、`cnn.com`、`ziggit.dev` 等站点域名。

通用层可以知道这些抽象：

- 当前节点是否像可读正文。
- 当前节点是否明显是 UI、广告、推荐、分享、导航。
- 当前节点是否超过扫描预算。
- 当前节点是否需要展开成更细的 DOM text units。
- 当前节点是否需要合并或去重。

通用层不能知道这些事实：

- GitHub 的 `.markdown-body` list 需要按 `li` 拆。
- Asterisk 的 footnote append 需要特殊处理。
- Discourse/Ziggit 的 topic list title 和 excerpt 结构。
- CNN-like 页面有哪些站点专属容器。

### Profile 承载站点差异

`SiteProfile` 是站点差异的正式扩展点。站点可以声明：

- `select`：老链路中的节点选择或跳过。
- `allowTarget` / `skipTarget`：新识文决策链中的强允许或强跳过。
- `appendTarget` / `afterBilingualAppend`：译文插入位置和插入后的布局修正。
- `supplemental`：站点级补充正文候选。
- 新增 unit expansion / merge hook：站点级目标拆分和合并策略。

`compat.ts` 暂时继续导出旧名称，但只从 `siteProfiles` 生成映射，作为过渡层。

`compat.ts` 的过渡边界如下：

- `siteProfiles/index.ts` 负责生成 `siteProfileSelectFns`、`siteProfileReplaceFns`、`siteProfileSupplementalFns`、`siteProfileAfterBilingualAppendFns`，后续新增的 profile hook 映射也在这里生成。
- `compat.ts` 只导入这些映射并按旧名称导出，不在内部重新组装站点 map。
- `getMainDomain` 暂时继续留在 `compat.ts`，作为调用链兼容的 URL 归一化工具；后续若拆到独立 URL util，必须单独做小步迁移。
- `dom.ts` 对 `selectCompatFn` 的调用、`trans.ts` 对 `replaceCompatFn` 和 `afterBilingualAppendCompatFn` 的调用，在本次改造中先继续走 facade，避免把站点规则迁移和执行链路迁移混在一起。
- 新增识文代码不再直接依赖 `compat.ts` 的 map，而是通过 `siteProfiles` 或 profile helper 获取当前站点能力。

### 翻译执行层保持行为稳定

`trans.ts` 和 `dom.ts` 的整理优先做不改变行为的工作：

- 明确类型。
- 统一常量。
- 显式依赖。
- 状态收纳。
- 性能修复。

不在这次把翻译执行改造成完整状态机。

## 设计方案

### 1. SiteProfile hook 扩展

给 `SiteProfile` 增加两个站点级 hook：

```ts
type SiteProfileExpandTarget = (
  node: Element,
  context: TranslationTargetContext
) => Element[] | false | undefined;

type SiteProfileShouldKeepNestedTarget = (
  parent: Element,
  child: Element,
  context: TranslationTargetContext
) => boolean;
```

用途：

- `expandTarget`：把一个站点特有的容器拆成多个翻译目标。GitHub README list 可以把 `ul/ol` 拆成 `li`。
- `shouldKeepNestedTarget`：合并去重时允许站点保留某些父子目标关系。GitHub Markdown list item 可以保留，list container 可以被丢弃。

集成点：

- `collectTranslationCandidates` 先按现有顺序收集 `grab-node`、`site-profile`、`supplemental` 等原始候选。
- 原始候选进入 `decideTranslationTarget` 之前，调用当前 profile 的 `expandTarget(candidate.node, context)`。
- `expandTarget` 返回的节点作为新的 `dom-unit` source 候选加入候选池，并经过完整 `decideTranslationTarget` 路径。
- `expandTarget` 阶段只负责产生候选，不调用 `skipTarget`、`allowTarget` 或通用 content filter；返回节点在 `decideTranslationTarget` 中只按正常顺序执行一次 profile `skipTarget`。
- 如果 `expandTarget` 返回空值或 `false`，原始候选照常进入决策链。
- `mergeTranslationDecisions` 中的嵌套去重调用 `shouldKeepNestedTarget(parent, child, context)`。当 hook 返回 `true` 时，child 不会因为 parent 包含它而被删除；如果 parent 只是该 nested target 的容器，parent 会被去掉，避免同时翻译 list container 和 list item。

对应现有 GitHub 逻辑的迁移关系：

- 当前 `collectDomUnitTargets` 中产生 GitHub Markdown list item 的职责迁移到 `expandTarget`。
- 当前 `mergeTranslationDecisions` 中保留 list item、丢弃 list container 的职责迁移到 `shouldKeepNestedTarget`。
- 通用 `collect.ts` 只调用 profile hook，不再出现 GitHub 函数或 GitHub 域名判断。

### 2. GitHub 逻辑迁回 profile

把这些逻辑从 `collect.ts` 移到 `siteProfiles/github.ts`：

- `getGitHubMarkdownListItems`
- `isGitHubMarkdownListContainer`
- `isGitHubMarkdownListItemOf`
- GitHub Markdown roots 的 DOM unit 收集入口

GitHub profile 负责：

- README / Markdown body 的段落和列表拆分。
- PR comment markdown block 的目标拆分。
- Issue / PR list title 的保留。
- Repository chrome、metadata、label、filename 的跳过。

### 3. 通用文档识别保留但降风险

`markdown`、`readme`、`docs` 作为通用正向信号可以保留，因为它们不是 GitHub 专属。需要补测试保证：

- 非 GitHub 文档页仍能识别正文。
- 带 GitHub 链接的技术正文不会被 share/social 噪声误跳过。
- GitHub 链接不再在通用 `SHARE_PATTERN` / `SOCIAL_LINK_PATTERN` 中作为社交噪声强信号。

### 4. 共享翻译标记常量

新增共享常量模块，例如：

```ts
export const TRANSLATED_ATTR = 'data-fr-translated';
export const TRANSLATED_ID_ATTR = 'data-fr-node-id';
export const BILINGUAL_CONTENT_CLASS = 'only-translate-bilingual-content';
export const BILINGUAL_WRAPPER_CLASS = 'only-translate-bilingual';
```

替换 `trans.ts`、`decision.ts`、`dynamic.ts` 中的重复声明。

### 5. DOM 工具类型收紧

优先改高频入口：

- `grabNode(node: Node, options?: GrabAllNodeOptions): Element | false`
- `handleBilingualTranslation(node: HTMLElement, slide: boolean)`
- `handleSingleTranslation(node: HTMLElement, slide: boolean)`
- `bilingualTranslate(node: HTMLElement, nodeOuterHTML: string)`
- `singleTranslate(node: HTMLElement)`
- `handleBtnTranslation(node: HTMLElement)`
- `bilingualAppendChild(node: HTMLElement, text: string | Node)`

配套增加小型类型守卫：

- `isElementNode(node): node is Element`
- `isHTMLElementNode(node): node is HTMLElement`
- `isTextNode(node): node is Text`

### 6. 隐式依赖显式化

`trans.ts` 中的 `storage.setItem` 改为显式 import。若项目已有 WXT storage 全局类型，也不再依赖隐式运行时全局。

`dom.ts` 中的 `handleFirstLineText` 不再直接调用 `browser.runtime.sendMessage`。处理方式：

- `dom.ts` 只负责发现“首个可翻译文本节点”，并通过可选回调把 `Text` 节点和原文交给调用方。
- `GrabAllNodeOptions` 增加一个可选回调，例如 `translateFirstLineText?: (textNode: Text, text: string) => void`。
- `trans.ts` 在需要保留该行为的路径中注入回调，由执行层调用 `translateText` 或现有消息通道完成翻译。
- 没有传入回调时，`dom.ts` 不触发 IPC，只返回原有可翻译目标判断结果，避免工具层越层依赖浏览器运行时。

### 7. 模块级状态收纳

把 `trans.ts` 里的模块级变量收纳成一个对象：

```ts
const translationState = {
  hoverTimer: undefined,
  htmlSet: new Set<string>(),
  originalContents: new Map<string, string>(),
  isAutoTranslating: false,
  observer: null,
  mutationObserver: null,
  nodeIdCounter: 0
};
```

保留 `originalContents` 的现有导出兼容，必要时导出引用：

```ts
export const originalContents = translationState.originalContents;
```

这样先改善状态集中度，不改变生命周期。

### 8. 性能修复

`removeNestedTranslateNodes` 从 O(n²) 改为按 DOM 深度排序后过滤：

1. 先按从浅到深排序。
2. 逐个检查最近已保留祖先。
3. 子节点若已被保留祖先包含则跳过。

规模仍然不会比当前更差，Heavy 页面上可避免 `nodes.some(other => node.contains(other))` 的平方级成本。

`beautyHTML` 只在 HTML 翻译路径执行。纯文本翻译和按钮翻译不跑 `js-beautify`。

### 9. 用户名识别收紧

`isUserIdentifier` 不再把任意短英文数字下划线组合都判为用户名。

保留明确格式：

- `@username`
- `u/username`
- x.com / twitter.com status ID
- 明确带 follow/click 语义的短文本

移除或降级这一类泛化判断：

```ts
/^(?=[A-Za-z0-9_]*[0-9_])[A-Za-z0-9_]{1,15}$/
```

新增回归样本确认 `web3`、`step_2`、`act_1` 不会被误跳过。

## 实施顺序

### 阶段一：规则边界收口

- 扩展 `SiteProfile` hook。
- 迁移 GitHub Markdown 拆分逻辑。
- 移除通用管道里的 GitHub 域名判断。
- 调整通用 share/social 噪声，不再把 GitHub 链接当强社交噪声。
- 跑 `pnpm test:content`。

### 阶段二：常量、类型、依赖

- 新增共享常量模块。
- 替换重复常量声明。
- 收紧 `dom.ts`、`trans.ts` 中高频 `any`。
- 显式 import storage。
- 把 `handleFirstLineText` 的翻译 IPC 从 `dom.ts` 移到 `trans.ts` 层，通过 `GrabAllNodeOptions` 回调注入。
- 保持 `dom.ts` 的 `selectCompatFn`、`trans.ts` 的 `replaceCompatFn` / `afterBilingualAppendCompatFn` 调用继续走 `compat.ts` facade，不在阶段二迁移这些调用方。
- 跑类型检查和相关单测。

### 阶段三：性能和误判修复

- 优化嵌套节点过滤。
- 收紧用户名识别。
- 限制 `beautyHTML` 执行路径。
- 新增对应单测。

### 阶段四：翻译状态收纳

- 引入 `translationState` 对象。
- 保持原导出兼容。
- 确认恢复原文、动态翻译、手动按钮翻译行为不变。

## 测试计划

必须通过：

```bash
pnpm test:content
pnpm verify
```

需要新增或更新的测试：

- GitHub README list 仍按 `li` 拆分。
- GitHub PR comment markdown block 仍按段落/list item 插入译文。
- 通用 `collect.ts` 不再包含 GitHub 域名特判。
- 非 GitHub markdown/docs 页面仍能识别正文。
- 带 GitHub 链接的技术正文不会因为 share/social filter 被跳过。
- `web3`、`step_2`、`act_1` 不会被 `isUserIdentifier` 判为纯用户名。
- Heavy 页面 `classifiedElements <= 2500` 继续成立。
- contentRoot 外批量 UI mutation 不产生翻译目标。
- contentRoot 内新增可读段落仍能动态补扫识别。

## 风险与回退

- GitHub README / PR comment 是高风险区域。迁移时必须保留现有 fixture，先测试失败再迁移。
- `SiteProfile` hook 扩展会影响多个站点 profile 的类型定义。实现时应保持 hook 可选，默认行为不变。
- `looksLikeSupplementalWrapper` 里 `[class*="card"]` 这类宽泛类名匹配可能在站点迁移后暴露新的 false positive。它不是本次主动重写对象；如果 GitHub 迁移或 Heavy fixture 暴露误命中，只做局部收紧并补 fixture。
- 类型收紧可能暴露旧代码中的真实空值问题。优先用类型守卫修复，不用强制断言压过去。
- 状态收纳可能影响恢复原文和动态翻译。该阶段放在最后，并保持现有导出兼容。

如果阶段一出现大范围回归，可以只保留 hook 扩展，把 GitHub 迁移拆成单独提交回滚。

## 完成标准

- 通用识文管道不再出现具体站点域名判断。
- GitHub、Asterisk、Ziggit、Heavy fixture 全部通过。
- `pnpm test:content` 和 `pnpm verify` 通过。
- 翻译标记常量只有一个正式来源。
- `dom.ts` / `trans.ts` 的主要公共函数不再使用 `node: any`。
- 已知误判 `web3`、`step_2`、`act_1` 得到测试覆盖。
