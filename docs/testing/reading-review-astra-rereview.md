# Astra 修复复审报告

日期：2026-11-14。范围：首次审核发现的三项缺陷及其修复引入的回归。依据 `reading-review-astra-fixes.md` 确定冻结输入后，独立检查当前实现并复跑隔离测试。首次审核报告保留，不改写历史结论。

**结论：原三项缺陷已解决；发现一项已证实的 SVG 新回归，暂不建议进入提交前放行复核。应先修复该回归、补正反例，再复核。**

## 新发现

### [P2] 递归内联标签检查误排普通 SVG，导致整条列表说明漏收

位置：`C:\coding\translates_project\OnlyTranslate\entrypoints\main\dom.ts:1481`，关键条件为第 1484 行。

触发条件：普通 `li > div` 说明包含受保护 code 和行内 SVG 图标，SVG 没有隐藏、交互或保护属性。现有 inlineSet 包含 svg，但不包含它内部的 path/g 等绘图标签。新的 `querySelectorAll('*').every(...)` 逐个检查全部后代，因此在 path 处失败，整个说明 div 不再成为目标，后续路径也没有收回其说明文字。

最小结构放在普通 article 中即可复现：

```html
<ul><li><div id="sample">
  Sets the <code>value</code> parameter
  <svg width="12" height="12" viewBox="0 0 12 12">
    <path d="M0 0L12 12"/>
  </svg>
  normally.
</div></li></ul>
```

独立对照使用相同 DOM、同一采集入口及其余相同源码，只用 Vite 内存 transform 将聚合分支切换回本轮修复之前的版本：

- 修复前：选中 `div#sample`，文字为 `Sets the __ONLY_TRANSLATE_INLINE_0_w1fybi__ parameter normally.`。
- 修复后：只剩文章标题和介绍段落，`#sample` 及这条说明的原文均未收录。

该结果不是把旧 harness 的符号错误当作产品错误，也不是凭 SVG 标签推测；已运行前后同 DOM 对照。比较基线是首次审核时的聚合实现，非 HEAD、非修复后自比较。主代理提出此候选后，由本次复审独立执行验证。

建议：区分可作为行内图形整体处理的 SVG 与普通 HTML 后代。对允许的非交互 SVG 保留说明文字，同时保留根及后代的隐藏、交互、保护检查；不要直接把所有 SVG 子树无条件放行。补普通 SVG/path/g 正例、带危险/交互/隐藏后代的反例，覆盖静态和动态收集。

复现文件位于忽略目录：

- `C:\coding\translates_project\OnlyTranslate\output\astra-review\svg-rereview.test.ts`
- `C:\coding\translates_project\OnlyTranslate\output\astra-review\rereview.config.ts`

```powershell
$env:AUDIT_BEFORE_FIX='0'
node node_modules/vitest/vitest.mjs run --config output/astra-review/rereview.config.ts
$env:AUDIT_BEFORE_FIX='1'
node node_modules/vitest/vitest.mjs run --config output/astra-review/rereview.config.ts
Remove-Item Env:AUDIT_BEFORE_FIX
```

这是输出目标的诊断复现，运行“通过”不表示回归已修复。

## 原三项逐项结论

### 1. 历史快照覆盖：已解决

`archive.mjs` 每次采集生成 UUID，完整 HTML/截图/元数据先写入 `.pending-*`，再 rename 到最终目录并更新 latest。server 按 validId 忽略 pending 目录，旧十六进制快照 ID 仍有效；worker 真实采集路径已调用该导出函数。

独立复跑的新测试确认：相同 HTML、不同 CSS/视口产生新身份，旧 metadata、截图和固定指针不变；失败不更新 latest、不暴露半成品；已有坏资源不会被新采集覆盖。

资源写入使用同目录独立临时文件加 hard link 发布，不会向摘要路径暴露写到一半的字节。另做 12 个不同页面并发归档同一 128 KiB 资源的隔离探测，全部完成，最终只有一个资源文件且摘要正确。此次修复不追溯证明历史快照从未被覆盖，也没有改写真实历史记录。

### 2. 聚合绕过隐藏/控件后代保护：原缺陷已解决，但修复产生上述 SVG 回归

