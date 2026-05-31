# Content Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move site-specific content detection behavior back into site profiles while tightening translation DOM utilities, constants, heuristics, and state ownership.

**Architecture:** `siteProfiles/` becomes the formal owner of site-specific target expansion and nested merge behavior. Generic `translationTarget/` code calls optional profile hooks but contains no concrete site domain checks. Translation execution keeps current behavior while shared constants, typed DOM inputs, callback-based first-line translation, and centralized state reduce coupling.

**Tech Stack:** TypeScript, WXT, Vitest, happy-dom, pnpm, existing `translationTarget/`, `siteProfiles/`, `dom.ts`, and `trans.ts` modules.

---

## File Structure

- Create: `entrypoints/main/translationTarget/constants.ts`  
  Owns shared DOM marker constants such as `TRANSLATED_ATTR` and `BILINGUAL_CONTENT_CLASS`.
- Modify: `entrypoints/main/siteProfiles/types.ts`  
  Adds optional `expandTarget` and `shouldKeepNestedTarget` hooks.
- Modify: `entrypoints/main/siteProfiles/index.ts`  
  Exports hook maps generated from `siteProfiles`.
- Modify: `entrypoints/main/siteProfiles/github.ts`  
  Owns GitHub Markdown unit expansion and nested list merge behavior.
- Modify: `entrypoints/main/translationTarget/collect.ts`  
  Calls profile expansion hooks and profile nested merge hooks; removes GitHub domain-specific functions.
- Modify: `entrypoints/main/translationTarget/decision.ts` and `entrypoints/main/translationTarget/dynamic.ts`  
  Imports shared translation marker constants.
- Modify: `entrypoints/main/translationTarget/scanContext.ts`  
  Imports shared translation marker constants for managed-node/UI subtree detection.
- Modify: `entrypoints/main/dom.ts`  
  Tightens key node types, optimizes nested-node filtering, removes direct first-line IPC, and adds `translateFirstLineText` callback.
- Modify: `entrypoints/main/trans.ts`  
  Imports storage explicitly, injects first-line callback, centralizes state, uses shared constants, and limits HTML beautify.
- Modify: `entrypoints/utils/contentFilter.ts`  
  Removes GitHub links from generic share/social noise.
- Test: `tests/utils/siteProfiles.test.ts`  
  Verifies profile hook registry and the "no GitHub in generic collect" architecture boundary.
- Test: `tests/utils/translationTarget.test.ts`  
  Verifies GitHub list items still resolve through the full target pipeline.
- Test: `tests/utils/contentFilter.test.ts`  
  Verifies GitHub links in technical content are not generic social noise.
- Test: `tests/utils/grabAllNode.test.ts`  
  Verifies first-line callback injection and short text identifiers such as `web3`, `step_2`, and `act_1`.
- Test: `tests/utils/autoTranslateTarget.test.ts`  
  Existing dynamic/bilingual tests protect translation insertion and dynamic scanning behavior.

---

### Task 1: Baseline And Profile Hook Contracts

**Files:**
- Modify: `entrypoints/main/siteProfiles/types.ts`
- Modify: `entrypoints/main/siteProfiles/index.ts`
- Modify: `tests/utils/siteProfiles.test.ts`

- [ ] **Step 1: Run baseline content tests**

Run:

```bash
pnpm test:content
```

Expected: PASS before changes. If this fails before edits, stop and record the failing test names before continuing.

- [ ] **Step 2: Write failing hook registry tests**

Append these imports and tests to `tests/utils/siteProfiles.test.ts`:

```ts
import {
  siteProfileExpandTargetFns,
  siteProfileShouldKeepNestedTargetFns
} from '@/entrypoints/main/siteProfiles'

it('registers GitHub target expansion hooks', () => {
  expect(siteProfileExpandTargetFns['github.com']).toBeTypeOf('function')
  expect(siteProfileShouldKeepNestedTargetFns['github.com']).toBeTypeOf('function')
})
```

- [ ] **Step 3: Run hook registry test and verify it fails**

Run:

```bash
pnpm test tests/utils/siteProfiles.test.ts
```

Expected: FAIL with an export or undefined-map error for `siteProfileExpandTargetFns`.

