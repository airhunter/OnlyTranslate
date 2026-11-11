import { getStructuralHint, INLINE_TEXT_TAGS, PROSE_TEXT_MIN } from '@/entrypoints/utils/proseSignals';
import { getTranslatableText } from '@/entrypoints/main/dom';
import { hasPromotionalCallToAction } from '@/entrypoints/utils/contentFilter';
import { composedClosest, composedContains, getComposedParentElement } from './composedTree';
import { BILINGUAL_CONTENT_CLASS } from './constants';
import { getCachedProseEvidence, getCachedVisibility, isElementVisible, type ScanContext } from './scanContext';

const COMMENT_BODY = '[itemprop="commentText"], [data-comment-body], .comment-body, .comment-content';
const READING_REGION = `aside, [role="complementary"], [role="note"], header, ${COMMENT_BODY}`;
const TEXT_BLOCK = 'p, li, blockquote, figcaption, dd, div, section, article';
const HARD_BOUNDARY = 'nav, footer, form, dialog, a, button, [role="button"], [role="navigation"], [role="contentinfo"], [role="dialog"], [hidden], [aria-hidden="true"], .notranslate, [translate="no"]';
const CONTROL_REGION = /\b(cookie|consent|toolbar|form)\b/i;
const NOTE_HINT = /\b(announce|announcement|notice|note|callout|footnote)\b/i;
const METADATA_REGION = /\b(author|byline|bio|rights|rightslink|permissions|references|bibliography|citation|metrics|copyright|footer|attribution|metabox|metadata)\b/i;
const METADATA_COPY = /(?:^copyright\s|\bauthor has\s+[\d.,kmb]+\s+(?:answers|posts|views)\b)/i;
const AUXILIARY_MODULE = /\b(ad|ads|advertisement|advertising|billboard|related|recommended|recommendations|share|social)\b/i;
const COMMENT_LABEL = /^(?:(?:reader|user)\s+)?(?:comments?|replies|discussion)(?:\s*\(\d+\))?\s*:?$/i;
const RECOMMENDATION_LABEL = /^(?:related(?: articles| reading)?|recommended(?: reading)?|suggested profiles|relevant people|read next|more from)\s*:?$/i;

export function isReadingBlockLeaf(node: Element): boolean {
    return node.matches(TEXT_BLOCK) && !node.querySelector('p, li, blockquote, figcaption, dd, div, section, article, ul, ol, table');
}

export function isCommentReadingRegion(node: Element): boolean {
    return Boolean(composedClosest(node, COMMENT_BODY));
}

export function isRecommendationBlock(node: Element): boolean {
    const region = composedClosest(node, 'aside, [role="complementary"]') ?? getComposedParentElement(node);
    if (!region || region.matches('main, article, body, html')) return false;
    return Array.from(region.querySelectorAll(':scope > :is(label, [data-field="label"], strong, h1, h2, h3, h4, h5, h6), :scope > span > label'))
        .some(label => RECOMMENDATION_LABEL.test(label.textContent?.trim() ?? ''));
}

export function getReadingBlockRegion(node: Element, contentRoot?: Element): Element | null {
    if (composedClosest(node, HARD_BOUNDARY)) return null;
    const contextualRegion = composedClosest(node, READING_REGION);
    if (!contextualRegion && contentRoot && composedContains(contentRoot, node)) return null;
    const parent = getComposedParentElement(node);
    const region = contextualRegion ?? (isReadingBlockLeaf(node) && parent && !parent.matches('body, main, html') ? parent : node);
    if (!region) return null;

    for (let ancestor: Element | null = node; ancestor; ancestor = getComposedParentElement(ancestor)) {
        const hint = getStructuralHint(ancestor).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
        if (CONTROL_REGION.test(hint) && ancestor.querySelector('button, input, textarea, [role="button"]')) return null;
        if (METADATA_REGION.test(hint)) return null;
        if (ancestor.classList.contains('source')) return null;
        if (AUXILIARY_MODULE.test(getStructuralHint(ancestor)) && !isReadingBlockLeaf(ancestor)) return null;
        if (ancestor.matches('main, article, body')) break;
    }
    return region;
}

export function getReadingBlockTargets(node: Element, scanContext?: ScanContext, contentRoot?: Element): Element[] {
    const region = getReadingBlockRegion(node, contentRoot);
    if (!region || !isReadingBlockLeaf(node)) return [];
    if (!getCachedVisibility(scanContext, node, isElementVisible)) return [];
    const evidence = getCachedProseEvidence(scanContext, node);
    if (METADATA_COPY.test(evidence.text)) return [];
    if (evidence.textLength < 3 || evidence.textLength > 3072 || evidence.buttonCount || evidence.interactiveDensity >= 0.45) return [];
    const comment = region.matches(COMMENT_BODY);
    // A multi-paragraph comment is one reading block even when its last sentence is short.
    const blockEvidence = comment ? getCachedProseEvidence(scanContext, region) : evidence;
    if (blockEvidence.buttonCount) return [];
    if (isRecommendationBlock(node)) return [];
    if (hasPromotionalCallToAction(region)) return [];
    if (/\b(?:subscribe|sign up|join)\b[^.!?]{0,45}\b(?:newsletter|mailing list)\b/i.test(evidence.text)) return [];
    if (comment) return blockEvidence.strength === 'strong' ? [node] : [];

    // A short label can introduce either the paragraph or its wrapper.
    const contextualRegion = composedClosest(node, READING_REGION);
    const title = contextualRegion
        ? Array.from(region.children).find(child => child.textContent?.trim())
        : node.previousElementSibling;
    const titleText = title ? getReadingLabelText(title) : '';
    const companion = title && title !== node && titleText.length <= 80
        && !COMMENT_LABEL.test(titleText)
        && !METADATA_COPY.test(titleText)
        && getCachedVisibility(scanContext, title, isElementVisible)
        && Array.from(title.children).every(child => child.matches('code') || INLINE_TEXT_TAGS.has(child.localName))
        && !title.matches('a, button') && !(contextualRegion && title.matches('h1'))
        && !title.querySelector('a, button, input')
        && Boolean(title.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
        ? title : null;
    const hasReadingContext = companion || region.matches('[role="note"]')
        || NOTE_HINT.test(getStructuralHint(region))
        || composedClosest(region, 'article, [role="article"]');
    const weakRegion = contextualRegion?.matches('aside, header, [role="complementary"]')
        || /\b(?:sidebar|side-bar|rail)\b/i.test(getStructuralHint(region));
    if (blockEvidence.strength === 'strong') {
        if (weakRegion && !hasReadingContext && evidence.textLength < PROSE_TEXT_MIN * 2) return [];
        return companion ? [node, companion] : [node];
    }
    // Weak prose can join a neighbouring strong block within the same parent.
    if (evidence.strength !== 'weak' || weakRegion) return [];
    const neighbours = [node.previousElementSibling, node.nextElementSibling];
    const supported = neighbours.some(neighbour => neighbour && isReadingBlockLeaf(neighbour)
        && getCachedProseEvidence(scanContext, neighbour).strength === 'strong'
        && getReadingBlockTargets(neighbour, scanContext, contentRoot).length > 0);
    return supported ? [node] : [];
}

function getReadingLabelText(title: Element): string {
    const selector = `.${BILINGUAL_CONTENT_CLASS}`;
    let source = title;
    if (title.querySelector(selector)) {
        source = title.cloneNode(true) as Element;
        source.querySelectorAll(selector).forEach(node => node.remove());
    }
    return getTranslatableText(source).replace(/\s+/g, ' ').trim();
}
