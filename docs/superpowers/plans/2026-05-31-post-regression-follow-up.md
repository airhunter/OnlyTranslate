# Post Regression Follow-Up Backlog

> This backlog is intentionally deferred until manual regression testing is complete and all release-blocking bugs found during that testing are fixed.

## Trigger

Start this backlog only after:

- Manual regression testing for the current content architecture branch is complete.
- All bugs found during manual regression are fixed and verified.
- `pnpm test:content` and `pnpm verify` pass on the bug-fixed branch.

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

