# Astra 独立审核：当前未提交识文评审改动

审核日期：2026-11-14。审核基于分支 `codex/smart-reading-blocks`、HEAD `f9c97a5d6a92c07463c30b125dc852894acf8455` 的相关未提交文件，包括未跟踪的评审台、人工验证集和测试。排除 `store-assets/product-hunt/`。

**结论：暂不建议进入提交前放行复核。发现 3 项已证实缺陷，建议先修复，再复核。** 其中一项会覆盖历史快照，一项是识别保护边界的新回归，一项使发布基线的实际输入与其宣称的身份脱节。325 项现有相关测试通过，不能抵消这些反例。

## 已证实问题

### 1. [P1] 相同 HTML 的重新采集会覆盖已审快照和其资源身份

位置：`C:\coding\translates_project\OnlyTranslate\scripts\reading-review\worker.mjs:52`，以及同文件第 60–65 行。

触发条件：网站 HTML 保持相同，外部 CSS、图片、字体内容或采集状态发生变化，用户再次点击“重新采集”。例如 HTML 始终引用 `/style.css`，但该 URL 返回的 CSS 从 `body{color:black}` 变为 `body{display:none}`。

代码只用 `hash(captured.html).slice(0, 24)` 生成目录 ID，随后无条件覆盖 `source.html`、`original.png`、`snapshot.json`。新资源清单、目录位置及可见性信息取代旧记录，但同目录 `comparison.json`、历史运行和真实裁决继续指向同一 ID。即使 HTML 及每个资源各自的摘要都正确，也已不是原来已审的渲染状态。

隔离复现直接执行从当前 worker 提取的 `capturePage`，仅模拟浏览器返回值，两次使用相同 HTML、不同 CSS：

```text
sameSnapshotId: true
oldAssetHash: 7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6
newAssetHash: e3fda72257f02154c9d7e25c350e8b91e556ccd4b5e3c2ca00978be72a1f74de
baselineStillPinned: { baselineRunId: "original-baseline" }
```

影响：旧截图及元数据丢失；新候选与旧基线被当作同快照比较；历史裁决可能在改变的视觉上下文上执行。接受清单绑定的 snapshotId/HTML/文字都可能保持不变，因此也无法识别这次上下文替换。这不是对两项接受授权的质疑，而是快照身份实现不完整。**该问题直接破坏基线和历史证据可信度。** 尚未证明当前五页真实数据已发生这种覆盖。

建议：每次采集创建不可覆盖的新身份，并原子完成归档；或以 HTML、归档资源映射及渲染参数组成完整内容身份，遇已有身份只校验复用，绝不改写旧快照。补充相同 HTML／不同 CSS、采集失败中断及重复采集的测试。

### 2. [P2] 行内代码聚合分支把隐藏文字及嵌套控件纳入翻译

位置：`C:\coding\translates_project\OnlyTranslate\entrypoints\main\dom.ts:1479`，重点第 1481–1482 行。

触发条件：`li` 或 `dd` 直属的文字 div 内有 code，同时含 CSS 隐藏 span、`role="menuitem"`，或 span 内进一步嵌套的 navigation。新增分支只禁止部分属性/控件，最后只判断直接子标签是否属于 inlineSet，未沿用完整的后代保护边界。

最小结构：

```html
<ul><li><div id="sample">
  Sets the <code>value</code> parameter
  <span style="display:none">Private hidden message</span>
</div></li></ul>
```

将该结构放入普通 article，当前 smart 收集选中整个 `#sample`。隔离测试继续调用真实 `handleBilingualTranslation`，只模拟翻译服务，实际提交给 `translateText` 的输入包含：

```text
Sets the __ONLY_TRANSLATE_INLINE_0_w1fybi__ parameter Private hidden message
```

插入的可见译文为：

```text
设置 value parameter Private hidden message
```

使用 Vite 内存 transform 仅移除本次新增分支，保持其余源码、DOM 和测试不变，旧路径不选择该目标，翻译接口输入没有隐藏文字，也没有新增译文。同样的前后对照确认 `role="menuitem"` 文案及 span 内嵌 navigation 的文字由本次分支新增收录。

影响：原先被扫描路径排除的隐藏/控件文字会进入翻译请求，并可能出现在可见译文中。code 本身仍被占位符保护，但这不能保护其他后代边界。

建议：复用已有安全内联遍历和跳过规则，递归确认后代的可见性、交互角色及结构；不允许仅凭直接子标签把整个容器提升为目标。补充静态、动态和实际插入的反例，确认隐藏文字不发送、不显示。

反例中的 `contenteditable=""` 在旧路径也存在收录，未将它作为本轮新增缺陷，也不建议在本任务中顺带扩修。

### 3. [P2] 发布 ZIP/commit 核验没有覆盖实际使用的解压缓存

位置：`C:\coding\translates_project\OnlyTranslate\scripts\reading-review\worker.mjs:80`，以及第 83–89 行。

触发条件：`output/reading-review-build/<tag>/extension` 或 `source` 已存在，缓存内容在调试、复制恢复或非完整重建后与锁定包/commit 不同，但 `manifest.json`、`package.json` 仍存在，扩展 version 仍相同。

当前代码校验原 ZIP 哈希，但只凭 `extension/manifest.json` 存在就跳过解压；只凭 `source/package.json` 存在就跳过 `git archive`。随后验证的是 tag 指向的 commit，而不是缓存中的源码；实际浏览器加载旧 extension 目录，实际采集器编译旧 source 目录。

