import { asteriskProfile } from './asterisk';
import { arsTechnicaProfile } from './arsTechnica';
import { claudeNagdyProfile } from './claudeNagdy';
import { cnnProfile } from './cnn';
import { decryptProfile } from './decrypt';
import { githubProfile } from './github';
import { hackerNewsProfile } from './hackerNews';
import { mediumProfile } from './medium';
import { nxgoaiProfile } from './nxgoai';
import { realPythonProfile } from './realPython';
import { redditProfile } from './reddit';
import { simonWillisonProfile } from './simonWillison';
import { simpleProfiles } from './simpleProfiles';
import { stackOverflowProfile } from './stackoverflow';
import type {
    AfterBilingualAppendCompatFn,
    ExpandTargetCompatFn,
    ReplaceCompatFn,
    SelectCompatFn,
    ShouldKeepNestedTargetCompatFn,
    SiteProfile,
    SupplementalCompatFn
} from './types';
import { xProfile } from './x';
import { youtubeProfile } from './youtube';
import { ziggitProfile } from './ziggit';

export type {
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
    AfterBilingualAppendCompatFn,
    ExpandTargetCompatFn,
    ShouldKeepNestedTargetCompatFn,
    SupplementalCompatFn
} from './types';

export const siteProfiles: SiteProfile[] = [
    ...simpleProfiles,
    cnnProfile,
    youtubeProfile,
    xProfile,
    githubProfile,
    stackOverflowProfile,
    mediumProfile,
    nxgoaiProfile,
    realPythonProfile,
    redditProfile,
    simonWillisonProfile,
    hackerNewsProfile,
    asteriskProfile,
    arsTechnicaProfile,
    claudeNagdyProfile,
    decryptProfile,
    ziggitProfile
];

export const siteProfileSelectFns: SelectCompatFn = siteProfiles.reduce<SelectCompatFn>((map, profile) => {
    if (!profile.select) return map;

    for (const domain of profile.domains) {
        map[domain] = profile.select;
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