新分支检查全部后代，并复用 `isSafeInlineRunElement`，受保护 code 的允许入口仅由此分支显式启用，其他调用默认值保持原行为。静态、动态、实际翻译输入及插入文本均有针对性负例。

本次重新执行首次审核留下的独立隐藏、menuitem、嵌套 navigation 反例和真实翻译函数诊断。当前代码不再选中不安全容器，翻译请求没有 `Private hidden message`，也没有插入该隐藏文字。原正常带 code 的列表说明正例继续通过。

首次审核已经排除归因的 `contenteditable=""` happy-dom 现象，不在本轮扩列为新缺陷；真实浏览器与测试 DOM 对 isContentEditable 的表现需要区分。

### 3. 实际发布输入与锁定身份脱节：已解决

`release.mjs` 校验读取的 ZIP 字节、完整 40 位 commit 和 tag 指向后，每次建立新的 verified 目录。解压来源是这些已校验字节的副本，源码 archive 使用完整 commit，最后核对版本并记录 sourceArchiveHash。worker 从返回的 source 编译并加载返回的 extension，不再读取旧同版本缓存。

独立复跑测试确认：同版本坏缓存不影响新输入；中断后重试建立不同目录；坏 ZIP、移动的 tag 在解压前失败。代码检查确认不存在重新通过可变 tag 指定归档源码的路径。阅读了主代理真实 v1.15.0 输入准备/编译记录，未在本次再次加载真实扩展或调用翻译服务。

## 验证与数据核对

独立运行：

```powershell
node node_modules/vitest/vitest.mjs run tests/utils/readingReviewIntegrity.test.ts tests/utils/autoTranslateTarget.test.ts tests/utils/autoTranslateTargetFixtures.test.ts
```

结果：**3 文件、312 项通过**（6 项归档/发布完整性、180 项目标/插入、126 项 fixture）。另运行首次审核的两个诊断测试、新 SVG 前后对照以及共享资源并发探测。现有 312 项测试未覆盖 SVG 正例，因此通过不能冲抵已复现回归。

独立读取并重新计算已保存的五页 before/after 原文覆盖，校验 after 的 sourceHash 对应当前源码，并重新读取原快照 HTML/资源、核对摘要：

| 页面 | 新增／减少 | 扫描量前→后 |
| --- | --- | --- |
| Teapaw | 0／0 | 194→194 |
| Josh | 0／0 | 1626→1626 |
| Lil’Log | 0／0 | 240→240 |
| Ziggit | 0／0 | 1539→1539 |
| Python | 0／0 | 84→84 |

这部分是对主代理已保存结果与输入的独立核验，不是本次重新执行五页 Chromium 回放。

已直接读取真实机器报告 `check-1794631256961-dcc60292/report.json`：13 项要求、11 项满足、2 项未满足且已接受、0 项阻断。未把两项已接受问题计为修复。

当前文件摘要独立核对仍为：

- 人工裁决：`5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`
- 已接受限制：`d916121d28826ae4454757f8c61c6fcb30604e4a3d7225e3cd48f3e6b3a74a3d`
- 官方 ZIP：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`

`git diff --check` 通过。主代理提供的完整 verify 1483 项、真实 Chromium 负例/正例及发布输入准备记录已阅读，但本次不将它们描述为独立重跑结果。

## 局限与边界

本轮没有重跑完整 verify、正式 build/zip、真实五页浏览器回放或发布实翻。SVG 新回归的独立执行环境是 happy-dom，加上确定的标签判断代码路径；尚未单独补 Chromium 的 SVG 视觉检查。未发现可确认的其他新阻断项。

额外尝试了当前服务器并不支持的“同一页面 12 次同时调用归档函数”：Windows 对 latest.json 的并发 rename 出现 EPERM。现有服务通过单队列串行采集，同页归档不是并行调用；这不归为本次原子归档修复引入的产品回归。如未来支持多进程/同页并发采集，应另加跨进程协调和冲突测试。已支持的串行操作及不同页共享资源探测通过。

未修改产品代码、真实快照、人工裁决或接受记录，未提交、push、建分支、生成 ZIP 或发布；只新增本报告及忽略目录里的隔离复现产物。原三项可以关闭；提交前仍应先修复本报告的 SVG 新回归。
