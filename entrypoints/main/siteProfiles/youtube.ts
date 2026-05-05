import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';
import { debugLog, isSpecialContent } from './utils';

const parser = new DOMParser();

export const youtubeProfile: SiteProfile = {
    id: 'youtube',
    domains: ['youtube.com'],
    replace: (node, text) => {
        const doc = parser.parseFromString(text, 'text/html');
        const newNode = doc.body.firstChild as HTMLElement;

        if (node.tagName.toLowerCase() === 'yt-formatted-string') {
            if (node.hasAttribute('has-link-only_')) {
                node.innerHTML = newNode.innerHTML;
                return;
            }

            if (node.querySelector('a') || node.querySelector('span')) {
                const links = node.querySelectorAll('a');
                const spans = node.querySelectorAll('span');

                if (links.length > 0 || spans.length > 0) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newNode.innerHTML;

                    node.childNodes.forEach((child: Node) => {
                        if (child.nodeType === Node.ELEMENT_NODE) {
                            if (child.nodeName.toLowerCase() === 'a' || child.nodeName.toLowerCase() === 'span') {
                                (child as HTMLElement).textContent = tempDiv.textContent || '';
                            }
                        }
                    });
                    return;
                }
            }
        }

        node.innerHTML = newNode.innerHTML;
    },
    select: (node) => {
        if (shouldSkipYouTubeElement(node)) {
            debugLog('Compat', '跳过YouTube元素:', node.textContent);
            return { skip: true };
        }

        const videoTitle = findMatchingElement(node, 'h1.title');
        if (videoTitle) {
            debugLog('YouTube', '翻译视频标题', videoTitle.textContent);
            return videoTitle;
        }

        const videoDescription = findMatchingElement(node, 'div#description-inline-expander');
        if (videoDescription) {
            debugLog('YouTube', '翻译视频描述', videoDescription.textContent?.substring(0, 50) + '...');
            return videoDescription;
        }

        const commentContent = findMatchingElement(node, 'yt-formatted-string#content-text');
        if (commentContent) {
            debugLog('YouTube', '翻译评论内容', commentContent.textContent);
            return commentContent;
        }

        const channelDescription = findMatchingElement(node, 'div#description');
        if (channelDescription) {
            debugLog('YouTube', '翻译频道简介', channelDescription.textContent?.substring(0, 50) + '...');
            return channelDescription;
        }

        const playlistDescription = findMatchingElement(node, 'yt-formatted-string.ytd-playlist-panel-renderer');
        if (playlistDescription) {
            debugLog('YouTube', '翻译播放列表描述', playlistDescription.textContent);
            return playlistDescription;
        }

        const videoCardTitle = findMatchingElement(node, 'yt-formatted-string.ytd-compact-video-renderer');
        if (videoCardTitle) {
            debugLog('YouTube', '翻译视频卡片标题', videoCardTitle.textContent);
            return videoCardTitle;
        }

        const communityPost = findMatchingElement(node, 'div#content');
        if (communityPost && communityPost.closest('ytd-backstage-post-renderer')) {
            debugLog('YouTube', '翻译社区帖子', communityPost.textContent?.substring(0, 50) + '...');
            return communityPost;
        }

        const captionText = findMatchingElement(node, 'span.captions-text');
        if (captionText) {
            debugLog('YouTube', '翻译字幕内容', captionText.textContent);
            return captionText;
        }

        if (node.tagName.toLowerCase() === 'yt-formatted-string'
            && node.textContent?.trim()
            && node.textContent.length > 5) {
            let isInControl = false;
            let parent = node.parentElement;
            while (parent) {
                if (parent.id === 'top-level-buttons-computed'
                    || parent.id === 'subscribe-button'
                    || parent.classList?.contains('ytd-menu-renderer')) {
                    isInControl = true;
                    break;
                }
                parent = parent.parentElement;
            }

            if (!isInControl) {
                debugLog('YouTube', '翻译格式化字符串', node.textContent);
                return node;
            }
        }

        return false;
    }
};