- [ ] **Step 4: Add hook types**

In `entrypoints/main/siteProfiles/types.ts`, add imports and types next to the existing target hook types:

```ts
export type SiteProfileExpandTarget = (node: Element, context: TranslationTargetContext) => Element[] | false | undefined;
export type SiteProfileShouldKeepNestedTarget = (parent: Element, child: Element, context: TranslationTargetContext) => boolean;
```

Extend `SiteProfile`:

```ts
export interface SiteProfile {
    id: string;
    domains: string[];
    targetStrategy?: 'profile-first';
    select?: SiteProfileSelect;
    replace?: SiteProfileReplace;
    supplemental?: SiteProfileSupplemental;
    afterBilingualAppend?: SiteProfileAfterBilingualAppend;
    allowTarget?: SiteProfileTargetAllow;
    skipTarget?: SiteProfileTargetSkip;
    appendTarget?: SiteProfileAppendTarget;
    expandTarget?: SiteProfileExpandTarget;
    shouldKeepNestedTarget?: SiteProfileShouldKeepNestedTarget;
}
```

Add map interfaces:

```ts
export interface ExpandTargetCompatFn {
    [domain: string]: SiteProfileExpandTarget;
}

export interface ShouldKeepNestedTargetCompatFn {
    [domain: string]: SiteProfileShouldKeepNestedTarget;
}
```

- [ ] **Step 5: Generate hook maps from profiles**

In `entrypoints/main/siteProfiles/index.ts`, extend the type import:

```ts
import type {
    AfterBilingualAppendCompatFn,
    ExpandTargetCompatFn,
    ReplaceCompatFn,
    SelectCompatFn,
    ShouldKeepNestedTargetCompatFn,
    SiteProfile,
    SupplementalCompatFn
} from './types';
```

Extend the type re-export block:

```ts
    SiteProfileExpandTarget,
    SiteProfileShouldKeepNestedTarget,
    ExpandTargetCompatFn,
    ShouldKeepNestedTargetCompatFn,
```

Add map generation after `siteProfileAfterBilingualAppendFns`:

```ts
export const siteProfileExpandTargetFns: ExpandTargetCompatFn = siteProfiles.reduce<ExpandTargetCompatFn>((map, profile) => {
    if (!profile.expandTarget) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.expandTarget;
    }

    return map;
}, {});

export const siteProfileShouldKeepNestedTargetFns: ShouldKeepNestedTargetCompatFn = siteProfiles.reduce<ShouldKeepNestedTargetCompatFn>((map, profile) => {
    if (!profile.shouldKeepNestedTarget) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.shouldKeepNestedTarget;
    }

    return map;
}, {});
```

- [ ] **Step 6: Run hook registry test and verify current failure moves to GitHub hook absence**

Run:

```bash
pnpm test tests/utils/siteProfiles.test.ts
```

Expected: FAIL because `githubProfile` does not define `expandTarget` or `shouldKeepNestedTarget` yet.

- [ ] **Step 7: Commit hook contract scaffolding**

Run:

```bash
git add entrypoints/main/siteProfiles/types.ts entrypoints/main/siteProfiles/index.ts tests/utils/siteProfiles.test.ts
git commit -m "refactor(content): 增加站点目标扩展接口"
```

Expected: commit succeeds. The branch may still have failing tests until Task 2 implements GitHub hooks.

---

### Task 2: GitHub Expansion Hooks And Generic Collect Integration

**Files:**
- Modify: `entrypoints/main/siteProfiles/github.ts`
- Modify: `entrypoints/main/translationTarget/collect.ts`
- Modify: `tests/utils/translationTarget.test.ts`
- Modify: `tests/utils/siteProfiles.test.ts`

- [ ] **Step 1: Write architecture boundary and GitHub pipeline tests**

Add to `tests/utils/siteProfiles.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

it('keeps GitHub domain checks out of the generic collect pipeline', () => {
  const source = readFileSync(resolve(process.cwd(), 'entrypoints/main/translationTarget/collect.ts'), 'utf8')

  expect(source).not.toMatch(/github\.com/i)
  expect(source).not.toMatch(/GitHub/)
})
```

Add to `tests/utils/translationTarget.test.ts`:

