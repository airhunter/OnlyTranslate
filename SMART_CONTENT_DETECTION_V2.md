# 识文 v2 设计草案

## 背景

当前识文能力已经可以处理一批文章页，但一周使用后暴露出几个影响体验的问题：

- 标题、副标题经常没有进入翻译范围。
- 文档页、教程页里的内容卡片、流程图卡片、重点说明块可能漏翻。
- 论坛首页这类列表页容易把导航、分类、标签、统计信息也翻译出来，破坏布局。
- 用户需要频繁在「识文」和「全文」之间自行判断，体验不够顺。

典型样本：

- `https://decrypt.co/366408/openai-gpt-image-2-vs-google-nano-banana-2-review`
- `https://ziggit.dev/`
- `https://ynarwal.github.io/how-llms-work/`

## 目标

识文 v2 的目标不是“只翻正文段落”，而是：

> 自动翻译用户当前页面最可能需要阅读的内容，同时尽量不碰操作 UI 和布局骨架。

具体目标：

- 标题、副标题、导语应默认纳入。
- 正文段落、列表、引用、图片说明继续纳入。
- 内容卡片、流程说明卡片、重点提示块在像正文内容时应纳入。
- 论坛列表页只翻 topic 标题和摘要，不翻分类、标签、统计、导航和操作按钮。
- 论坛详情页翻 topic 标题、帖子正文、评论正文，跳过用户信息、时间、互动按钮、附件元信息。
- 尽量减少用户切到「全文」模式的必要性。

## 非目标

- 不把「识文」变成全文翻译。
- 不在通用规则里为单个网站硬编码。
- 不引入复杂的页面类型系统。
- 不一次性重写 `contentDetector`、`contentFilter`、`grabAllNode`。
- 不牺牲布局稳定性来换取更高覆盖率。

## 当前链路

当前智能翻译大致是：

1. `contentDetector.findMainContent()` 找主内容根。
2. `grabAllNode(root)` 用 TreeWalker 收集可翻译节点。
3. `contentFilter` 在 smart 模式下跳过分享、标签、CTA 等非正文模块。
4. `siteProfiles` 做站点或平台级 DOM 适配。

主要短板：

- `findMainContent()` 更偏向找正文容器，标题区和正文区是兄弟节点时容易漏。
- `contentFilter` 擅长跳过噪音，但不负责“补进”内容卡片。
- `grabAllNode()` 按元素形态收集文本，缺少“这个节点是不是阅读内容”的上下文分类。
- 论坛列表页和文章详情页的阅读内容形态不同，但目前缺少平台级结构表达。

## 设计方向

采用轻量分层，不做大重构：

```text
contentDetector
  找主阅读区域或页面内容壳

contentUnitClassifier
  在内容区域内识别阅读单元：标题、正文、卡片、论坛 topic、图片说明、UI 噪音

contentFilter
  继续负责通用噪音过滤：分享、标签、CTA、推荐、导航

siteProfiles
  负责明确平台语义：Discourse、GitHub、Reddit、YouTube 等

grabAllNode
  仍负责最终 TreeWalker 收集，但接收更明确的 allow / skip 决策
```

第一阶段可以不新增大目录，只新增一个轻量工具：

```text
entrypoints/utils/contentUnitClassifier.ts
```

它只做通用内容单元判断，不放具体站点选择器。

## 内容单元

建议先定义以下内容单元：

```ts
type ContentUnitKind =
  | 'title'
  | 'subtitle'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'caption'
  | 'content-card'
  | 'forum-topic'
  | 'forum-excerpt'
  | 'ui'
  | 'noise';
```

每个单元返回一个轻量决策：

```ts
type ContentUnitDecision =
  | { action: 'allow'; kind: ContentUnitKind }
  | { action: 'skip'; kind: ContentUnitKind; reason: string }
  | { action: 'neutral' };
```

这里的重点不是做复杂抽象，而是让规则有名字，测试能看懂为什么一个节点被选中或跳过。

## 通用规则

### 标题与副标题

