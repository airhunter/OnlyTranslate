import { asteriskProfile } from './asterisk';
import { claudeNagdyProfile } from './claudeNagdy';
import { cnnProfile } from './cnn';
import { decryptProfile } from './decrypt';
import { githubProfile } from './github';
import { hackerNewsProfile } from './hackerNews';
import { mediumProfile } from './medium';
import { realPythonProfile } from './realPython';
import { redditProfile } from './reddit';
import { simpleProfiles } from './simpleProfiles';
import { stackOverflowProfile } from './stackoverflow';
import type { AfterBilingualAppendCompatFn, ReplaceCompatFn, SelectCompatFn, SiteProfile, SupplementalCompatFn } from './types';
import { xProfile } from './x';
import { youtubeProfile } from './youtube';

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
    AfterBilingualAppendCompatFn,
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
    realPythonProfile,
    redditProfile,
    hackerNewsProfile,
    asteriskProfile,
    claudeNagdyProfile,
    decryptProfile
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
