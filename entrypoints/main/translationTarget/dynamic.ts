import type { GrabAllNodeOptions } from '@/entrypoints/main/dom';
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier';
import { collectTranslationTargets } from './collect';
import { decideTranslationTarget, isOpenExpandableReadingContainer, isVisibleForTranslation } from './decision';
import type { TranslationTargetContext } from './types';

const TRANSLATED_ATTR = 'data-fr-translated';
const BILINGUAL_CONTENT_CLASS = 'only-translate-bilingual-content';
const SUPPLEMENTAL_READING_CONFIDENCE = 0.72;

export function collectDynamicTranslationNodes(
    root: Element,
    contentRoot: Element,
    scope: string,
    grabOptions: GrabAllNodeOptions = {}
): Element[] {
    if (isManagedTranslationNode(root)) return [];
    if (!isInTranslationScope(root, contentRoot, scope)) return [];

    const context: TranslationTargetContext = {
        mode: grabOptions.siteCompatMode ?? (scope === 'full' ? 'full' : 'smart'),
        scope,
        contentRoot,
        grabOptions
    };

    if (isOpenExpandableReadingContainer(root) && isVisibleForTranslation(root) && !root.hasAttribute(TRANSLATED_ATTR)) {
        const decision = decideTranslationTarget({
            node: root,
            source: 'content-unit',
            reasons: ['open-expandable-reading-container']
        }, context);

        return decision.policy === 'allow' ? [decision.target] : [];
    }

    return collectTranslationTargets(root, context, { includeSupplemental: false })
        .map(decision => decision.target)
        .filter(node => !node.hasAttribute(TRANSLATED_ATTR) && !isManagedTranslationNode(node) && isVisibleForTranslation(node));
}

export function isManagedTranslationNode(node: Node): boolean {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`));
}

export function isInTranslationScope(root: Element, contentRoot: Element, scope: string): boolean {
    if (scope === 'full' || contentRoot.contains(root)) return true;

    let current: Element | null = root;
    while (current && current !== document.body) {
        if (isOpenExpandableReadingContainer(current) && isVisibleForTranslation(current)) {
            return true;
        }

        const decision = classifyContentUnit(current);
        if (decision.action === 'allow' && decision.confidence >= SUPPLEMENTAL_READING_CONFIDENCE) {
            return true;
        }
        current = current.parentElement;
    }

    return false;
}
