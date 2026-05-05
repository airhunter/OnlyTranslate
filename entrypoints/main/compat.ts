// 兼容部分网站独特的 DOM 结构。
// 具体站点规则放在 siteProfiles 中，本文件保留旧入口，避免影响调用链。

import {
    siteProfileReplaceFns,
    siteProfileSelectFns,
    type ReplaceCompatFn,
    type SelectCompatFn,
    type SiteProfileContext
} from './siteProfiles';

export type SelectCompatContext = SiteProfileContext;

// 根据浏览器 url.host 获取主域名
export function getMainDomain(url: any) {
    try {
        let hostname = '';

        if (typeof url === 'string') {
            const noProtocol = url.replace(/^(https?:\/\/)/, '');
            hostname = noProtocol.split('/')[0];
        } else if (url instanceof URL) {
            hostname = url.hostname;
        } else {
            return '';
        }

        if (hostname === 'twitter.com' || hostname === 'x.com'
            || hostname === 'www.twitter.com' || hostname === 'www.x.com') {
            return 'x.com';
        }

        hostname = hostname.replace(/^www\./, '');

        const parts = hostname.split('.');
        if (parts.length >= 2) {
            if (parts.length >= 3
                && ((parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com')
                    && parts[parts.length - 1].length === 2)) {
                return parts.slice(-3).join('.');
            }

            return parts.slice(-2).join('.');
        }

        return hostname;
    } catch (error) {
        console.error('getMainDomain error:', error);
        return '';
    }
}

// 文本替换环节的兼容函数，主域名 : 兼容函数
export const replaceCompatFn: ReplaceCompatFn = siteProfileReplaceFns;

// 元素 node 选择环节的兼容函数
export const selectCompatFn: SelectCompatFn = siteProfileSelectFns;
