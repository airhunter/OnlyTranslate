# Content Regression Testing

OnlyTranslate 的内容识别规则需要用回归测试保护。目标是让每次规则调整都有可复现样本，避免修一个页面时破坏另一个页面。

## When To Add Tests

以下改动必须补测试：

- `contentDetector`、`contentFilter`、`contentUnitClassifier`。
- `translationTarget/` 的 collect、decision、dynamic、scan context。
- smart/full 翻译范围。
- 站点 profile 的 allow、skip、append、expand、nested merge 行为。
- MutationObserver 动态补扫。
- 双语译文插入位置。
- 任何已确认的漏翻、误翻、误跳过问题。

## Fixture Tests

静态网页结构优先使用 fixture 驱动回归测试。

位置：

```text
tests/fixtures/translation-target
```

适合放在 fixture 的内容：

- 站点正文结构。
- 导航、侧栏、广告、推荐等应跳过区域。
- 标题、段落、列表、引用、图注等应翻译目标。
- content root 预期。
- 关键 included/excluded 文本断言。

fixture 应尽量保留最小 DOM 片段。不要把整页 HTML 原样塞进去，除非问题必须依赖大规模结构才能复现。

## Code Tests

以下行为更适合放在 `tests/utils` 或对应模块测试中：

- 动态 DOM 插入。
- MutationObserver 合并补扫。
- 已翻译节点旁边新增未翻译兄弟节点。
- 译文 append target。
- 翻译插入后的 DOM 结构。
- ScanContext 缓存、预算、统计信息。
- 工具函数的边界输入。

## Heavy Page Coverage

Heavy 页面测试应模拟真实风险，而不是绑定某个站点专属逻辑。

建议覆盖：

- 大量导航、按钮、广告、推荐、侧栏、短 UI 文案。
- 正文标题和段落仍能命中。
- UI、rail、广告不命中。
- 初始 smart supplemental 分类数量不超过预算。
- contentRoot 外批量 UI mutation 不产生翻译目标。
- contentRoot 内新增可读段落能在合并补扫后识别。

## Dynamic Regression Template

记录手工回归问题时，至少保留：

- Page URL or fixture name。
- Expected behavior。
- Actual behavior。
- Minimal HTML snippet or screenshot reference。
- Fix type：generic、profile-specific、dynamic-scan、append-target、release-process。
- Regression coverage：新增或更新的测试文件。

## Example: Ziggit Topic Replies

问题页面：

```text
https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822
```

现象：

- Discourse cooked reply 中带 inline code 的段落没有被翻译。
- 用户名、时间戳、按钮和 topic stats 应继续跳过。

修复方式：

- 使用 Ziggit profile 补充 Discourse cooked content 识别。
- 让动态扫描路径能够接入 profile-owned expansion target。

回归覆盖：

- `tests/fixtures/translation-target/ziggit-topic-thread.html`
- `tests/fixtures/translation-target/ziggit-topic-thread.json`
- `tests/utils/autoTranslateTarget.test.ts`

## Verification Commands

内容识别相关改动优先运行：

```bash
pnpm test:content
```

合并前或发布前运行：

```bash
pnpm verify
```

若改动触及发布流程，还需要按 `RELEASE.md` 执行 zip 构建和 `pnpm release:check`。
