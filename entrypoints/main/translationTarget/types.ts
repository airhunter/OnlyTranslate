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
    | 'fallback';

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

export interface TranslationTargetCandidate {
    node: Element;
    source: TranslationTargetSource;
    reasons?: string[];
}

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