```ts
it('resolves GitHub markdown list items through profile expansion', () => {
  Object.defineProperty(window, 'location', {
    value: new URL('https://github.com/HKUDS/nanobot'),
    configurable: true
  })
  document.body.innerHTML = `
    <main>
      <article class="markdown-body entry-content">
        <h1 id="readme-title">Nanobot README</h1>
        <ul id="news-list">
          <li id="news-1">Released v0.2.0 with sustained objectives across turns and a real agent-loop refactor.</li>
          <li id="news-2">Goal mode supports visible multi-step progress and long-horizon missions in chat.</li>
        </ul>
      </article>
    </main>
  `

  const ids = resolveAutoTranslationTarget('smart').nodes.map(node => node.id)

  expect(ids).toContain('readme-title')
  expect(ids).toContain('news-1')
  expect(ids).toContain('news-2')
  expect(ids).not.toContain('news-list')
})
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
pnpm test tests/utils/siteProfiles.test.ts tests/utils/translationTarget.test.ts
```

Expected: FAIL because `collect.ts` still contains GitHub-specific code and GitHub profile hooks are absent.

- [ ] **Step 3: Add GitHub expansion hooks**

In `entrypoints/main/siteProfiles/github.ts`, add this import:

```ts
import { collectDomTextUnits } from '@/entrypoints/main/translationTarget/unitizer';
```

Inside `githubProfile`, add:

```ts
    expandTarget: (node) => {
        return collectGitHubMarkdownUnits(node);
    },
    shouldKeepNestedTarget: (parent, child) => {
        return isGitHubMarkdownListContainer(parent) && isGitHubMarkdownListItemOf(child, parent);
    },
```

Add helper functions near the existing Markdown helpers:

```ts
function collectGitHubMarkdownUnits(node: Element): Element[] | false {
    const roots = getGitHubMarkdownRoots(node);
    if (roots.length === 0) return false;

    const units = roots.flatMap(root => collectDomTextUnits(root));
    return units.length > 0 ? units : false;
}

function getGitHubMarkdownRoots(node: Element): Element[] {
    if (node.matches('.markdown-body')) return [node];
    return Array.from(node.querySelectorAll<Element>('.markdown-body'));
}

function isGitHubMarkdownListContainer(element: Element): boolean {
    return element.matches('ul, ol') && Boolean(element.closest('.markdown-body'));
}

function isGitHubMarkdownListItemOf(item: Element, list: Element): boolean {
    return item.tagName.toLowerCase() === 'li'
        && item.parentElement === list
        && Boolean(item.closest('.markdown-body'));
}
```

- [ ] **Step 4: Integrate profile expansion in collect.ts**

In `entrypoints/main/translationTarget/collect.ts`, remove the `collectDomUnitTargets(root)` loop and add this after the existing candidate collection loops:

```ts
    for (const candidate of collectProfileExpandedTargets(root, candidates, context)) {
        candidates.push(candidate);
    }
```

Add helper functions above `dedupeCandidates`:

```ts
function collectProfileExpandedTargets(
    root: ParentNode,
    candidates: TranslationTargetCandidate[],
    context: TranslationTargetContext
): TranslationTargetCandidate[] {
    const profile = getCurrentSiteProfile();
    if (!profile?.expandTarget) return [];

    const expansionSources = new Set<Element>();
    if (root instanceof Element) expansionSources.add(root);
    for (const candidate of candidates) expansionSources.add(candidate.node);

    const expanded: TranslationTargetCandidate[] = [];
    for (const source of expansionSources) {
        const nodes = profile.expandTarget(source, context);
        if (!nodes) continue;

        for (const node of nodes) {
            expanded.push({
                node,
                source: 'dom-unit',
                reasons: ['site-profile-expand-target']
            });
        }
    }

    return expanded;
}
```

Change `collectTranslationTargets` to pass context into merge:

```ts
    return mergeTranslationDecisions(decisions, context);
```

Replace `mergeTranslationDecisions` with:

