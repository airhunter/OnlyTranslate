# Project Instructions

## Git Commit Messages

When generating Git commit messages for this project, always use Conventional Commits because this project uses `release-it` and `@release-it/conventional-changelog` to generate versions and `CHANGELOG.md`.

Format:

```text
<type>(<scope>): <subject>
```

Rules:

- Use `feat` for new features.
- Use `fix` for bug fixes.
- Use `perf` for performance improvements.
- Use `docs`, `test`, `build`, `ci`, `refactor`, or `chore` when appropriate.
- Prefer a lowercase English scope, such as `options`, `popup`, `service`, `content`, `ui`, or `release`.
- Write the subject in concise Chinese.
- Commit message descriptions and notes must be written in Chinese.
- Do not end the subject with punctuation.
- For breaking changes, use `<type>!: <subject>` or add a `BREAKING CHANGE:` footer.
- Never generate commit messages without a Conventional Commit type prefix.
- Output only the final commit message when asked to generate a commit message.

## Engineering Workflow

Before implementation:

- State key assumptions when the task touches content detection, translation insertion, DOM mutation, layout behavior, release flow, or user-visible behavior.
- If a requirement has multiple materially different interpretations, explain the options and ask before implementing.
- Prefer the smallest change that correctly solves the current problem; “smallest” means the lowest-risk, least-complex implementation within the required quality and scope boundaries, not merely the fewest lines of code.
- Keep edits surgical: only change files required by the task, and do not refactor, reformat, rename, or clean up unrelated code.
- Match existing project style and local patterns.
- Before adding code, dependencies, configuration, abstractions, or extension points, prefer existing implementations, standard libraries, platform-native capabilities, and existing dependencies.
- Do not sacrifice correctness, input validation, error handling, security, accessibility, or necessary tests to reduce code size or implementation effort.
- When these principles compete, preserve the quality baseline and scope boundary first, then choose the least complex implementation.
- If unrelated issues are found, mention them in the response instead of changing them.

For multi-step tasks, briefly define the success criteria and verification plan before editing.

## Testing Expectations

- Run the smallest relevant checks for the changed area.
- Run broader checks when shared modules, translation detection, DOM insertion, or build configuration are changed.
- Use `pnpm test:content` for changes around content detection, smart/full translation scope, translation target selection, site profiles, dynamic DOM collection, or bilingual append targets.
- Use `pnpm verify` before release-oriented changes are considered ready; it runs type checking and the full test suite.
- Add or update focused tests for behavior changes.
- Prefer fixture-driven regression tests under `tests/fixtures/translation-target` for static webpage structure and target-selection behavior.
- Keep dynamic DOM, MutationObserver, append-target, and translation insertion behavior in code tests under `tests/utils`.
- If automated validation is not practical, provide a concise manual verification checklist.

## Release Workflow

- When working on a release, follow `RELEASE.md` as the source of truth.
- Keep `release-it` as the version, tag, changelog, and GitHub Release workflow.
- When preparing a release, update `entrypoints/utils/releaseNotes.ts` for the user-facing update notes.
- User-facing release notes should usually contain `3-5` concise items focused on visible features, improvements, and fixes.
- Before publishing, run `pnpm verify`, then build the zip and run the release readiness check described in `RELEASE.md`.

## Content Detection Rule Changes

Rules around `contentDetector`, `contentFilter`, Readability-like heuristics, and smart/full translation scope are high-impact.

Before changing these rules:

- Discuss the proposed approach with the user first.
- Explain the expected matching path, affected pages, fallback behavior, and regression risks.
- Do not guess a website's DOM structure; if the structure is unclear, ask the user for the relevant DOM or page details first.
- Do not change generic detection/filtering rules just to fix one site-specific issue.
- Prefer site profiles for clearly site-specific DOM behavior.
- Add or update fixture-driven regression tests in `tests/fixtures/translation-target` for static page structures. Each new fixture should include the minimal HTML sample and JSON expectations for included/excluded translation targets, content root, or relevant text assertions.
- Add focused code tests when the behavior involves dynamic DOM updates, MutationObserver scans, append targets, or actual translation insertion.
- Run `pnpm test:content` after content detection or site profile changes.
- For complex dynamic pages such as live news pages, treat them as a separate design topic before implementing.

## Reading Review Corpus Workflow

- Use `pnpm review:reading` for the local review workspace. Follow `docs/testing/reading-review.md` and the versioned policy in `tests/corpus/annotation-policy.md`.
- For a reported untranslated or overtranslated page, register the URL and issue context in `tests/corpus/pages.json`, then preserve the affected rendered state before fixing it. If capture is blocked or incomplete, record the limitation and use the available DOM fixture; never count a blocked capture as a pass.
- Before changing recognition behavior, preserve the released baseline on the same snapshot. After the change, rerun affected pages; shared recognition changes require the complete available corpus comparison in addition to `pnpm test:content`.
- Lock a baseline to a verified published artifact and its corresponding source commit. Keep its settings, artifact hash, snapshot hash, target coverage, actual translation completion, and failures. Never use the working tree as an unlabeled release baseline.
- A new or removed target is a review item, not an automatic improvement or regression. Only user-confirmed decisions are expected behavior. Agents may suggest assessments but must not confirm real corpus annotations on the user's behalf.
- Store decisions with snapshot identity, policy version, reason, and revision history. Do not alter expected behavior to make a run pass. Pending and unreviewed material must not be represented as correct or included in an overall accuracy score.
- UI/API tests of decisions must use an isolated temporary corpus, never the user's real annotations.
- Formal WXT build/zip commands automatically run the saved human-decision check (`pnpm test:reading`) before building. Dev serve/hot updates are exempt. The check rebuilds the current collector and replays every snapshot with active confirmed decisions, including historical snapshots; never substitute a cached run or suppress a failure. Missing snapshots/assets, invalid anchors, no confirmed decisions, changed inputs, and unmet decisions block the build. See the generated report in the local data directory's `checks/` folder; do not edit decisions or recognition behavior merely to make packaging pass.
- A user may explicitly accept an identified known limitation without changing its content verdict. Record that decision separately in `tests/corpus/accepted-issues.json`, with the user's reason, confirmation date, snapshot/HTML/text identity, decision ID/policy version and exact accepted coverage. Only that matching failure becomes nonblocking; it remains an unmet expectation in reports and is not counted as fixed. A new decision, changed coverage or revoked acceptance removes the exception. Never let acceptance bypass integrity errors, waive other failures, or create/revoke real acceptances without the user's instruction. This is the only explicit exception to blocking on unmet decisions above.
- Before removing a site profile, compare the release baseline, the candidate with the profile, and the candidate with only that profile disabled. Cover its relevant page types and dynamic states, review all resulting differences, verify confirmed expectations and performance, and obtain the user's decision.
- Keep corpus metadata and confirmed decisions under version control. Full page snapshots, screenshots, assets, and run artifacts stay in the configured local data directory. New captures and releases add records; they never overwrite previous baseline runs.
