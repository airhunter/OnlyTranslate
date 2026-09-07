# 开放 Shadow DOM 实施与真实页面验收

日期：2026-09-07。最终实现默认支持开放 Shadow DOM；closed root 和完全无可观察信号的晚挂载 root 不在本版范围内。实现采用组合树范围裁决、分片异步初始收集、同一 Observer 多根监听、可续处理的动态队列，以及跨根插入和恢复。

`entrypoints/main/siteProfiles/arsTechnica.ts` 的工作区改动在本次任务前已存在，未纳入本功能。以下先记录实现后的验收结果，再保留促成设计决策的早期原型数据。

## 实施后验收

| 页面 | 开放根 | 智能目标 | 相对原行为 | 结果 |
| --- | ---: | ---: | --- | --- |
| Google RSVP 初始页 | 381 | 35 | +35 | 页面介绍、Agenda 和 25 个议程标题；未选入 Cookie、跳转、辅助文字及纯时间字段 |
| Google RSVP 展开首项 | 381 | 37 | +37 | 在初始结果上新增签到说明和早餐说明两段正文 |
| GitHub React | 42 | 37 | 0 | 未选入 relative-time 的时间文字 |
| MDN Shadow DOM | 120 | 77 | 0 | 未选入课程推广和反馈问题 |
| Material Web Buttons | 325 | 175 | 0 | 未选入 nav-drawer 内的目录和跳转文字 |
| Lit Shadow DOM | 102 | 84 | 0 | 未选入 Cookie 提示；页面内容数量与早期采集时略有变化 |
| YouTube 视频页 | 0 | 5 | 0 | 目标集合不变 |

真实 RSVP 展开交互产生 141 条 mutation、5 次回调和 2 次 flush；原型增量路径找到两段新增正文，与操作后的全量重扫一致。正式实现沿用相同的根级合并思路，并把每批 32 个根从“超出丢弃”改为“保留并续调度”。

同一 YouTube 页面状态交替执行启用／禁用 Shadow 支持各 10 轮：目标均为 5 个，扫描 CPU 中位数分别为 184.45 ms 和 180.4 ms，增加 4.05 ms，满足 `max(5 ms, 原值 10%)` 的验收线。RSVP 同页 10 轮同步诊断中，禁用时为 0 个目标、启用后为 35 个；启用路径中位数约 95–100 ms。正式自动翻译使用异步发现和根间约 4 ms 分片，因此总活动 CPU 不会消失，但不会把全部根处理合并成一个不可取消的同步调用；单个根仍可能超过预算。

自动化覆盖嵌套开放根、slot 投影与 fallback、双语／仅译文插入恢复、异步取消、超过 32 个动态变化的续处理及既有 SPA 生命周期。真实页面没有调用付费翻译服务；实际译文插入使用可控翻译响应在浏览器 DOM 测试中验收。

## 早期原型方法与边界

- 所有页面来自真实公开网站；没有构造 HTML 来替代真实页面。没有加载用户的扩展配置，也没有发送翻译请求。
- 基线直接调用生产函数 `resolveAutoTranslationTarget`。候选原型递归发现开放 Shadow Root，使用生产函数 `collectTranslationTargets`、`classifyContentUnit`、`getContentFilterDecision` 对各根独立分类。
- 发现阶段不按字数剪枝，不使用“普通 DOM 目标为零”条件。按 400 个元素或约 4 ms 分片，保留游标继续。分类阶段在根之间约每 4 ms 让出主线程；单个根内的生产分类器仍同步执行，4 ms 不是硬上限。
- 原型增加沿 `assignedSlot` / `parentElement` / `ShadowRoot.host` 回溯的边界检查，排除隐藏、禁止翻译、常见交互区域。每次分类批次缓存祖先检查。所有根先被发现，只有没有自身文本的根跳过分类，故空布局根不会遮断更深层正文。
- 候选路径为了测量期间不移动网站文本，关闭 direct-text 包装，并不做全页 supplemental 收集。因此它是复用生产分类器的候选收集实验，不是完整扩展的一比一替代。
- 每页连续执行三轮；每轮分类前清空已有 contentFilter 缓存，该缓存清理不计入分类 CPU。没有在不同页面之间混用节点缓存。
- 原始文件保存每个目标的实际文本、标签、宿主及跨 Shadow 边界路径；性能摘要使用三轮中位数，不报告小样本 p95。首次运行的 JIT 开销、浏览器自身活动、CPU 状态仍会影响结果。
- 下表 CPU 时间不包含网络、翻译请求、译文插入、结果序列化、让出主线程的等待。完整墙钟时间和最大根/分片时间另存原始数据。它们不能解释为用户点击翻译后的总耗时。
- 普通目标“前后相同”表示诊断扫描没有改变基线目标集合，不表示候选合并后的范围正确。候选本来就是额外扫描路径。
- 记录的 Long Task 覆盖整个测量窗口，其中包含基线、基线复测、缓存清理和序列化；不能全部归因于 Shadow 扫描。YouTube 的 Shadow 根为零，仍记录了长任务，即是归因反例。