```ts
function mergeTranslationDecisions(
    decisions: TranslationTargetDecision[],
    context: TranslationTargetContext
): TranslationTargetDecision[] {
    const unique = Array.from(new Map(decisions.map(decision => [decision.target, decision])).values());
    return unique.filter(decision => {
        if (unique.some(other =>
            decision !== other
            && decision.target.contains(other.target)
            && shouldKeepNestedTarget(decision.target, other.target, context)
        )) {
            return false;
        }

        return !unique.some(other => {
            if (decision === other || !other.target.contains(decision.target)) return false;
            return !shouldKeepNestedTarget(other.target, decision.target, context);
        });
    });
}

function shouldKeepNestedTarget(parent: Element, child: Element, context: TranslationTargetContext): boolean {
    return getCurrentSiteProfile()?.shouldKeepNestedTarget?.(parent, child, context) ?? false;
}
```

Remove these old GitHub-specific helpers from `collect.ts`:

```ts
collectDomUnitTargets
getGitHubMarkdownListItems
isGitHubMarkdownListContainer
isGitHubMarkdownListItemOf
```

- [ ] **Step 5: Ensure supplemental wrapper expansion no longer uses GitHub-specific logic**

In `expandSupplementalReadingUnit`, delete this old branch:

```ts
    const githubMarkdownListItems = getGitHubMarkdownListItems(unit);
    if (githubMarkdownListItems.length > 0) return githubMarkdownListItems;
```

Do not replace it inside `expandSupplementalReadingUnit`; Task 2 expansion happens before decisions through `collectProfileExpandedTargets`, keeping the original candidate available for merge.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm test tests/utils/siteProfiles.test.ts tests/utils/translationTarget.test.ts tests/utils/autoTranslateTargetFixtures.test.ts
```

Expected: PASS. The architecture test confirms `collect.ts` no longer contains GitHub-specific text.

- [ ] **Step 7: Commit GitHub migration**

Run:

```bash
git add entrypoints/main/siteProfiles/github.ts entrypoints/main/translationTarget/collect.ts tests/utils/siteProfiles.test.ts tests/utils/translationTarget.test.ts
git commit -m "refactor(content): 将 GitHub 目标拆分迁回站点规则"
```

Expected: commit succeeds.

---

### Task 3: Generic Content Filter Noise Boundaries

**Files:**
- Modify: `entrypoints/utils/contentFilter.ts`
- Modify: `tests/utils/contentFilter.test.ts`

- [ ] **Step 1: Write failing GitHub-link content test**

Add to `tests/utils/contentFilter.test.ts`:

```ts
it('keeps technical source links to GitHub as readable content', () => {
  const element = renderElement(`
    <section class="project-source">
      <a href="https://github.com/airhunter/OnlyTranslate">GitHub repository</a>
      <p>Read the source code and installation notes before changing the extension build pipeline.</p>
    </section>
  `)

  expect(getContentFilterDecision(element)).toBe('keep')
  expect(shouldSkipContentBlock(element)).toBe(false)
})
```

- [ ] **Step 2: Run content filter test and verify it fails**

Run:

```bash
pnpm test tests/utils/contentFilter.test.ts
```

Expected: FAIL because `github` / `github.com` still count as generic share/social noise.

- [ ] **Step 3: Remove GitHub from generic social noise**

In `entrypoints/utils/contentFilter.ts`, change:

```ts
const SHARE_PATTERN = /\b(share|social|facebook|linkedin|twitter|x-platform|x platform|x\.com|medium|youtube|instagram|threads|mastodon|bluesky|github)\b/i;
const SOCIAL_LINK_PATTERN = /\b(facebook\.com|linkedin\.com|twitter\.com|x\.com|medium\.com|youtube\.com|youtu\.be|instagram\.com|threads\.net|mastodon\.social|bsky\.app|github\.com)\b/i;
```

to:

```ts
const SHARE_PATTERN = /\b(share|social|facebook|linkedin|twitter|x-platform|x platform|x\.com|medium|youtube|instagram|threads|mastodon|bluesky)\b/i;
const SOCIAL_LINK_PATTERN = /\b(facebook\.com|linkedin\.com|twitter\.com|x\.com|medium\.com|youtube\.com|youtu\.be|instagram\.com|threads\.net|mastodon\.social|bsky\.app)\b/i;
```

- [ ] **Step 4: Run content filter tests**

Run:

```bash
pnpm test tests/utils/contentFilter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit filter boundary fix**

