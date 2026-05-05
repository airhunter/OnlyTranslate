import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile, SiteProfileMode } from './types';
import { debugLog, isSpecialContent } from './utils';

export const redditProfile: SiteProfile = {
    id: 'reddit',
    domains: ['reddit.com'],
    select: (node, context) => {
        const postTitle = findMatchingElement(node, 'h1, h3[data-click-id="body"], [slot="title"]');
        if (postTitle) {
            debugLog('Reddit', '翻译帖子标题', postTitle.textContent);
            return postTitle;
        }

        const postBody = findMatchingElement(
            node,
            'div[data-post-click-location="text-body"], [slot="text-body"], shreddit-post [slot="text-body"]'
        );
        if (postBody) {
            debugLog('Reddit', '翻译帖子正文', postBody.textContent?.substring(0, 50) + '...');
            return postBody;
        }

        const commentBody = findMatchingElement(
            node,
            'shreddit-comment [slot="comment"], div[id$="-comment-rtjson-content"], div[data-testid="comment"]'
        );
        if (commentBody) {
            debugLog('Reddit', '翻译评论正文', commentBody.textContent?.substring(0, 50) + '...');
            return commentBody;
        }

        if (shouldSkipRedditElement(node, context.mode)) {
            debugLog('Reddit', '跳过Reddit元素', node.textContent);
            return { skip: true };
        }

        const description = findMatchingElement(node, 'div.community-details-heading p, div.community-details p, div.wiki-page-content, div[data-click-id="text"]');
        if (description) {
            debugLog('Reddit', '翻译描述文本', description.textContent?.substring(0, 50) + '...');
            return description;
        }

        const wikiContent = findMatchingElement(node, 'div.md-container div.md, div.md');
        if (wikiContent) {
            debugLog('Reddit', '翻译Wiki内容', wikiContent.textContent?.substring(0, 50) + '...');
            return wikiContent;
        }

        const communityDescription = findMatchingElement(node, 'div[data-click-id="about"] h2, div[data-redditstyle="true"] h2');
        if (communityDescription) {
            debugLog('Reddit', '翻译社区描述', communityDescription.textContent);
            return communityDescription;
        }

        const communityRules = findMatchingElement(node, 'div.rules-list div.rule-item div.rule-item-body, div.rule-item p');
        if (communityRules) {
            debugLog('Reddit', '翻译社区规则', communityRules.textContent);
            return communityRules;
        }

        const postCard = findMatchingElement(node, 'div[data-testid="post-title"], div.Post h3');
        if (postCard) {
            debugLog('Reddit', '翻译帖子卡片', postCard.textContent);
            return postCard;
        }

        const announcement = findMatchingElement(node, 'div[data-testid="content"], div.announcement');
        if (announcement) {
            debugLog('Reddit', '翻译公告内容', announcement.textContent?.substring(0, 50) + '...');
            return announcement;
        }

        return false;
    }
};