## 静态真实页面结果

单位：ms，中位数。原始数据位于 `output/playwright/shadow-audit/`（本地诊断输出，不随代码提交）。

| 页面 | 开放根 | 原目标 | 新增候选 | 原分类 CPU | 发现 CPU | Shadow 分类 CPU | 新增内容检查 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| [Google RSVP](https://rsvp.withgoogle.com/events/devfest-in-siliconvalley-2025) | 381 | 0 | 63 | 0.5 | 1.6 | 86.3 | 标题、介绍、25 项议程标题；也选入 Cookie、跳转、辅助文字和 25 个时间字段 |
| [GitHub React](https://github.com/react/react) | 42 | 37 | 37 | 15.7 | 0.8 | 18.0 | 新增全部为 relative-time 的时间文字 |
| [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) | 120 | 77 | 2 | 48.0 | 1.0 | 4.9 | 课程推广、页面反馈问题 |
| [Material Web](https://material-web.dev/components/button/) | 325 | 175 | 4 | 85.6 | 1.6 | 7.0 | 目录提示、目录标题、站点链接、跳转链接 |
| [Lit](https://lit.dev/docs/components/shadow-dom/) | 102 | 86 | 2 | 64.0 | 1.0 | 2.7 | Cookie 标题与说明 |
| [YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ) | 0 | 5 | 0 | 152.8 | 2.7 | 0 | 无新增 |

六页、每页三轮的普通 DOM 目标在 Shadow 扫描前后均相同。所有“新增”均为候选目标，不代表已经发出的翻译请求；服务前置语言判断等流程可能继续排除部分文字。

RSVP 全文模式另测三轮：原目标 0、新增 65，Shadow 分类 CPU 中位数 55.4 ms。智能模式首屏没有选入折叠的议程描述，展开后才收集。

RSVP 优化前版本每根都等待一次、重复回溯宿主祖先，三轮 Shadow CPU 为 175.7 / 145.2 / 157.2 ms；缓存祖先和批量分片后为 101.8 / 86.3 / 73.8 ms，三个回合均为同样的 63 个目标。前者第二轮墙钟约 2039.6 ms，说明过于频繁的让出也有等待成本。优化后最大单根仍可达 10.5 ms，需要继续解决单根可中断性，不能声称 4 ms 硬预算已实现。

GitHub 再用仅增加范围标记的版本复核：新增的 37 个时间目标全部在原 `contentRoot` 的跨边界范围之外。主文档目标非零不应该阻止发现；但发现以后，也不能把每个根都当成独立的正文区域。

原始数据文件：`rsvp-smart.json`（优化前）、`rsvp-batched-smart.json`、`github-smart.json`、`mdn-smart.json`、`material-smart.json`、`lit-smart.json`、`youtube-smart.json`、`rsvp-full.json`、`github-scope-smart.json`。

## 固定窗口真实交互

每项从新加载的 RSVP 页面开始，等待真实标题出现并稳定 2.5 秒，启用一个 Observer 监听所有已发现根。点击实际页面按钮，等待 1.5 秒，再停止并处理待完成队列。未发送预约、登录或日历操作。

| 交互 | Mutation | 回调次数 / 总 CPU | flush | 根扫描次数 | 分类 CPU | 新增目标 / 漏检 |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| View more | 145 | 5 / 0.2 ms | 2 | 62 | 56.2 ms | 2 / 0 |
| 展开 Registration & Networking | 141 | 5 / 0.2 ms | 2 | 26 | 53.2 ms | 2 / 0 |

- 加载更多新增 `Happy Hour & Networking` 和时间字段；登记了 37 个新根。累计登记 418 个，仍连接页面的根为 415 个。原型只在停止时统一断开，未实现实时清除已移除根。
- 展开议程新增两段真实描述：签到与座位说明、早餐说明。
- “漏检 0”是相对于同一个分类器在操作后重新发现全部根并全量收集的结果，不是人工标注的页面全部正文召回率；比较器和增量路径仍可能共同遗漏内容。
- 一次交互可能跨多个回调和 flush，不能承诺“每次点击恰好扫描一次”。即使 Observer 回调便宜，也应降低随后重复进入分类器的次数。
- `rsvp-window-more.json` 与 `rsvp-window-expand.json` 为此表的正式固定窗口数据。之前分开调用工具得到的 `rsvp-more-dynamic.json`、`rsvp-expand-dynamic.json` 窗口不一致，保留为探索记录，不用于横向比较。

## 原型阶段决策（已落实）

1. 保留独立于普通目标数量的开放根发现。实测无 Shadow 根的 YouTube 额外发现 CPU 中位数为 2.7 ms；这支持继续探索融入既有遍历的结构发现，但不足以保证所有设备/页面开销相同。
2. 拒绝“每个根独立按全文/正文分类”直接投入使用。应在跨边界路径上继承正文范围、Profile 语义和明确的 supplemental 规则；现有 `parentElement` / `closest` / `contains` 的局部树行为需要有针对性地处理。
3. 不能简单只保留 `contentRoot` 内的节点：既有标题/摘要补充规则可能允许根外内容；RSVP 的基线根还是 body，根内仍含 Cookie 等噪声。Material Web 的基线根是承载多个 slot 的 nav-drawer，也说明作用域与实际呈现结构不能只看宿主标签。
4. 将下一轮验证重点放在跨根上下文与变更定位。先确定哪些根/目标的文本、显隐或结构确实变化，再分类；不能把动画 class 变化都当作正文变化，也不能假设 class 永远不影响正文显隐。
5. 正式实现已覆盖可观察新增中的开放根、slot 分配变化、宿主移除与替换、停止后清理。无其他 DOM 信号的 late attachShadow 按本版边界不自动发现，需重新启动翻译。
6. RSVP 已有证据表明时间、辅助导航等需要精确处理；Profile 可补这些站点差异。但不应以 Profile 大范围放行替代通用上下文设计。

原型尚未验证译文实际插入、样式隔离、仅译文恢复、请求取消、真实扩展隔离世界或 closed Shadow Root。正式实现需要把这些作为另一个明确的验证阶段。

## 重跑方法

在仓库根目录执行；需要可运行的 Node/npm、项目依赖和 Playwright CLI 能访问公开网站。

```powershell
node scripts/shadow-audit/build.mjs
npx --yes --package @playwright/cli playwright-cli --session shadow-prototype open "https://rsvp.withgoogle.com/events/devfest-in-siliconvalley-2025"
# 等真实标题、议程出现后执行；run 不负责导航。
node scripts/shadow-audit/run.mjs rsvp smart
node scripts/shadow-audit/run.mjs rsvp full
# 固定窗口交互会自动重新导航至该已验证页面。
node scripts/shadow-audit/run.mjs rsvp-window more
node scripts/shadow-audit/run.mjs rsvp-window expand
npx --yes --package @playwright/cli playwright-cli --session shadow-prototype close
```

其他页面先在同一 session 导航，确认页面没有被登录墙或反自动化拦截，再运行 `run.mjs <label> smart`。报告保存实际 URL、标题、日期、浏览器 UA 和每轮原始目标；不读取用户的 API 凭据。脚本默认通过 Node 安装目录中的 npm CLI 启动 npx，适用于本次 Windows 环境；其他 Node 布局可能需要调整启动路径。

最终验证：诊断 bundle 与 Chrome MV3 扩展构建成功；`pnpm test:content` 的 8 个文件、269 项通过；`pnpm verify` 的 129 个文件、1059 项通过。构建仅保留既有 chunk 大小提示，没有新增构建错误。