Run:

```bash
git add entrypoints/utils/contentFilter.ts tests/utils/contentFilter.test.ts
git commit -m "fix(content): 避免 GitHub 链接被通用社交过滤误伤"
```

Expected: commit succeeds.

---

### Task 4: Shared Translation Marker Constants

**Files:**
- Create: `entrypoints/main/translationTarget/constants.ts`
- Modify: `entrypoints/main/trans.ts`
- Modify: `entrypoints/main/translationTarget/decision.ts`
- Modify: `entrypoints/main/translationTarget/dynamic.ts`
- Modify: `entrypoints/main/translationTarget/scanContext.ts`

- [ ] **Step 1: Create shared constants**

Create `entrypoints/main/translationTarget/constants.ts`:

```ts
export const TRANSLATED_ATTR = 'data-fr-translated';
export const TRANSLATED_ID_ATTR = 'data-fr-node-id';
export const BILINGUAL_CONTENT_CLASS = 'only-translate-bilingual-content';
export const BILINGUAL_WRAPPER_CLASS = 'only-translate-bilingual';
```

- [ ] **Step 2: Replace local constants in decision.ts**

In `entrypoints/main/translationTarget/decision.ts`, add:

```ts
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
```

Remove the local declarations:

```ts
const TRANSLATED_ATTR = 'data-fr-translated';
const BILINGUAL_CONTENT_CLASS = 'only-translate-bilingual-content';
```

- [ ] **Step 3: Replace local constants in dynamic.ts**

In `entrypoints/main/translationTarget/dynamic.ts`, add:

```ts
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
```

Remove the local declarations for the same constants.

- [ ] **Step 4: Replace literal translation selectors in scanContext.ts**

In `entrypoints/main/translationTarget/scanContext.ts`, add:

```ts
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
```

Change:

```ts
if (element.closest('.only-translate-bilingual-content, [data-fr-translated="true"], .notranslate, [translate="no"], [hidden], [aria-hidden="true"]')) return true;
```

to:

```ts
if (element.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"], .notranslate, [translate="no"], [hidden], [aria-hidden="true"]`)) return true;
```

- [ ] **Step 5: Replace local constants in trans.ts**

In `entrypoints/main/trans.ts`, add:

```ts
import {
    BILINGUAL_CONTENT_CLASS,
    BILINGUAL_WRAPPER_CLASS,
    TRANSLATED_ATTR,
    TRANSLATED_ID_ATTR
} from '@/entrypoints/main/translationTarget/constants';
```

Remove the local declarations of those four constants. Replace:

```ts
node.classList.add("only-translate-bilingual");
```

with:

```ts
node.classList.add(BILINGUAL_WRAPPER_CLASS);
```

- [ ] **Step 6: Run type check and content tests**

Run:

```bash
pnpm compile
pnpm test:content
```

Expected: both PASS.

- [ ] **Step 7: Commit shared constants**

Run:

```bash
git add entrypoints/main/translationTarget/constants.ts entrypoints/main/trans.ts entrypoints/main/translationTarget/decision.ts entrypoints/main/translationTarget/dynamic.ts entrypoints/main/translationTarget/scanContext.ts
git commit -m "refactor(content): 统一翻译标记常量"
```

Expected: commit succeeds.

---

### Task 5: DOM Typing And First-Line Translation Callback

**Files:**
- Modify: `entrypoints/main/dom.ts`
- Modify: `entrypoints/main/trans.ts`
- Modify: `tests/utils/grabAllNode.test.ts`

- [ ] **Step 1: Write failing first-line callback test**

In `tests/utils/grabAllNode.test.ts`, add `grabNode` to the import list:

```ts
  grabNode,