应优先纳入：

- `h1`、主 `h2`
- article/main 内靠前的标题区
- 标题附近的 subtitle、dek、description、lead、summary
- `aria-level=1/2` 且文本长度像标题的元素

保护边界：

- 导航、菜单、按钮里的标题不纳入。
- 卡片列表里的每个小标题不直接提升到页面标题，只作为卡片或列表项处理。

### 内容卡片

应纳入的卡片特征：

- 有短标题 + 说明文本。
- 位于主内容区域内。
- 链接密度不高，或即使有链接也明显是内容引用。
- 包含多个并列步骤、流程、定义、重点说明。

典型例子：

- `how-llms-work` 右侧流程卡片。
- 文档中的 key insight、note、warning、definition card。

跳过边界：

- 卡片只包含按钮、价格、登录、订阅、分享。
- 卡片属于推荐文章、广告、作者推广。
- 卡片文本很短且主要是 tag/chip。

### 论坛列表

论坛列表页不应按文章页处理。

可翻译：

- topic 标题。
- topic 摘要或 excerpt。
- 站点欢迎说明，前提是它是正文式说明，不是菜单。

应跳过：

- 左侧导航。
- 顶部 tabs。
- 分类名、tag、badge。
- Replies、Views、Activity 等表头。
- 统计数字、时间、用户头像标题、登录注册按钮。

### 论坛详情

可翻译：

- topic 标题。
- 主帖正文。
- 评论正文。
- 正文内普通引用。

应跳过：

- 作者区、时间、楼层、likes。
- 回复、分享、收藏等操作按钮。
- 图片附件 metadata，例如文件名、尺寸、大小。
- 分类、tag。

## Discourse Profile

论坛结构优化优先从 Discourse 开始，因为 Ziggit 是 Discourse，且 Discourse DOM 语义比较稳定。

识别方式：

- `meta[name="generator"][content*="Discourse"]`
- 或页面存在 Discourse 稳定结构，如 `#main-outlet`、`.topic-list`、`#topic-title`、`.topic-body`

不要写死 `ziggit.dev`。

建议使用规则表，而不是 if/else 堆分支：

```ts
interface DiscourseRule {
  id: string;
  matches: () => boolean;
  allowSelectors: string[];
  skipSelectors: string[];
}
```

初始规则：

```ts
const discourseRules: DiscourseRule[] = [
  {
    id: 'topic',
    matches: () => has('#topic-title') && has('.topic-body, article[data-topic-id]'),
    allowSelectors: [
      '#topic-title h1',
      '.topic-body .cooked p',
      '.topic-body .post p',
      '.topic-body blockquote p'
    ],
    skipSelectors: [
      '.topic-meta-data',
      '.post-menu-area',
      '.post-controls',
      '.names',
      '.post-info',
      '.lightbox .meta',
      '.filename',
      '.informations',
      '.discourse-tags',
      '.badge-category'
    ]
  },
  {
    id: 'list',
    matches: () => has('.topic-list'),
    allowSelectors: [
      '.custom-homepage-banner',
      '.discovery-list-container .topic-list .raw-topic-link',
      '.topic-list .raw-topic-link',
      '.topic-excerpt'
    ],
    skipSelectors: [
      '.sidebar-section',
      '.sidebar-wrapper',
      '.navigation-container',
      '.nav-pills',
      '.topic-list th',
      '.badge-wrapper',
      '.discourse-tags',
      '.posters',
      '.replies',
      '.views',
      '.activity',
      '.num',
      '.age'
    ]
  }
];
```

实际实现时 selector 要以真实 DOM 和测试为准，不要一次写太多。

## 与现有模块的关系

### contentDetector

短期只做必要补充：

- 继续负责找主内容根。
- 不承担论坛列表页细节。
- 不为了单个站点放宽全局 promotion 规则。

### contentFilter

继续负责通用跳过：

- 分享、社交。
- 标签、话题聚合。
- CTA、订阅、广告。
- 推荐阅读。

可以补充少量通用 UI 噪音，但要先讨论方案。

