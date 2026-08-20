import type {
    TranslationTargetContext,
    TranslationTargetOverride,
    TranslationTargetSkip
} from '@/entrypoints/main/translationTarget/types';

export type SiteProfileMode = 'smart' | 'full';

export interface SiteProfileContext {
    mode: SiteProfileMode;
}

export type SiteProfileResult = Element | { skip: true } | false | undefined;

export type SiteProfileSelect = (node: Element, context: SiteProfileContext) => SiteProfileResult;
export type SiteProfileReplace = (node: Element, translatedHTML: string) => void;
export type SiteProfileSupplemental = (root: ParentNode, context: SiteProfileContext) => Element[];
export type SiteProfileAfterBilingualAppend = (
    node: HTMLElement,
    translationNode: HTMLElement,
    appendTarget: HTMLElement,
    insertionNode: HTMLElement
) => void;
export type SiteProfileTargetAllow = (node: Element, context: TranslationTargetContext) => TranslationTargetOverride | false | undefined;
export type SiteProfileTargetSkip = (node: Element, context: TranslationTargetContext) => TranslationTargetSkip | false | undefined;
export type SiteProfileAppendTarget = (node: HTMLElement, context: TranslationTargetContext) => HTMLElement | false | undefined;
export type SiteProfileExpandTarget = (node: Element, context: TranslationTargetContext) => Element[] | false | undefined;
export type SiteProfileFastPathTargetCollector = (root: ParentNode, context: SiteProfileContext) => Element[] | false | undefined;
export type SiteProfileShouldKeepNestedTarget = (parent: Element, child: Element, context: TranslationTargetContext) => boolean;

export interface SiteProfile {
    id: string;
    domains: string[];
    targetStrategy?: 'profile-first';
    rootsSelector?: string;
    targetSelector?: string;
    ignoreSelector?: string;
    keepSelector?: string;
    select?: SiteProfileSelect;
    replace?: SiteProfileReplace;
    supplemental?: SiteProfileSupplemental;
    preserveSupplementalTargets?: boolean;
    afterBilingualAppend?: SiteProfileAfterBilingualAppend;
    allowTarget?: SiteProfileTargetAllow;
    skipTarget?: SiteProfileTargetSkip;
    appendTarget?: SiteProfileAppendTarget;
    expandTarget?: SiteProfileExpandTarget;
    // Complete smart-mode target set. When it has enough readable text, the generic DOM scan is skipped.
    collectFastPathTargets?: SiteProfileFastPathTargetCollector;
    shouldKeepNestedTarget?: SiteProfileShouldKeepNestedTarget;
}

export interface SelectCompatFn {
    [domain: string]: SiteProfileSelect;
}

export interface KeepSelectorCompatFn {
    [domain: string]: string;
}

export interface ReplaceCompatFn {
    [domain: string]: SiteProfileReplace;
}

export interface SupplementalCompatFn {
    [domain: string]: SiteProfileSupplemental;
}

export interface AfterBilingualAppendCompatFn {
    [domain: string]: SiteProfileAfterBilingualAppend;
}

export interface ExpandTargetCompatFn {
    [domain: string]: SiteProfileExpandTarget;
}

export interface ShouldKeepNestedTargetCompatFn {
    [domain: string]: SiteProfileShouldKeepNestedTarget;
}