```

Add this test:

```ts
it('delegates first-line text translation through an injected callback', () => {
  document.body.innerHTML = `
    <div id="host">Intro text that belongs to the first line <span>metadata</span></div>
  `

  const calls: Array<{ textNode: Text; text: string }> = []
  const host = document.querySelector('#host') as HTMLElement
  const result = grabNode(host, {
    translateFirstLineText: (textNode, text) => {
      calls.push({ textNode, text })
    }
  })

  expect(result).toBe(false)
  expect(calls).toHaveLength(1)
  expect(calls[0].text).toBe('Intro text that belongs to the first line ')
  expect(calls[0].textNode.nodeType).toBe(Node.TEXT_NODE)
})
```

- [ ] **Step 2: Run the callback test and verify it fails**

Run:

```bash
pnpm test tests/utils/grabAllNode.test.ts
```

Expected: FAIL because `GrabAllNodeOptions` has no `translateFirstLineText` callback and `handleFirstLineText` still owns IPC.

- [ ] **Step 3: Add the callback option and typed grabNode signature**

In `entrypoints/main/dom.ts`, update `GrabAllNodeOptions`:

```ts
export interface GrabAllNodeOptions {
    contentFilter?: (element: Element) => ContentFilterDecision;
    contentUnitClassifier?: (element: Element) => ContentUnitDecision;
    shouldSkipSubtree?: (element: Element) => boolean;
    siteCompatMode?: SelectCompatContext['mode'];
    scanContext?: ScanContext;
    scanBudget?: ScanBudgetKind;
    translateFirstLineText?: (textNode: Text, text: string) => void;
}
```

Change the public signature:

```ts
export function grabNode(node: Node | null | undefined, options: GrabAllNodeOptions = {}): Element | false {
```

Add guards near the options interface:

```ts
function isElementNode(node: Node | null | undefined): node is Element {
    return node instanceof Element;
}

function isHTMLElementNode(node: Node | null | undefined): node is HTMLElement {
    return node instanceof HTMLElement;
}
```

- [ ] **Step 4: Replace direct first-line IPC**

Replace `handleFirstLineText` in `entrypoints/main/dom.ts` with:

```ts
function handleFirstLineText(node: Element, options: GrabAllNodeOptions): false {
    let child = node.firstChild;
    while (child) {
        if (child instanceof Text && child.textContent?.trim()) {
            const text = child.textContent;
            const trimmed = text.trim();
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && /"[a-zA-Z]+"[\s]*:/.test(trimmed)) {
                return false;
            }
            options.translateFirstLineText?.(child, text);
            return false;
        }
        child = child.nextSibling;
    }
    return false;
}
```

Change the caller:

```ts
if (curTag === 'div' || curTag === 'label') {
    return handleFirstLineText(node, options);
}
```

- [ ] **Step 5: Inject first-line translation from trans.ts**

In `entrypoints/main/trans.ts`, add a helper:

```ts
function translateFirstLineText(textNode: Text, origin: string): void {
    translateText(origin, document.title)
        .then((text: string) => {
            textNode.textContent = text;
        })
        .catch((error: Error) => console.error('翻译失败:', error));
}
```

Change the hover path:

```ts
let node = grabNode(document.elementFromPoint(mouseX, mouseY), { translateFirstLineText });
```

When `resolveAutoTranslationTarget` creates `grabOptions`, do not pass this callback; automatic smart/full translation should keep collecting targets and should not trigger first-line side-effect translation inside `dom.ts`.

- [ ] **Step 6: Import storage explicitly**

In `entrypoints/main/trans.ts`, add:

```ts
import { storage } from '#imports';
```

Keep the existing call:

```ts
config.count++ && storage.setItem('local:config', JSON.stringify(config));
```

- [ ] **Step 7: Tighten key HTMLElement signatures**

Change these signatures in `entrypoints/main/trans.ts`:

```ts
export function handleBilingualTranslation(node: HTMLElement, slide: boolean) {
export function handleSingleTranslation(node: HTMLElement, slide: boolean) {
function bilingualTranslate(node: HTMLElement, nodeOuterHTML: string) {
export function singleTranslate(node: HTMLElement) {
export const handleBtnTranslation = throttle((node: HTMLElement) => {
function bilingualAppendChild(node: HTMLElement, text: string | Node) {
```

In `handleTranslation`, guard the result:

```ts
let node = grabNode(document.elementFromPoint(mouseX, mouseY), { translateFirstLineText });
if (!(node instanceof HTMLElement)) return;
```

- [ ] **Step 8: Run focused DOM tests and compile**

Run:

```bash
pnpm test tests/utils/grabAllNode.test.ts
pnpm compile
```

Expected: both PASS.

- [ ] **Step 9: Commit DOM typing and IPC move**

Run:

```bash
git add entrypoints/main/dom.ts entrypoints/main/trans.ts tests/utils/grabAllNode.test.ts
git commit -m "refactor(content): 拆出首行文本翻译回调"
```

Expected: commit succeeds.

---

### Task 6: Heuristic And Nested-Node Performance Fixes

**Files:**
- Modify: `entrypoints/main/dom.ts`
- Modify: `entrypoints/main/trans.ts`
- Modify: `tests/utils/grabAllNode.test.ts`

- [ ] **Step 1: Write failing short identifier tests**

Add to `tests/utils/grabAllNode.test.ts`:

```ts
it('does not treat short readable identifiers as user names', () => {
  document.body.innerHTML = `
    <article>
      <h2 id="web3">web3</h2>
      <h2 id="step">step_2</h2>
      <h2 id="act">act_1</h2>
    </article>
  `

  expect(grabNode(document.querySelector('#web3'))).toBe(document.querySelector('#web3'))
  expect(grabNode(document.querySelector('#step'))).toBe(document.querySelector('#step'))
  expect(grabNode(document.querySelector('#act'))).toBe(document.querySelector('#act'))
})
```

- [ ] **Step 2: Run identifier test and verify it fails**

Run:

```bash
pnpm test tests/utils/grabAllNode.test.ts
```

Expected: FAIL because `isUserIdentifier` treats short alphanumeric/underscore strings as usernames.

- [ ] **Step 3: Tighten isUserIdentifier**

In `entrypoints/main/dom.ts`, replace `isUserIdentifier` with:

```ts
function isUserIdentifier(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const trimmedText = text.trim();

    if (/^@\w+/.test(trimmedText)) return true;
    if (/^u\/\w+/.test(trimmedText)) return true;
    if (/^id@https?:\/\/(x\.com|twitter\.com)\/[\w-]+\/status\/\d+/.test(trimmedText)) return true;
    if (/关注.*\w+/.test(trimmedText) || /Follow\s+@?\w+/i.test(trimmedText)) return true;
    if (/点击.*\w+/.test(trimmedText) && trimmedText.length < 50) return true;

    return false;
}
```

- [ ] **Step 4: Optimize nested translation node filtering**

In `entrypoints/main/dom.ts`, replace `removeNestedTranslateNodes` with:

```ts
function removeNestedTranslateNodes(nodes: Element[]): Element[] {
    const sorted = [...nodes].sort((left, right) => getNodeDepth(left) - getNodeDepth(right));
    const kept: Element[] = [];

    for (const node of sorted) {
        if (kept.some(parent => parent.contains(node))) continue;
        kept.push(node);
    }

    return kept;
}

function getNodeDepth(node: Element): number {
    let depth = 0;
    let current: Element | null = node;

    while (current.parentElement) {
        depth += 1;
        current = current.parentElement;
    }

    return depth;
}
```

This preserves the existing "drop descendants when an ancestor was already kept" behavior while avoiding pairwise `node.contains(other)` checks for every input pair.

- [ ] **Step 5: Limit HTML beautify in singleTranslate**

In `entrypoints/main/trans.ts`, add:

```ts
function shouldBeautifyTranslatedHTML(origin: string, translated: string): boolean {
    return /<[^>]+>/.test(origin) || /<[^>]+>/.test(translated);
}
```

Change:

```ts
text = beautyHTML(text);
```

to:

```ts
if (shouldBeautifyTranslatedHTML(origin, text)) {
    text = beautyHTML(text);
}
```

- [ ] **Step 6: Run focused tests and compile**

Run:

```bash
pnpm test tests/utils/grabAllNode.test.ts
pnpm compile
```

Expected: both PASS.

- [ ] **Step 7: Commit heuristic and performance fixes**

Run:

```bash
git add entrypoints/main/dom.ts entrypoints/main/trans.ts tests/utils/grabAllNode.test.ts
git commit -m "perf(content): 收紧用户名识别并优化节点过滤"
```

Expected: commit succeeds.

---

### Task 7: Translation State Container

**Files:**
- Modify: `entrypoints/main/trans.ts`
- Test: `tests/utils/autoTranslateTarget.test.ts`

- [ ] **Step 1: Introduce translationState**

In `entrypoints/main/trans.ts`, replace the module-level state declarations with:

```ts
const translationState = {
    hoverTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    htmlSet: new Set<string>(),
    originalContents: new Map<string, string>(),
    isAutoTranslating: false,
    observer: null as IntersectionObserver | null,
    mutationObserver: null as MutationObserver | null,
    nodeIdCounter: 0
};

export const originalContents = translationState.originalContents;
```

- [ ] **Step 2: Replace state references**

In `entrypoints/main/trans.ts`, replace direct variable usage:

```ts
hoverTimer
htmlSet
isAutoTranslating
observer
mutationObserver
nodeIdCounter
```

with:

```ts
translationState.hoverTimer
translationState.htmlSet
translationState.isAutoTranslating
translationState.observer
translationState.mutationObserver
translationState.nodeIdCounter
```

For node IDs, preserve increment behavior:

```ts
const nodeId = `fr-node-${translationState.nodeIdCounter++}`;
```

- [ ] **Step 3: Add small state helpers**

Add helpers near the state object:

```ts
function setAutoTranslating(value: boolean): void {
    translationState.isAutoTranslating = value;
}

function clearHoverTimer(): void {
    if (translationState.hoverTimer) clearTimeout(translationState.hoverTimer);
    translationState.hoverTimer = undefined;
}
```

Use `setAutoTranslating(true)` and `setAutoTranslating(false)` where the old boolean was assigned. Use `clearHoverTimer()` in `handleTranslation` before setting a new hover timer.

- [ ] **Step 4: Run behavior tests**

Run:

```bash
pnpm test tests/utils/autoTranslateTarget.test.ts tests/utils/grabAllNode.test.ts
pnpm compile
```

Expected: PASS. Existing tests cover bilingual append, dynamic target collection, and DOM utilities.

- [ ] **Step 5: Commit state container**

Run:

```bash
git add entrypoints/main/trans.ts
git commit -m "refactor(content): 收纳翻译执行状态"
```

Expected: commit succeeds.

---

### Task 8: Full Regression And Release Readiness Gate

**Files:**
- Verify all files changed in previous tasks.

- [ ] **Step 1: Run content regression suite**

Run:

```bash
pnpm test:content
```

Expected: PASS. This validates content detection, target selection, profiles, and dynamic behavior.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm verify
```

Expected: PASS. Existing Vue warning output is acceptable only if the command exits with code 0.

- [ ] **Step 3: Inspect generic collect boundary**

Run:

```bash
rg -n "github\\.com|GitHub|cnn\\.com|ziggit\\.dev" entrypoints/main/translationTarget entrypoints/utils/contentFilter.ts entrypoints/utils/contentUnitClassifier.ts
```

Expected: no concrete site-domain matches inside `entrypoints/main/translationTarget/collect.ts`. Matches inside profile files are acceptable; matches inside release notes or tests are not part of this command.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only the pre-existing `.claude/settings.local.json` remains uncommitted, or the working tree is clean if that file was handled outside this plan.

- [ ] **Step 5: Commit any final test-only adjustment**

If Step 1 or Step 2 required a test-only expectation correction, commit only that focused adjustment:

```bash
git add tests/utils
git commit -m "test(content): 补齐识文架构回归断言"
```

Expected: commit succeeds only if there was an actual test adjustment. If no adjustment was needed, skip this step.

---

## Self-Review

**Spec coverage:**  
The plan covers profile hook integration, GitHub migration, compat facade boundaries, shared constants, `handleFirstLineText` IPC movement, storage import, key `any` reductions, nested-node performance, username heuristic tightening, conditional beautify, state containment, and full verification.

**Placeholder scan:**  
The plan contains no placeholder markers or unspecified implementation steps. Every task names concrete files, code snippets, commands, and expected results.

**Type consistency:**  
The new hooks are named `expandTarget` and `shouldKeepNestedTarget` consistently across `types.ts`, `index.ts`, `github.ts`, and `collect.ts`. The first-line callback is consistently named `translateFirstLineText`.