function shouldSkipYouTubeElement(node: Element): boolean {
    if (node.textContent && isSpecialContent(node.textContent)) {
        debugLog('YouTube', '特殊内容跳过', node.textContent);
        return true;
    }

    const skipSelectors = [
        'div#masthead-container',
        'div#guide-content',
        'ytd-mini-guide-renderer',
        'div#buttons',
        'ytd-topbar-menu-button-renderer',
        'ytd-guide-entry-renderer',
        'ytd-guide-section-renderer h3',
        'div#channel-header',
        'div#channel-navigation',
        'div.ytp-chrome-bottom',
        'div.ytp-chrome-top',
        'div.ytp-right-controls',
        'div.ytp-left-controls',
        'div.ytp-progress-bar-container',
        'span.ytp-time-current',
        'span.ytp-time-duration',
        'button.ytp-button',
        'div.ytp-chapter-container',
        'div#info-contents ytd-video-primary-info-renderer div#top-level-buttons-computed',
        'span#dot',
        'span.ytd-video-view-count-renderer',
        'span.ytd-video-owner-renderer',
        'div#owner',
        'a.ytd-video-owner-renderer',
        'ytd-subscribe-button-renderer',
        'div.ytd-subscribe-button-renderer',
        'ytd-button-renderer',
        'ytd-menu-renderer',
        'ytd-badge-supported-renderer',
        'div#sponsor-button',
        'div#action-buttons',
        'ytd-toggle-button-renderer',
        'div#vote-count-middle',
        'ytd-comments-header-renderer',
        'div#title.ytd-comments-header-renderer',
        'span.ytd-comments-header-renderer',
        'ytd-sort-filter-sub-menu-renderer',
        'ytd-comment-action-buttons-renderer',
        'div.ytd-metadata-row-container-renderer',
        'div#subscribe-button',
        'span.ytd-channel-name',
        'div#owner-sub-count',
        'div.ytd-watch-metadata yt-formatted-string[is-empty]',
        'ytd-metadata-row-renderer',
        'div#above-the-fold',
        'div#primary-inner ytd-merch-shelf-renderer',
        'div.ytd-structured-description-content-renderer',
        'ytd-info-panel-content-renderer',
        'ytd-info-panel-container-renderer',
        'span.ytd-thumbnail-overlay-time-status-renderer',
        'span.ytd-video-meta-block',
        'div#metadata-line',
        'span.ytd-grid-video-renderer',
        'div#video-title.ytd-grid-video-renderer',
        'a.yt-simple-endpoint.ytd-grid-video-renderer',
        'ytd-thumbnail',
        'div#hover-overlays',
        'button',
        'yt-icon',
        'a.yt-simple-endpoint[href^="/hashtag/"]',
        'a.yt-simple-endpoint[href^="/channel/"]',
        'div#text.ytd-channel-name',
        'span.yt-core-attributed-string--link-inherit-color',
        'ytd-notification-topbar-button-renderer',
        'ytd-searchbox',
        'ytd-dropdown-renderer',
        'ytd-live-chat-frame',
        'ytd-playlist-header-renderer div#stats',
        'ytd-playlist-panel-renderer div#header-count',
        'ytd-playlist-panel-renderer div#play-button',
        'ytd-playlist-panel-renderer a.ytd-playlist-panel-video-renderer',
        'ytd-playlist-byline-renderer',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) {
            debugLog('YouTube', '选择器匹配跳过', selector, node.textContent);
            return true;
        }
    }

    const skipClassKeywords = ['ytp-', 'button', 'badge', 'menu', 'selector', 'icon', 'thumbnail', 'avatar'];
    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword)) {
                debugLog('YouTube', '类名关键字跳过', keyword, node.className);
                return true;
            }
        }
    }

    const textContent = node.textContent?.trim();
    if (textContent) {
        if (/^\d+(\.\d+)?[KMB]?$/.test(textContent)) {
            debugLog('YouTube', '数字计数跳过', textContent);
            return true;
        }
        if (/^\d+:\d+$/.test(textContent) || /^\d+:\d+:\d+$/.test(textContent)) {
            debugLog('YouTube', '时间格式跳过', textContent);
            return true;
        }
        if (/^\d+(\.\d+)?[KMB]? views/.test(textContent)
            || /\d+ (days|months|years) ago$/.test(textContent)
            || /^\d+(\.\d+)?[KMB]? watching now$/.test(textContent)) {
            debugLog('YouTube', '视图计数/日期跳过', textContent);
            return true;
        }

        const skipPhrases = [
            'Subscribe', 'subscribed', 'subscribers', 'Join', 'Share', 'Save',
            'Report', 'Download', 'Add to', 'Show more', 'Show less',
            'Like', 'Dislike', 'Reply', 'Sort by', 'Top comments', 'Newest first',
            'Edit', 'View', 'playlist', 'Autoplay', 'Cast', 'Settings', 'Play',
            'Pause', 'Stream', 'Live', 'Premiere', 'Premieres', 'Premiered',
            'Skip', 'Next', 'Previous', 'Shuffle', 'Transcript', 'Captions',
            'Quality', 'Playback speed', 'More', 'Stats for nerds'
        ];

        for (const phrase of skipPhrases) {
            if (textContent.includes(phrase) && textContent.length < 30) {
                debugLog('YouTube', '特定短语跳过', phrase, textContent);
                return true;
            }
        }

        if (/^@\w+$/.test(textContent) || (textContent.startsWith('@') && textContent.length < 30)) {
            debugLog('YouTube', '频道/用户名跳过', textContent);
            return true;
        }
    }

    if (node.tagName?.toLowerCase() === 'svg' || node.tagName?.toLowerCase() === 'img') {
        debugLog('YouTube', '图标/图像跳过');
        return true;
    }

    return false;
}
