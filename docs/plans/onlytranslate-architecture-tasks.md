# OnlyTranslate Architecture Follow-up Tasks

This document records the follow-up work inspired by reviewing `read-frog` and
`kiss-translator`. The goal is to keep OnlyTranslate focused and restrained while
absorbing useful architecture patterns from both projects.

## Summary

`read-frog` is useful mainly as a reference for computed-style based layout
handling, AI context-aware translation, batching, and subtitle processing.

`kiss-translator` is useful mainly as a reference for rule schema design:
decomposing site behavior into orthogonal fields such as roots, targets, ignore
selectors, keep selectors, and layout/style fixes.

The two most important lessons for OnlyTranslate are:

- Move common bilingual insertion layout fixes into a generic insertion
  strategy instead of accumulating per-site patches.
- Make site profiles more declarative and data-shaped, with functions reserved
  for complex escape hatches.

## TODO

- [x] P0: Generic bilingual insertion layout strategy
  - Done in `1649ee9 fix(content): 通用化双语插入布局`.
- [x] P0: Declarative SiteProfile schema
  - Done in `277d036 refactor(content): 支持声明式站点目标规则`.
  - V1 includes `rootsSelector`, `targetSelector`, `ignoreSelector`,
    `keepSelector`, and `targetStrategy`. `forceBlockSelector` is deferred until
    the insertion path has a concrete implementation and tests.
- [x] P0: `keepSelector` and inline protection
  - Done in `d783a30 feat(content): 支持站点级 keepSelector`.
  - Global defaults intentionally protect `code, kbd, samp, var, math, .math`.
    `a:has(code)` is not a global default; profiles can add it if a site needs
    whole code links preserved in translated copies.
- [ ] P1: Subtitle cleaning, deduplication, and segmentation
- [ ] P1: Batch translation queue with fallback
- [ ] P1: AI context-aware translation
- [ ] P2: Site rule dataization and remote subscription

## P0: Generic Bilingual Insertion Layout Strategy

Status: Done.

### Background

The HuggingFace flex heading issue exposed a weakness in the current approach:
layout repair can end up living in a per-site `afterBilingualAppend` hook even
when the problem is generic. `read-frog` shows a better direction: use
`getComputedStyle` around the translation walker / insertion path to decide
whether inserted translation content should behave as block or inline content.

This does not mean replacing OnlyTranslate's target detection. It means using
computed style at the insertion stage, where layout information is directly
relevant.

### Reference Code

- OnlyTranslate insertion flow:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/trans.ts`
- OnlyTranslate append-target decisions:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/translationTarget/decision.ts`
- Current HuggingFace-specific layout fix:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/siteProfiles/huggingFace.ts`
- read-frog DOM traversal / walker area:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/utils/host/dom/traversal.ts`
- read-frog page translation manager:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/entrypoints/host.content/translation-control/page-translation.ts`

### Proposed Approach

Add a small internal layout resolver, for example
`resolveBilingualInsertionLayout` or `resolveAppendDisplay`.

The resolver should inspect:

- Target element computed display.
- Parent element computed display.
- Whether the parent is flex/grid.
- Whether the target is inline, inline-block, block, heading, or already a
  layout container.

Initial policy:

- For normal block-flow parents, inserted bilingual content can prefer block
  display when that prevents inline crowding.
- For flex/grid parents, avoid blindly forcing block display because it can
  turn the translation into a competing flex/grid item or distort alignment.
- Keep site profile hooks as overrides for genuinely site-specific layouts.

### Acceptance Criteria

- HuggingFace-style flex heading issues can be handled by the generic strategy.
- Existing bilingual insertion behavior does not regress.
- Add focused tests for flex parent, normal block parent, inline text, and
  heading-like targets.
- Run `pnpm test:content`.

## P0: Declarative SiteProfile Schema

Status: Done.

### Background

OnlyTranslate currently expresses most site behavior through TypeScript
functions such as `select`, `skipTarget`, `allowTarget`, `appendTarget`, and
`afterBilingualAppend`. This is flexible but makes simple rules harder to scan,
compare, and eventually externalize.

`kiss-translator` provides a useful schema model. Its rule fields are orthogonal:
`rootsSelector`, `selector`, `ignoreSelector`, `keepSelector`, `blockSelector`,
style fixes, and auto-scan behavior are separate knobs.

OnlyTranslate should not expose the full expert-rule system to users now. The
first step is only to make internal profiles more data-shaped.

### Reference Code

- Site profile types:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/siteProfiles/types.ts`
- Site profile registry:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/siteProfiles/index.ts`
- Translation target collection:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/translationTarget/collect.ts`
- Translation target decision:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/translationTarget/decision.ts`
- kiss-translator rule schema:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/config/rules.js`

