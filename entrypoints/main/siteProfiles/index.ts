import { cnnProfile } from './cnn';
import { githubProfile } from './github';
import { hackerNewsProfile } from './hackerNews';
import { mediumProfile } from './medium';
import { redditProfile } from './reddit';
import { simpleProfiles } from './simpleProfiles';
import { stackOverflowProfile } from './stackoverflow';
import type { ReplaceCompatFn, SelectCompatFn, SiteProfile } from './types';
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
    SiteProfileSelect
} from './types';

export const siteProfiles: SiteProfile[] = [
    ...simpleProfiles,
    cnnProfile,
    youtubeProfile,
    xProfile,
    githubProfile,
    stackOverflowProfile,
    mediumProfile,
    redditProfile,
    hackerNewsProfile
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
