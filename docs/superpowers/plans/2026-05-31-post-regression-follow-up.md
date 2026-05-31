# Post Regression Follow-Up Backlog

> This backlog is intentionally deferred until manual regression testing is complete and all release-blocking bugs found during that testing are fixed.

## Trigger

Start this backlog only after:

- Manual regression testing for the current content architecture branch is complete.
- All bugs found during manual regression are fixed and verified.
- `pnpm test:content` and `pnpm verify` pass on the bug-fixed branch.

## Execution Order

Treat this backlog as staged cleanup after the regression bugfix pass, not as one large refactor.

## Progress

- Batch 0 completed: regression closure verified with `pnpm test:content` and `pnpm verify`.
- Batch 1 completed: `compat.ts` is now a thin facade over profile-owned behavior and shared domain parsing lives in a neutral utility.
- Batch 2 completed: `entrypoints/content.ts` is reduced to orchestration, with lifecycle, video subtitle setup, onboarding, floating-ball hotkey, manual translation triggers, input-box translation, runtime controls, and unload cleanup split into focused modules.
- Batch 3 completed: translation hot-path helpers, runtime response parsing, config composables, runtime declarations, Vue mount helpers, and high-risk utility inputs now use narrower DOM, generic, and `unknown` types instead of broad `any`.
- Batch 4 reviewed and deferred: no concrete manual-regression false positive/false negative was available for broad generic wrapper/card heuristics, so no shared heuristic change was made.
- Batch 5 completed through readiness: target version `0.5.5` was calculated, user-facing release notes were updated, `pnpm test:content`, `pnpm verify`, `pnpm zip`, and `pnpm release:check 0.5.5 --check-zip` were run. Formal `release-it` publishing is intentionally left to the release command.

Batch 2 commits:

- `3184743 refactor(content): 拆出页面翻译生命周期`
- `16b9591 refactor(content): 拆出视频字幕初始化`
- `0290c71 refactor(content): 拆出引导组件初始化`
- `f941a21 refactor(content): 拆出悬浮球快捷键`
- `e302320 refactor(content): 拆出手动翻译触发器`
- `54df240 refactor(content): 拆出输入框翻译`
- `2b942d6 refactor(content): 拆出入口控制监听`

Batch 3 commits so far:

- `1618a08 refactor(types): 收紧翻译热路径类型`
- `51ca011 refactor(types): 收紧运行时响应解析`
- `b5e8d48 refactor(types): 收紧配置组合函数类型`
- `195cf90 refactor(types): 清理剩余工具类型`

Batch 5 commits:

- `406a152 docs(release): 准备 0.5.5 更新说明`

### Batch 0. Regression Closure Gate

Purpose:

- Append any manual regression findings to the "Manual Regression Findings" section below.
- Fix release-blocking content detection bugs before starting architecture cleanup.
- Confirm the branch is green with `pnpm test:content` and `pnpm verify`.

Commit boundary:

- One focused `fix(content): ...` commit per confirmed regression bug.
- One `test(content): ...` commit is acceptable when adding fixtures before a larger fix, but prefer fix plus tests together for small bugs.

### Batch 1. Site Profile Ownership Boundary

Do this before further content rule cleanup. The main risk in the current architecture is ambiguity between `compat.ts` and `siteProfiles/`.

Scope:

- Decide and document whether `compat.ts` remains as a thin facade or is removed.
- Move shared domain parsing such as `getMainDomain` to a neutral utility if needed.
- Keep site behavior owned by `siteProfiles/`.
- Add profile registry tests before moving or deleting facade exports.

Out of scope:

- Do not change website-specific matching behavior unless a fixture already proves it is needed.
- Do not tune generic content heuristics in this batch.

Verification:

- `pnpm test tests/utils/siteProfiles.test.ts`
- `pnpm test:content`
- `pnpm verify`

### Batch 2. `content.ts` Responsibility Split

Do this after the profile boundary is stable, because entry wiring depends on the final target selection API shape.

Scope:

- Split dynamic translation lifecycle wiring first.
- Then split video subtitle initialization.
- Then split onboarding/update-note initialization.
- Then split shortcut and pointer event handlers.
- Keep `entrypoints/content.ts` as orchestration only.

Commit boundary:

- One commit per extracted responsibility.
- Each commit must preserve user-visible behavior.

Verification:

- `pnpm compile`
- Focused tests if any extracted module exposes testable behavior.
- `pnpm verify` after the final split.

### Batch 3. Type Cleanup

Do this after the main module boundaries stop moving.

Scope:

- Audit remaining `any` in `entrypoints/main`, `entrypoints/utils`, composables, and tests.
- Prioritize public function inputs and translation/DOM execution paths.
- Prefer small local guards and exact DOM types over broad assertions.

Commit boundary:

- Small `refactor(content): ...` or `refactor(types): ...` commits by module.