### siteProfiles

负责平台规则：

- Discourse 论坛结构。
- GitHub 仓库 UI。
- Reddit 帖子结构。

平台规则可以使用 allow/skip selector，因为它们对应明确 DOM 语义。

### grabAllNode

暂时不重写 TreeWalker。

可以扩展 options：

```ts
interface GrabAllNodeOptions {
  contentFilter?: (element: Element) => ContentFilterDecision;
  shouldSkipSubtree?: (element: Element) => boolean;
  siteCompatMode?: 'smart' | 'full';
  contentUnitDecision?: (element: Element) => ContentUnitDecision;
}
```

但第一版也可以只通过 site profile 的 `select()` 和 `{ skip: true }` 完成。

## 优先级

选择节点时建议按优先级处理：

1. 已翻译节点、脚本、隐藏元素、表单输入等安全跳过。
2. site profile 明确 skip。
3. site profile 明确 allow。
4. contentFilter 通用 skip。
5. contentUnitClassifier 通用 allow/skip。
6. 当前 grabAllNode 默认逻辑。

这样站点平台规则可以修正通用规则，但不会污染通用层。

## 实施计划

### Phase 1：Discourse 论坛结构

目标：

- Ziggit 首页不再翻导航、分类、tag、统计列，避免布局被撑坏。
- Ziggit 首页 topic 标题和摘要可以翻译。
- Ziggit 详情页 topic 标题可以翻译。
- Ziggit 详情页图片附件 metadata 不翻译。

改动：

- 新增 `entrypoints/main/siteProfiles/discourse.ts`。
- 在 `siteProfiles/index.ts` 注册。
- 增加 `tests/utils/discourseProfile.test.ts`。

不改：

- 不改 `contentDetector` 通用 promotion。
- 不改 `contentFilter` 通用规则。
- 不改双语渲染样式。

### Phase 2：文章标题和副标题补全

目标：

- Decrypt 这类文章页标题、副标题进入识文范围。
- 不把分享栏、侧栏、推荐列表带进来。

方向：

- 先用测试复现标题区与正文区分离的结构。
- 如果已有 promotion 规则不足，再讨论通用标题补全方案。
- 优先考虑“主内容根附近标题区补全”，而不是扩大 root。

### Phase 3：内容卡片识别

目标：

- `how-llms-work` 的流程卡片被识文覆盖。
- 文档页中的 note、warning、key insight、definition card 被覆盖。

方向：

- 新增轻量 `contentUnitClassifier`。
- 识别 “标题 + 说明文本” 型卡片。
- 对 CTA、广告、推荐卡片保持跳过。

### Phase 4：调试与回归

目标：

- 能解释节点为什么被翻或被跳过。
- 新规则不会让 TDS、CNN、GitHub、Reddit 退化。

测试样本：

- Decrypt 文章页：标题、副标题、正文、图片说明。
- Ziggit 首页：topic 标题、摘要、跳过导航/tag/统计。
- Ziggit 详情页：topic 标题、正文、跳过附件 metadata。
- How LLMs Work：正文段落、流程卡片、key insight。
- TDS：继续跳过 tags/share/CTA。
- GitHub：全文和识文行为不退化。
- Reddit：帖子标题、正文、评论仍可识别。

## 风险

- 放宽标题识别可能带入页面导航标题。
- 内容卡片识别可能误翻推荐卡片或营销卡片。
- 论坛列表页翻译 topic 标题后，双语插入仍可能增加行高，但这是可接受影响；分类/tag/统计不应再制造大面积错位。
- 站点 profile 过多 selector 可能变脆，所以每条 selector 都要对应测试和真实语义。

## 决策建议

建议先做 Phase 1。

原因：

- 当前分支就是论坛结构优化分支。
- Discourse 是平台规则，边界清晰，不污染通用识文。
- 能直接解决 Ziggit 首页和详情页两个明显问题。
- 做完后再处理文章标题、副标题和内容卡片，会更容易分辨哪些问题属于平台结构，哪些属于通用识文。