function shouldSkipRedditElement(node: Element, mode: SiteProfileMode = 'smart'): boolean {
    if (node.textContent && isSpecialContent(node.textContent)) {
        debugLog('Reddit', '特殊内容跳过', node.textContent);
        return true;
    }

    if (node.tagName?.toLowerCase() === 'faceplate-screen-reader-content') {
        debugLog('Reddit', '屏幕阅读器内容跳过', node.textContent);
        return true;
    }

    if (node.tagName?.toLowerCase() === 'time') {
        debugLog('Reddit', '时间标签跳过', node.textContent);
        return true;
    }

    if (mode === 'full') {
        return false;
    }

    const skipSelectors = [
        'header',
        'div._3Qx5bBCG_O8wVZee9J-KyJ',
        'div._1x6pySZ2CoUnAfsFhGe7J1',
        'div._1QhgSEQa6-vyHBHcV0rygZ',
        'nav, div[data-testid="subreddit-header"]',
        'div._3ozFtOe6WpJEMUtxDOIvtU',
        'div._2QZ7T4uAFMs_N83BZcN-Em',
        'faceplate-timeago',
        'a[data-ks-id]',
        'shreddit-post[data-ks-item]',
        'a[slot="full-post-link"]',
        'span[slot="credit-bar"]',
        'shreddit-post-flair',
        'shreddit-join-button',
        'shreddit-post-overflow-menu',
        'shreddit-async-loader',
        'faceplate-hovercard',
        'faceplate-tracker',
        'faceplate-number',
        'shreddit-distinguished-post-tags',
        'div._1OVBBWLtHoSPfGCRaPzpTf',
        'div.wBtTDilkW_zr1D60d6V2Z',
        'div._3Qkp11fjcAw9I9wtLo8frE',
        'div._1HSQGYlfPWzs40LP8sZqzT',
        'div._2vEf-C2keJaBMY9qk_BxVn',
        'div._2QmHYFeMADTpuXJtd36LQs',
        'form',
        'input',
        'textarea',
        'button',
        'button._3QMG29bQNj9RUoGMvSHpZg',
        'button._10K5i7NW6qcm-UoCtpB3aK',
        'div._3QMG29bQNj9RUoGMvSHpZg, div._10K5i7NW6qcm-UoCtpB3aK',
        'div._1ixsU4oQRnNfZ91jhBU74y',
        'div._3-SW6hQX6gXK9G4FM74obr',
        'div._2hw0iZ3L5x8UbnfX8ZDKb',
        'div[data-testid="post-comment-header"]',
        'div[data-click-id="upvote"]',
        'div[data-click-id="downvote"]',
        'div[data-click-id="share"]',
        'div[data-click-id="comments"]',
        'div[data-post-click-location="text-body"]',
        'div.md.feed-card-text-preview',
        'div#feed-post-credit-bar',
        'span.created-separator',
        'span.inline-block.my-0.created-separator',
        'div[data-testid="post-content"]',
        'button._2pFdCpgBihIaYh9DSMWBIu',
        'div._1E9mcoVn4MYnuBQSVDt1gC',
        'span._vaFo96phV6L5Hltvwcox',
        'div._2X6EB3ZhEeXCh1eIVA64XM, div._1hwEKkB_38tIoal6fcdrt9',
        'div._3nSp9cdBpqL13CqjdMr2L_',
        'div._2FKpII1jz0h6xCAw1kQAvS, div._2xLbdLcm9WYMj6tMTDwBmf',
        'div._3U_7i38RDFqmOFXMuRZYvZ, div._VmOLt6lJfSjP8Pr5DL9T',
        'span[data-testid="community-hover-card:active-count"]',
        'span.bg-kiwigreen-400',
        'span.text-12.leading-4.text-neutral-content-weak',
        'a[href="/settings"]',
        'div[role="menu"]',
        'div[role="button"]',
        'div._JRBNstMcGxbZUxrrIKXe, div._2IHh1GBfUxJVQQX0dJvAEf',
        'div._3MknXZVbkWU8JL9XGlzASi, div._3Z6MIaeww5FJSez7H2YWXi',
        'div[data-adclicklocation="top_bar"]',
        'a[data-click-id="subreddit"]',
        'div.promotedlink',
        'div._3Qkp11fjcAw9I9wtLo8frE div._2vEf-C2keJaBMY9qk_BxVn',
        'div[data-before-content="advertisement"]',
        'div[data-testid="post-container"][data-promoted="true"]',
        'div[data-testid="post"][data-promoted="true"]',
        'div.ad-container, div.AdPlace',
        'div._2dkUkgReBsuY2IHM9aAHMx',
        'input[name="q"]',
        'div._1LganuXpbKgkYX39pbmrCl, form._1QxZxZ9ntXPkuXMnfDTHzH',
        'footer',
        'div._3w_665DK_NH7yIsRMuZkqB',
        'div._3Wl-riAhLCZuDLzWNbD_z6',
        'div._3qX0zy2NNkra76bgyHbrcR, div._10YWGZZj2W-2J7T-IJVVNU',
        'a[data-testid="post_author_link"]',
        'a.author',
        'span.author',
        'a[data-testid="comment_author_link"]',
        'div._2mHuuvyV9doV3zwbZPtIPG',
        'a._3BcIEQadBHDKnV8E-qUMtJ',
        'div._23wugcdiaj44hdfugIAlnX',
        'div[data-testid="comment_author"]',
        'span._12nHw-MGuz_r1dQx4wxxAf, a._12nHw-MGuz_r1dQx4wxxAf',
        'div[data-testid="subreddit-sidebar"] div._3ryJoIoycVkI7DggMcJiKM',
        'span._1jNPl3YUk6zbpLWdjaJT1r',
        'div._2ETuFsOP3jKbVR95iRImaDvU-g6W3dAQ',
        'div._3-SW6hQX6gXK9G4FM74obr span',
        'div._3XFx6CfPlg-4Usgxm0gK8R, div.BilRyRl5iuFY2VJoNfVz0',
        'div._11dVAO6CK-nOlDyrYr6tsX, div._3ioGMz1QkHcUCVgLx3kzOQ',
        'div._2hYRM7d0BaB17cCB3FGmm9',
        'div._3q-XSJ2JokLxfTqcOzQxzf',
        'div[data-redditstyle="true"] div._1DooEIX-1Nj5rweIc5cw_E',
        'div._31L5xyMG1DzvGnqhbHkKV4, div._3NpZ0JJ2ZEBZXLpt7AMxgW',
        'div._3Im6OD67aKo33nql4FpSp0, div._2zeq1aXKDHDDXUNXAJyRVk',
        'div._2vkeRJojnV7cb9pMlPHy7d',
        'div[data-testid="frontpage-sidebar"]',
        'div._2vEf-C2keJaBMY9qk_BxVn button',
        'div[data-testid="subreddit-name"]',
        'div._2x02fRB8KYZPG74bIR0jpe',
        'div[data-test-id="post-content"] video',
        'div._3gbb_EMFXxTYrxDZ2kusIp',
        'div._1sDtEhccxFpHDn2ruDutJe',
        'div._2wKMjKBrZFbRMP33ghA1uI',
        'div._3_HlHJ56dAfStT19Jgl1bF',
        'div._pGofQ7zn0wPWxvde-6HDL',
        'div._33axOHPa8DzNnTmwzen-wO',
        'div._2hgXdc8jVQaXYAXvnqVBBh, div._1yxKmMhLFJJp2CfU1jFZz5',
        'div._2FbYTP2kJW6pyJnjwLWr8f, div._3bl3XkXsAgnvhW0Ghm6Dh-',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) {
            debugLog('Reddit', '选择器匹配跳过', selector, node.textContent);
            return true;
        }
    }

    const skipDataAttributes = [
        'click-id="share"', 'click-id="upvote"', 'click-id="downvote"', 'click-id="award"',
        'click-id="comments"', 'click-id="save"', 'click-id="vote-arrows"', 'click-id="media"',
        'adclicklocation', 'promoted="true"', 'test-id="comment-top-meta"'
    ];

    for (const attr of skipDataAttributes) {
        if (node.hasAttribute && node.hasAttribute(attr)) {
            debugLog('Reddit', '数据属性匹配跳过', attr);
            return true;
        }
    }

    const skipClassKeywords = [
        '_', 'icon', 'Button', 'vote', 'score', 'flair', 'author',
        'award', 'caret', 'expando', 'menu', 'hover', 'promoted',
        'badge', 'thumbnail', 'timestamp', 'banner', 'nav',
        'submit', 'upvote', 'downvote', 'premium', 'moderator', 'join',
        'subscribe', 'share', 'save', 'expand', 'collapse', 'points'
    ];

    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword) && (node.textContent?.length ?? 0) < 20) {
                debugLog('Reddit', '类名关键字跳过', keyword, node.className);
                return true;
            }
        }
    }

    const textContent = node.textContent?.trim();
    if (textContent) {
        if (/^u\/\w+$/.test(textContent)) {
            debugLog('Reddit', '用户名格式跳过', textContent);
            return true;
        }
        if (/^r\/\w+$/.test(textContent)) {
            debugLog('Reddit', '社区名格式跳过', textContent);
            return true;
        }
        if (/^\d+(\.\d+)?[kKmM]?$/.test(textContent) || /^[+-]?\d+(\.\d+)?[kKmM]?$/.test(textContent)) {
            debugLog('Reddit', '投票计数跳过', textContent);
            return true;
        }
        if (/^(Posted )?\d+ (minutes|hours|days|weeks|months|years) ago$/.test(textContent)) {
            debugLog('Reddit', '时间戳跳过', textContent);
            return true;
        }
        if (/^\d+(\.\d+)?[kKmM]? comments?$/.test(textContent)) {
            debugLog('Reddit', '评论计数跳过', textContent);
            return true;
        }
        if (/^\s*\d+[KkMmBb]?\s*$/.test(textContent)) {
            debugLog('Reddit', '统计数字跳过', textContent);
            return true;
        }

        const skipPhrases = [
            'upvote', 'downvote', 'share', 'save', 'hide', 'report', 'crosspost',
            'award', 'reply', 'give award', 'comments', 'comment',
            'best', 'top', 'new', 'controversial', 'old', 'random', 'live',
            'hot', 'rising', 'gilded', 'wiki', 'mod', 'moderator', 'approved',
            'submission', 'removed', 'spam', 'reported', 'locked', 'unlocked',
            'pinned', 'unpinned', 'archived', 'unarchived', 'distinguished',
            'undistinguished', 'spoiler', 'nsfw', 'upvoted', 'downvoted',
            'follow', 'join', 'create post', 'community options', 'sort by',
            'leave', 'view all comments', 'more comments', 'continue this thread',
            'copy link', 'mark as spoiler', 'delete', 'edit', 'embed',
            'follow thread', 'add to collection', 'post insights', 'view poll',
            'download', 'open in app', 'view community'
        ];

        for (const phrase of skipPhrases) {
            if (textContent.toLowerCase() === phrase) {
                debugLog('Reddit', '常用UI文本跳过', textContent);
                return true;
            }
        }
    }

    if (node.tagName?.toLowerCase() === 'pre' || node.tagName?.toLowerCase() === 'code') {
        debugLog('Reddit', '代码片段跳过');
        return true;
    }

    if (node.tagName?.toLowerCase() === 'svg' || node.tagName?.toLowerCase() === 'img') {
        debugLog('Reddit', '图片/图标跳过');
        return true;
    }

    return false;
}
