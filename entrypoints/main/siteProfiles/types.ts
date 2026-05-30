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
export type SiteProfileAfterBilingualAppend = (node: HTMLElement, translationNode: HTMLElement, appendTarget: HTMLElement) => void;
export type SiteProfileTargetAllow = (node: Element, context: TranslationTargetContext) => TranslationTargetOverride | false | undefined;
export type SiteProfileTargetSkip = (node: Element, context: TranslationTargetContext) => TranslationTargetSkip | false | undefined;
export type SiteProfileAppendTarget = (node: HTMLElement, context: TranslationTargetContext) => HTMLElement | false | undefined;

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
}

export interface SelectCompatFn {
    [domain: string]: SiteProfileSelect;
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
