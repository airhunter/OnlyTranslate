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