隔离复现执行当前 `prepareRelease` 原函数，提供摘要正确的测试归档、版本正确但内容不同的现存扩展/源码缓存。函数正常返回，编译输入为 `changed recognizer content`，仍报告锁定 `kind: release`、commit 和 assetHash。唯一执行的外部命令是 `git rev-parse v1.0.0^{commit}`，没有重新归档/解压或核对缓存内容。

运行记录的 `bundleHash` 能区别采集器产物，却没有可信的对应源码预期可比；扩展实际加载文件也没有被逐文件核验。它不能弥补输入来源核验缺口。**缓存发生变化后，基线身份声明不再可信。** 本审核没有修改真实缓存，也没有证实现有五页基线已被污染。

建议：从已核验 ZIP 和指定完整 commit 在新的临时目录重建输入，再原子发布缓存；或保存并验证完整文件清单/摘要，绑定 archive hash、commit 和完成标记，任何不一致都重建或阻断。测试应覆盖同版本内容变动、残缺缓存和中断后的重试。

## 接受机制与构建门禁

没有发现 e1331/e1333 的授权被擅自扩大。当前接受记录保留原 translate 裁决，匹配页面、快照/HTML、文字摘要、裁决 ID/口径/方向及选中文本节点集合；撤销、新裁决和不同覆盖的测试会失效。报告分别统计未满足、已接受和仍阻断，未将两项写成修复或全部满足。

检查器遍历有效历史裁决，对缺数据、坏锚点、资源摘要不符、回放失败和检查期间输入变化有阻断路径。`build-gate` 只跳过 serve，子进程非零退出向上传播。已检查本机 WXT build/zip 都进入 internalBuild 的调用路径。上面的快照不可变性缺口仍会影响这些检查所依赖的输入，不能被单次摘要一致性检查发现。

## 独立验证和证据

已运行：

```powershell
node node_modules/vitest/vitest.mjs run tests/utils/readingReview.test.ts tests/utils/readingReviewCheck.test.ts tests/utils/autoTranslateTarget.test.ts tests/utils/autoTranslateTargetFixtures.test.ts
```

结果：4 文件、325 项通过。首次沙箱运行的 3 项 API 测试因 `connect EACCES 127.0.0.1` 失败；在正常本机回环环境重跑后全部通过。pnpm 启动器先遇沙箱包管理器 symlink 权限问题，因此使用现有本地 Vitest 入口，没有安装依赖。

最小复现文件均在忽略目录，不修改产品源码、真实裁决或接受记录：

- `C:\coding\translates_project\OnlyTranslate\output\astra-review\integrity-repro.mjs`：提取当前 capturePage/prepareRelease 原函数，使用临时数据和模拟浏览器/构建边界，证明快照覆盖和缓存核验缺口。
- `C:\coding\translates_project\OnlyTranslate\output\astra-review\structure.test.ts`：隐藏文字、嵌套结构与交互角色的目标选择反例。
- `C:\coding\translates_project\OnlyTranslate\output\astra-review\actual-translation.test.ts`：真实翻译插入函数配合模拟翻译服务，记录隐藏内容发送和显示情况。
- `C:\coding\translates_project\OnlyTranslate\output\astra-review\vitest.config.ts`：只在测试内按环境变量关闭新增分支，以做前后对照。

复现命令：

```powershell
node output/astra-review/integrity-repro.mjs
$env:AUDIT_PREVIOUS_DOM='0'
node node_modules/vitest/vitest.mjs run --config output/astra-review/vitest.config.ts
$env:AUDIT_PREVIOUS_DOM='1'
node node_modules/vitest/vitest.mjs run --config output/astra-review/vitest.config.ts
Remove-Item Env:AUDIT_PREVIOUS_DOM
```

后两组是诊断型最小复现，输出实际选中目标及翻译输入；其“通过”表示执行成功，不代表反例已修复。

`git diff --check` 通过。真实裁决文件 SHA256 仍为 `5276ad676aa9dd5c19a6b8d1439f6badc266cbf1d2d3025f8cb3b3266dda223e`。

## 覆盖与局限

已审查全部相关 tracked diff 和 untracked 评审实现：采集/浏览器驱动、catalogue/collector/replay、比较及接受模型、API/队列/保存、预览、UI/草稿、类型声明、门禁/WXT 接入、两处识别源码修改、新测试/fixture、真实 corpus 元数据及相关流程文档。`teapaw.ts` 仅状态显示 M、无内容 diff，未处理。未做其他代理委派。

现有测试覆盖保存、并发冲突、固定基线、历史裁决、接受边界和主要正反例，但没有覆盖同 HTML 重新采集、缓存内容失配，以及本次聚合规则的 CSS 隐藏/深层控件边界。新增 metadata/toolbars 规则的跨站误伤和长页面性能，仍需更多真实页面与性能样本；本次未证实可独立报告的性能缺陷，不能断言不存在。

未重复全量 verify、真实 corpus 浏览器回放或正式构建；未执行 ZIP、发布、tag、commit、push、分支创建；未使用真实人工标注做写入测试。临时快照/缓存复现模拟了浏览器及构建边界，不是对真实五页数据损坏的证据。结构复现使用 happy-dom，实际 Chromium 视觉回归仍应在修复后补充。

建议先处理上述 3 项，补上针对性回归及内容测试，再按既有授权流程做同快照比较和提交前复核。本审核不修改算法、真实标注或接受决定。