### Proposed Approach

Extend `SiteProfile` with declarative fields:

- `rootsSelector`: limits translation to one or more content roots.
- `targetSelector`: declares likely translation targets.
- `ignoreSelector`: declares subtree or self skips.
- `keepSelector`: declares inline content that should be protected.
- `targetStrategy`: keeps existing concepts such as profile-first behavior.

Function hooks should remain available:

- `allowTarget` for dynamic allow logic.
- `skipTarget` for dynamic skip logic.
- `appendTarget` for unusual insertion targets.
- `afterBilingualAppend` for rare post-insertion fixes.

Start by migrating only simple profiles. Do not force complex profiles into a
declarative shape too early.

V1 note: `forceBlockSelector` is intentionally not part of the implemented
schema yet. Add it only when it is wired to the insertion path and covered by
layout tests.

### Acceptance Criteria

- At least two or three simple profiles use declarative fields.
- Existing fixture expectations remain unchanged.
- Complex profiles can still use function hooks.
- Run `pnpm test:content`.

## P0: keepSelector and Inline Protection

Status: Done.

### Background

OnlyTranslate has strong logic for choosing translation targets, but it lacks a
clear first-class concept for inline fragments that should be preserved during
rich-text translation.

`kiss-translator` uses `keepSelector` for cases such as code, math, and inline
technical fragments. This is especially important for docs, programming blogs,
API references, equations, and pages with inline keyboard shortcuts.

### Reference Code

- Rich text extraction and protected inline handling:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/dom.ts`
- Translation insertion:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/trans.ts`
- Target decisions:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/translationTarget/decision.ts`
- kiss-translator rule schema:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/config/rules.js`
- kiss-translator translator implementation:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/libs/translator.js`

### Proposed Approach

Define a default keep selector. Candidate defaults:

```text
code, kbd, samp, var, math, .math
```

Then make the rich-text extraction path explicitly consume this selector.
Profiles should be able to add or override keep selectors where necessary.

The implementation should preserve the structure and visible text of protected
inline elements while still allowing surrounding prose to be translated.

V1 note: `a:has(code)` is deliberately not global because it preserves the whole
link shell in translated copies and can leave surrounding link prose untranslated.
Site profiles can opt into it when that tradeoff is desirable.

### Acceptance Criteria

- Add fixture coverage for inline code, code links, math-like elements, and
  mixed prose.
- Protected inline fragments are not broken or translated into unusable markup.
- Existing rich-text translation behavior does not regress.
- Run `pnpm test:content`.

## P1: Subtitle Cleaning, Deduplication, and Segmentation

### Background

OnlyTranslate already supports video subtitle translation, but YouTube json3 /
timedtext handling can be more robust. `kiss-translator` has detailed logic for
cleaning zero-width characters, deduplicating repeated subtitle events, and
preserving timing information. `read-frog` has a separate segmentation pipeline
with AI segmentation fallback.

### Reference Code

- OnlyTranslate subtitle parser:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/video/parser.ts`
- OnlyTranslate subtitle manager:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/video/manager.ts`
- kiss-translator YouTube subtitle processing:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/subtitle/youtubeSubtitleProcessing.js`
- read-frog segmentation pipeline:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/entrypoints/subtitles.content/segmentation-pipeline.ts`

### Proposed Approach

Start in the parser layer:

- Strip `U+200B` zero-width pollution.
- Deduplicate repeated subtitles using time plus visible text.
- Preserve timing breaks where possible so adjacent segments do not get glued
  incorrectly.
- Improve json3 flattening before translation grouping.

Then evaluate the manager layer:

- Tune pause threshold.
- Tune max words per group.
- Consider max duration per group.
- Keep the current simple design unless tests show it is too weak.

### Acceptance Criteria

- Add json3 and VTT fixture tests.
- Repeated YouTube subtitle events do not render duplicate translations.
- Short pauses merge naturally; long pauses split naturally.
- Existing video subtitle tests pass.

## P1: Batch Translation Queue with Fallback

### Background

OnlyTranslate's current queue is mostly a concurrency gate. `read-frog` and
`kiss-translator` both batch compatible translation requests to reduce API
overhead and cost. For LLM providers, batching can significantly reduce request
count when translating many page nodes.

### Reference Code

- OnlyTranslate queue:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/utils/translateQueue.ts`
- OnlyTranslate translation API entrypoint:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/utils/translateApi.ts`
- read-frog translation queue:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/entrypoints/background/translation-queues.ts`
- kiss-translator API gateway:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/apis/index.js`

### Proposed Approach

Design this first for LLM or OpenAI-compatible providers only.

Batch key should include:

- Service.
- Model or custom model.
- Source language.
- Target language.
- Prompt style.
- Page or subtitle context signature.

Batch controls:

- `batchDelay`
- `maxItems`
- `maxCharacters`

Prompt format should request one numbered output per numbered input. If parsing
fails, result count mismatches, or the batch request fails, fallback to
individual requests.

### Acceptance Criteria

- Compatible requests batch together.
- Different languages, models, providers, or contexts do not mix.
- Batch failure falls back to individual translation.
- Add queue tests around deduplication, fallback, and parse mismatch.

## P1: AI Context-aware Translation

### Background

OnlyTranslate currently passes mostly `document.title` as context. `read-frog`
uses page title, page content, summaries, and subtitle context to improve LLM
translation quality. This fits OnlyTranslate's core mission if kept lightweight
and low-UI.

### Reference Code

- OnlyTranslate translation API:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/utils/translateApi.ts`
- OnlyTranslate service message type:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/service/types.ts`
- read-frog translation queues:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/entrypoints/background/translation-queues.ts`
- read-frog summary logic:
  `/Users/wuwenjie/Documents/IdeaProjects/read-frog/src/utils/content/summary.ts`

