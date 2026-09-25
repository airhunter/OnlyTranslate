import { asteriskProfile } from './asterisk';
import { arsTechnicaProfile } from './arsTechnica';
import { claudeNagdyProfile } from './claudeNagdy';
import { claytonRamseyProfile } from './claytonRamsey';
import { cnnProfile } from './cnn';
import { decryptProfile } from './decrypt';
import { devToProfile } from './devTo';
import { devinDocsProfile } from './devinDocs';
import { exercismProfile } from './exercism';
import { githubProfile } from './github';
import { googleAiModeProfile } from './googleAiMode';
import { hackerNewsProfile } from './hackerNews';
import { huggingFaceProfile } from './huggingFace';
import { jacobGoldProfile } from './jacobGold';
import { mediumProfile } from './medium';
import { maxwellForbesProfile } from './maxwellForbes';
import { mempkoProfile } from './mempko';
import { microsoftPartnerCenterProfile } from './microsoftPartnerCenter';
import { natureProfile } from './nature';
import { nxgoaiProfile } from './nxgoai';
import { productHuntProfile } from './productHunt';
import { quoraProfile } from './quora';
import { realPythonProfile } from './realPython';
import { redditProfile } from './reddit';
import { simonWillisonProfile } from './simonWillison';
import { simpleProfiles } from './simpleProfiles';
import { stackOverflowProfile } from './stackoverflow';
import { substackProfile } from './substack';
import { tucProfile } from './tuc';
import type {
    AfterBilingualAppendCompatFn,
    ExpandTargetCompatFn,
    KeepSelectorCompatFn,
    ReplaceCompatFn,
    SelectCompatFn,
    ShouldKeepNestedTargetCompatFn,
    TextExcludeCompatFn,
    SiteProfile,
    SiteProfileSelect,
    SupplementalCompatFn
} from './types';
import { xProfile } from './x';
import { xdaDevelopersProfile } from './xdaDevelopers';
import { youtubeProfile } from './youtube';
import { wsjProfile } from './wsj';
import { ynetNewsProfile } from './ynetNews';
import { ziggitProfile } from './ziggit';

export type {
    KeepSelectorCompatFn,
    ReplaceCompatFn,
    SelectCompatFn,
    SiteProfile,
    SiteProfileContext,
    SiteProfileMode,
    SiteProfileReplace,
    SiteProfileResult,
    SiteProfileSelect,
    SiteProfileSupplemental,
    SiteProfileAfterBilingualAppend,
    SiteProfileTargetAllow,
    SiteProfileTargetSkip,
    SiteProfileAppendTarget,
    SiteProfileExpandTarget,
    SiteProfileShouldKeepNestedTarget,
    SiteProfileTextExclude,
    AfterBilingualAppendCompatFn,
    ExpandTargetCompatFn,
    ShouldKeepNestedTargetCompatFn,
    SupplementalCompatFn,
    TextExcludeCompatFn
} from './types';

export const siteProfiles: SiteProfile[] = [
    ...simpleProfiles,
    claytonRamseyProfile,
    cnnProfile,
    youtubeProfile,
    xProfile,
    xdaDevelopersProfile,
    githubProfile,
    googleAiModeProfile,
    stackOverflowProfile,
    mediumProfile,
    maxwellForbesProfile,
    mempkoProfile,
    nxgoaiProfile,
    productHuntProfile,
    quoraProfile,
    realPythonProfile,
    redditProfile,
    simonWillisonProfile,
    substackProfile,
    tucProfile,
    microsoftPartnerCenterProfile,
    hackerNewsProfile,
    huggingFaceProfile,
    jacobGoldProfile,
    natureProfile,
    asteriskProfile,
    arsTechnicaProfile,
    devToProfile,
    devinDocsProfile,
    exercismProfile,
    claudeNagdyProfile,
    decryptProfile,
    wsjProfile,
    ynetNewsProfile,
    ziggitProfile
];

function createDeclarativeSelect(profile: SiteProfile): SiteProfileSelect | undefined {
    if (!profile.targetSelector) return profile.select;

    return (node) => {
        if (profile.ignoreSelector && safeMatchesOrClosest(node, profile.ignoreSelector)) return { skip: true };
        if (profile.rootsSelector && !safeMatchesOrClosest(node, profile.rootsSelector)) return false;
        if (safeMatches(node, profile.targetSelector!)) return node;
        return false;
    };
}

function safeMatchesOrClosest(node: Element, selector: string): boolean {
    return safeMatches(node, selector) || Boolean(safeClosest(node, selector));
}

function safeClosest(node: Element, selector: string): Element | null {
    try {
        return node.closest(selector);
    } catch {
        return null;
    }
}

function safeMatches(node: Element, selector: string): boolean {
    try {
        return node.matches(selector);
    } catch {
        return false;
    }
}

export const siteProfileSelectFns: SelectCompatFn = siteProfiles.reduce<SelectCompatFn>((map, profile) => {
    const select = createDeclarativeSelect(profile);
    if (!select) return map;

    for (const domain of profile.domains) {
        map[domain] = select;
    }

    return map;
}, {});

export const siteProfileKeepSelectorFns: KeepSelectorCompatFn = siteProfiles.reduce<KeepSelectorCompatFn>((map, profile) => {
    if (!profile.keepSelector) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.keepSelector;
    }

    return map;
}, {});

export const siteProfileTextExcludeFns: TextExcludeCompatFn = siteProfiles.reduce<TextExcludeCompatFn>((map, profile) => {
    if (!profile.excludeFromText) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.excludeFromText;
    }

    return map;
}, {});

export const siteProfileReplaceFns: ReplaceCompatFn = siteProfiles.reduce<ReplaceCompatFn>((map, profile) => {
    if (!profile.replace) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.replace;
    }

    return map;
}, {});

export const siteProfileSupplementalFns: SupplementalCompatFn = siteProfiles.reduce<SupplementalCompatFn>((map, profile) => {
    if (!profile.supplemental) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.supplemental;
    }

    return map;
}, {});

export const siteProfileAfterBilingualAppendFns: AfterBilingualAppendCompatFn = siteProfiles.reduce<AfterBilingualAppendCompatFn>((map, profile) => {
    if (!profile.afterBilingualAppend) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.afterBilingualAppend;
    }

    return map;
}, {});

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
