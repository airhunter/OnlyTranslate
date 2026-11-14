# Astra 审核说明：评审台与扩展工程边界

本轮由用户明确要求交给 Astra 审核，先不提交。重点是实际依赖边界与正式 build／zip 门禁，不能只复述实施报告。只审核，不修改实现、识别算法、真实人工标注、整页确认或已接受限制，不构建或覆盖发布 ZIP。

## 本轮调整范围

- 分支 `codex/smart-reading-blocks`，HEAD `7adaf68`。工作区有此前扩充语料和整页确认功能的未提交改动，以及无关的 `store-assets/product-hunt/`；不要把这些都当成本次边界调整。
- `scripts/reading-review/` 迁至 `tools/reading-review/`，原评审测试迁入其 `tests/`。新增独立 package、pnpm workspace、类型和测试配置。
- 浏览器采集入口迁至 `tools/reading-review/adapters/onlytranslate.ts`；真实识别函数不改，由工具单独打包。
- 从 `wxt.config.ts` 删除原评审导入与 `build:before` hook。新增仓库编排 `scripts/build-extension.mjs`，正式根目录 build／zip 及浏览器变体先调用评审 check 子进程，通过后调用 WXT 子进程。
- 根目录 compile/test 仅验证扩展；verify 聚合扩展及工具。保留 review:reading、test:reading 便捷入口。
- 更新 AGENTS、RELEASE、当前评审流程；人工与快照目录不迁移。

## 审核重点

1. 扩展运行、配置、类型和测试是否仍有隐藏的工具依赖；工具是否仍意外使用扩展配置或未声明依赖；工作区、锁文件和适配器是否符合单向关系。
2. 迁移是否遗漏旧路径、默认根目录、worker、静态资源、发布版源代码采集或构建产物位置。只需要报告与本轮相关的真实缺陷。
3. 枚举 package scripts、zip:all、release-it、各浏览器、参数转发和失败传播，核实所有正式入口先检查后构建。测试是否真正覆盖工具缺失、非零退出、终止、构建失败及开发模式。
4. 检查门禁与实际构建输入的一致性、参数或配置是否造成检查对象与交付对象错位，以及未声明的绕过路径。不要为复现覆盖现有发布包；需要测试时使用隔离临时工程。
5. 底层 WXT 无门禁是这次讨论明确选定的边界：扩展独立构建，上层发布流程强制校验。不要仅因原生 `wxt build` 可直接执行就报告为未实现；但需确认正式流程不会误用底层命令，说明剩余人为绕过能力与自动入口遗漏的区别。
6. 识别源码、真实裁决和既有两项接受限制必须保持不变。不得对真实 corpus 创建、撤销或修改裁决／接受，不得把人工要求降级以让构建通过。

## 阅读入口与已有证据

- `docs/testing/reading-review-engineering-boundary.md`
- `tools/reading-review/README.md`
- `scripts/build-extension.mjs` / `.d.mts`
- `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`wxt.config.ts`、`tsconfig.json`、`vitest.config.ts`、`.release-it.json`
- `tools/reading-review/{package.json,tsconfig.json,vitest.config.mjs,driver.mjs,check.mjs,server.mjs,worker.mjs,adapters/}`
- `tests/utils/buildExtension.test.ts`、`tools/reading-review/tests/`
- `output/reading-review-boundary/verify.log`：扩展 1,457 项与工具最初 56 项通过。
- `output/reading-review-boundary/review-verify.log`：新增资源路径测试后工具 57 项通过。
- `output/reading-review-boundary/build.log`：真实人工校验成功后 Chrome build 成功。
- `output/reading-review-boundary/{zip-blocked.log,development-build-blocked.log}`：隔离缺失快照时失败阻断。
- `output/reading-review-boundary/extension-without-tool.log`：暂移工具目录后 WXT prepare 和扩展类型检查成功，工具已恢复。
- `output/reading-review-boundary/smoke.json`：新后端 69 页、静态资源和真实 worker 正常；Teapaw、Josh 同快照覆盖各为 +0/-0。
- `output/reading-review-boundary/{protected-before.json,protected-after.json}`：231 个受保护文件摘要未变，原发布 ZIP 未覆盖。
- 真实人工门禁报告位于仓库同级 `OnlyTranslate-review-data/checks/check-1794656162727-ee0fde62/report.json`：13 项要求，11 满足、2 已接受未满足、0 阻断、0 真实整页确认。

请独立验证。报告先列问题，按 P1/P2/P3 排序；给出文件、当前准确行号、可复现触发条件、影响与最小修正建议。区分已经复现、静态确认、尚待验证。无阻断问题也要写明检查范围及剩余限制。只返回审核结果，不直接修复。