### Proposed Approach

Introduce a lightweight context object:

- `pageTitle`
- `contentSnippet`
- optional `contentSummary`
- optional `subtitleContext`

Keep this internal at first. Avoid adding a complex settings surface. Summary
generation should be cached so repeated translations on the same page do not
burn extra tokens.

Non-LLM services should ignore the extra context.

### Acceptance Criteria

- LLM requests can receive structured context.
- Non-LLM services are unaffected.
- Summary/context cache avoids repeated generation.
- Add tests for context propagation and cache behavior.

## P2: Site Rule Dataization and Remote Subscription

### Background

Hardcoded TypeScript profiles mean site DOM changes require extension releases.
`kiss-translator` mitigates this through rule subscriptions and sharing.
OnlyTranslate should not jump straight into a public rule ecosystem, but the
profile schema should be designed so that future dataization is possible.

### Reference Code

- OnlyTranslate profiles:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/entrypoints/main/siteProfiles`
- Content detection architecture:
  `/Users/wuwenjie/Documents/IdeaProjects/OnlyTranslate/docs/architecture/content-detection.md`
- kiss-translator rule schema:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/config/rules.js`
- kiss-translator sync:
  `/Users/wuwenjie/Documents/IdeaProjects/kiss-translator/src/libs/sync.js`

### Proposed Approach

Do not implement remote subscription until the internal declarative schema has
stabilized.

Possible phases:

1. Make local profile definitions JSON-shaped where possible.
2. Move simple built-in rules into a static internal data file.
3. Add versioned rule loading.
4. Evaluate remote subscription with signing, rollback, compatibility, and
   explicit user opt-in.

Security boundaries:

- No remote JavaScript.
- No eval-style hooks.
- Only declarative selectors and limited style/layout directives.
- Functions remain local code only.

### Acceptance Criteria

- Produce a design before implementation.
- Identify which fields can be remote data and which must remain local code.
- Define versioning and rollback strategy.
- Define safety limits for selectors and style directives.

## Suggested Processing Order

Completed P0 foundation work:

1. Generic bilingual insertion layout strategy.
2. Declarative SiteProfile schema.
3. `keepSelector` and inline protection.

Recommended remaining order:

1. Subtitle cleaning and segmentation.
2. Batch translation queue.
3. AI context-aware translation.
4. Rule dataization and remote subscription.

This keeps the next work focused on visible quality and reliability before
expanding larger systems such as batching, context, or remote rules.
