// Legacy compatibility facade. New site behavior belongs in siteProfiles/.

import { getMainDomain } from '@/entrypoints/utils/domain';
import {
    siteProfileAfterBilingualAppendFns,
    siteProfileKeepSelectorFns,
    siteProfileReplaceFns,
    siteProfileSelectFns,
    siteProfileSupplementalFns,
    type AfterBilingualAppendCompatFn,
    type KeepSelectorCompatFn,
    type ReplaceCompatFn,
    type SelectCompatFn,
    type SiteProfileContext,
    type SupplementalCompatFn
} from './siteProfiles';

export type SelectCompatContext = SiteProfileContext;
export { getMainDomain };

export const replaceCompatFn: ReplaceCompatFn = siteProfileReplaceFns;
export const selectCompatFn: SelectCompatFn = siteProfileSelectFns;
export const supplementalCompatFn: SupplementalCompatFn = siteProfileSupplementalFns;
export const afterBilingualAppendCompatFn: AfterBilingualAppendCompatFn = siteProfileAfterBilingualAppendFns;
export const keepSelectorCompatFn: KeepSelectorCompatFn = siteProfileKeepSelectorFns;
