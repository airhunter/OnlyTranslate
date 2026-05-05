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

## Release Workflow

- When working on a release, follow `RELEASE.md` as the source of truth.
- Keep `release-it` as the version, tag, changelog, and GitHub Release workflow.
- When preparing a release, update `entrypoints/utils/releaseNotes.ts` for the user-facing update notes.
- User-facing release notes should usually contain `3-5` concise items focused on visible features, improvements, and fixes.
- Before publishing, run the release readiness checks described in `RELEASE.md`.
