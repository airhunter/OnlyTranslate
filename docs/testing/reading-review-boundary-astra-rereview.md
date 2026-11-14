# Astra 复审：工程边界两项修复

模型：GPT-6 Astra，xhigh。日期：2026-11-14。

**结论：原 P1、P2 均已关闭，未发现本轮修复新增的实质问题。可以进入提交内容审核，但本轮仍不提交、不 push。**

本次读取当前源码与 `reading-review-boundary-astra-fixes.md`，没有把旧漏洞现场当成当前实现。仅审核，没有修改实现、识别算法、人工裁决、整页确认或已接受限制。

## P1：校验与构建对象错位——已关闭

`scripts/build-extension.mjs:7–22` 只接受受限的 browser、mode：浏览器为 chrome / edge / firefox，模式为 production / development。位置根目录、替代配置、入口过滤、未知／重复参数和缺失／非法值均失败。第 21 行重构实际 WXT 参数，固定绝对根目录与对应的 wxt.config.ts，不原样转发输入。

第 36–44 行先校验参数，随后才启动检查；检查和 WXT 使用同一根目录。工具缺失、非零／信号退出及构建失败的传播逻辑保持。

Astra 独立运行当前编排回归，12/12 通过；在新隔离目录复制当前 wrapper，使用真实 WXT 0.21.4，验证：

- build / zip 的其他根目录、替代配置、紧凑 -c、入口过滤、重复 browser、参数分隔符共 12 个负例全部退出 1。
- 各负例的检查标记、A 工程产物、B 工程产物均不存在，确认提前拒绝。
- Chrome production、Edge development 两个正常 build 均退出 0，检查记录与实际 manifest 均为 A。

独立证据：[astra-rereview-4NSUC1/evidence.json](../../output/reading-review-boundary/astra-rereview-4NSUC1/evidence.json)。复制时 wrapper SHA-256 为 `c8ee09b119b0fb1017bfea30c3ba061507467ef0e5eb53645493f46aaf1378ff`。

隔离检查进程是记录根目录并成功退出的桩，WXT 为真实程序；这些结果证明参数和编排行为，不冒充真实人工校验。

## P2：工具漏声明 happy-dom——已关闭

`tools/reading-review/package.json:12–14` 在 dependencies 中直接声明 happy-dom，`pnpm-lock.yaml:116–120` 的工具 importer 绑定现有 20.11.2。根工程保留自身测试需要的声明。

新增 `tools/reading-review/tests/dependencies.test.ts:12–27` 在仓库外临时目录复制 preview 和工具 package，只连接工具声明的运行依赖，再由真实 Node 导入并渲染。Astra 独立运行，1/1 通过；不再依靠 preview 从祖先仓库查找隐式依赖。验证使用现有安装包，没有联网重新安装。

初次沙箱执行因创建 junction 的 EPERM 失败，经既有权限机制重跑通过，属于执行环境限制，未列为实现问题。

## 工程边界与正式入口结论

扩展运行代码和 WXT 配置仍不依赖评审工具；参数处理位于仓库编排层。工具安装依赖的原缺口已关闭。

根 build / zip 与 Edge、Firefox 变体继续调用同一 wrapper；zip:all 调用三个正式 zip 入口，release-it 打包钩子调用 zip:all。开发入口保持独立。支持的参数不能再将 WXT 指向另一项目。

底层原生 WXT 可独立构建仍是既定设计，不作为门禁遗漏。本次没有其他已确认的独立实质问题。

## 验证范围与限制

| 项目 | 结果与证据性质 |
| --- | --- |
| 当前编排测试 | Astra 独立运行，12/12 通过 |
| 仓库外仅运行依赖预览 | Astra 独立运行，1/1 通过 |
| 非法 build / zip 参数 | Astra 独立运行 12 个负例，全部提前阻断 |
| Chrome production、Edge development | Astra 真实 WXT 隔离构建，均检查并构建 A |
| 受保护文件 | Astra 重新计算，231 个文件均未变 |
| 原发布 ZIP | Astra 重新计算，SHA-256 与此前一致 |
| 完整 pnpm verify | 读取修复阶段日志：扩展 1,462 项、工具 58 项通过，本次复审未重复全量运行 |
| 真实人工校验和正式 Chrome build | 读取修复阶段日志：13 项要求、11 满足、2 既有接受、0 阻断，随后构建成功，本次复审未重跑 |
| 七个正式入口缺失快照 | 读取修复阶段矩阵，均非零退出、WXT 未启动 |
| 隔离 zip 正例 | 读取修复阶段证据，检查及产物均为 A，本次复审没有重打 ZIP |

已读修复证据：`output/reading-review-boundary/fixes-verify.log`、`fixes-build.log`、`fixes-gate-matrix.json`、`fixes-repro-aex8wW/evidence.json`。

原发布 ZIP SHA-256：`d6bd44f605667f1fe6b890bb4a9694eb0705c2877299b9d2404d6d85f25d868c`。

此次不扩大到算法及历史流程审计，没有执行真实发布版翻译、正式 ZIP 打包或发布操作。复审通过不等于提交或发布授权。