Verification:

- `pnpm compile`
- Focused tests for touched modules.
- `pnpm verify` before merging.

### Batch 4. Generic Heuristic Review

Do this only with concrete false positives or false negatives from manual regression.

Scope:

- Review `looksLikeSupplementalWrapper` and broad class-name matching such as `[class*="card"]`.
- Add or update fixture-backed tests before changing behavior.
- Prefer site profiles for site-specific DOM structures.

Verification:

- `pnpm test:content`
- `pnpm verify` if shared heuristics changed.

### Batch 5. Release Preparation

Do this only after Batches 0-4 are either complete or explicitly deferred.

Scope:

- Re-read `RELEASE.md`.
- Update `entrypoints/utils/releaseNotes.ts`.
- Run `pnpm verify`.
- Build the release zip.
- Run the release readiness check from `RELEASE.md`.
- Proceed with `release-it` only after readiness passes.

## Deferred Work

### 1. Continue Splitting `content.ts`

`entrypoints/content.ts` still mixes extension entry wiring, shortcuts, onboarding, video subtitle setup, dynamic translation behavior, and page-level event handling.

Target outcome:

- Move feature-specific wiring into smaller modules.
- Keep the entry file focused on orchestration.
- Preserve current user-visible behavior and keyboard/floating UI flows.

Suggested first slices:

- Dynamic translation lifecycle wiring.
- Video subtitle initialization.
- Onboarding/update-note initialization.
- Shortcut and pointer event handlers.

### 2. Finish The `compat.ts` To `siteProfiles/` Consolidation

This branch moved more site-specific target behavior into `siteProfiles/`, but `compat.ts` still exists as a compatibility facade.

Target outcome:

- Decide whether `compat.ts` remains only as a thin legacy export layer or disappears entirely.
- Move URL/domain normalization such as `getMainDomain` into a neutral utility if it is still shared.
- Make `replaceCompatFn` and `afterBilingualAppendCompatFn` profile-owned end to end.
- Remove ambiguity about whether new site behavior belongs in old compat maps or structured profiles.

Guardrails:

- Do not combine this with behavior changes for a specific website.
- Add profile-level tests before removing facade behavior.

### 3. Broaden Type Cleanup Beyond The Hot Path

This branch tightened the main DOM/translation execution path, but the whole project still has remaining `any` usage.

Target outcome:

- Audit remaining `any` in `entrypoints/main`, `entrypoints/utils`, composables, and tests.
- Replace high-risk public function inputs first.
- Prefer small guards and local types over broad assertions.
- Avoid mechanical churn in files unrelated to content detection or translation execution.

Suggested verification:

- `pnpm compile`
- Focused tests for any touched module.
- `pnpm verify` before merging.

### 4. Revisit Broad Generic Heuristics

Some generic heuristics remain intentionally untouched in this branch, especially wrapper and card-like matching.

Known area:

- `looksLikeSupplementalWrapper` and similar class-name heuristics can over-match broad selectors such as `[class*="card"]`.

Target outcome:

- Review false positives found during manual regression.
- Prefer fixture-backed adjustments over broad string-pattern edits.
- Keep clearly site-specific DOM behavior in site profiles.

### 5. Release Flow Work After Bug Fixes

Release work was not executed as part of this branch cleanup.

Target outcome:

- Re-read `RELEASE.md` before preparing the release.
- Update `entrypoints/utils/releaseNotes.ts` with user-facing notes for the final bug-fixed release.
- Run `pnpm verify`.
- Build the release zip.
- Run the release readiness check from `RELEASE.md`.
- Only then proceed with `release-it`.

### 6. Manual Regression Findings

Use this section to append concrete findings from manual testing before the next implementation round.

For each finding, record:

- Page URL or fixture name.
- Expected behavior.
- Actual behavior.
- Minimal HTML snippet or screenshot reference when available.
- Whether the fix should be generic, profile-specific, or release-process related.

#### Fixed: Ziggit Topic Reply Paragraphs With Inline Code

- Page URL: `https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822`
- Expected behavior: Discourse cooked reply paragraphs such as `That is the point of <code>export</code>...` and `found a workaround...` should be translated while user names, timestamps, buttons, and topic stats stay skipped.
- Actual behavior: Replies inserted outside the initial smart `contentRoot` were not picked up by dynamic supplemental scans.
- Regression coverage: `tests/fixtures/translation-target/ziggit-topic-thread.html`, `tests/fixtures/translation-target/ziggit-topic-thread.json`, and `tests/utils/autoTranslateTarget.test.ts`.
- Fix type: profile-specific Ziggit/Discourse cooked-content profile plus a generic dynamic-scan integration point for profile-owned expansion targets.
- Commit: `19c6382 fix(content): 修复 Ziggit 帖子回复漏翻`
