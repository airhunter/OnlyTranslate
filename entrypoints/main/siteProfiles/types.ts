export type SiteProfileMode = 'smart' | 'full';

export interface SiteProfileContext {
    mode: SiteProfileMode;
}

export type SiteProfileResult = Element | { skip: true } | false | undefined;

export type SiteProfileSelect = (node: Element, context: SiteProfileContext) => SiteProfileResult;
export type SiteProfileReplace = (node: Element, translatedHTML: string) => void;
export type SiteProfileSupplemental = (root: ParentNode, context: SiteProfileContext) => Element[];

export interface SiteProfile {
    id: string;
    domains: string[];
    select?: SiteProfileSelect;
    replace?: SiteProfileReplace;
    supplemental?: SiteProfileSupplemental;
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
