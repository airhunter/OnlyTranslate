import type { GrabAllNodeOptions } from '@/entrypoints/main/dom';

export type TranslationTargetPolicy = 'allow' | 'soft-skip' | 'hard-skip';

export type TranslationTargetRole =
    | 'title'
    | 'paragraph'
    | 'summary'
    | 'card'
    | 'metadata'
    | 'ui'
    | 'layout';

export type TranslationTargetSource =
    | 'grab-node'
    | 'site-profile'
    | 'content-unit'
    | 'dom-unit'
    | 'supplemental'
    | 'reading-block'
    | 'fallback'
    | 'shadow-root';

export interface TranslationTargetDecision {
    node: Element;
    target: Element;
    appendTarget?: HTMLElement;
    policy: TranslationTargetPolicy;
    role: TranslationTargetRole;
    source: TranslationTargetSource;
    reasons: string[];
}

export interface TranslationTargetContext {
    mode: 'smart' | 'full';
    scope: string;
    contentRoot: Element;
    grabOptions?: GrabAllNodeOptions;
}

export type TranslationTargetCandidate = {
    node: Element;
    reasons?: string[];
} & (
    | { source: 'reading-block'; readingRole: 'paragraph' | 'title' }
    | { source: Exclude<TranslationTargetSource, 'reading-block'> }
);

export interface TranslationTargetOverride {
    target?: Element;
    appendTarget?: HTMLElement;
    role?: TranslationTargetRole;
    source?: TranslationTargetSource;
    reason: string;
}

export interface TranslationTargetSkip {
    policy: Exclude<TranslationTargetPolicy, 'allow'>;
    role?: TranslationTargetRole;
    reason: string;
}
