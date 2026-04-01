export interface PlatformConfig {
    id: string
    matches: string[]           // 匹配的 hostname 关键词
    subtitleUrlPatterns: string[] // 字幕 URL 的正则字符串
    format: 'youtube-xml' | 'vtt'
    videoSelector: string       // <video> 元素选择器
    containerSelector: string   // 字幕层挂载目标选择器
    hideNativeSelector?: string // 需要隐藏的原生字幕容器
}

export const platforms: PlatformConfig[] = [
    {
        id: 'youtube',
        matches: ['youtube.com', 'youtubekids.com'],
        subtitleUrlPatterns: ['/api/timedtext'],
        format: 'youtube-xml',
        videoSelector: '.html5-video-player video',
        containerSelector: '.html5-video-player',
        hideNativeSelector: '.ytp-caption-window-container',
    },
    {
        // 通用 WebVTT：覆盖 Udemy / Coursera / Khan Academy 等大多数学习平台
        id: 'generic-vtt',
        matches: ['*'],
        subtitleUrlPatterns: ['\\.vtt(\\?|#|$)', 'subtitles?.*\\.vtt', '/captions/'],
        format: 'vtt',
        videoSelector: 'video',
        containerSelector: '',  // 动态确定：video.parentElement
    },
]

/**
 * 根据当前 hostname 匹配平台配置。
 * 优先返回精确平台，没有则返回通用 VTT 兜底。
 */
export function detectPlatform(hostname: string): PlatformConfig {
    for (const platform of platforms) {
        if (platform.id === 'generic-vtt') continue
        if (platform.matches.some(m => hostname.includes(m))) {
            return platform
        }
    }
    return platforms.find(p => p.id === 'generic-vtt')!
}

/** 返回所有平台的字幕 URL 正则列表（去重），发送给注入脚本 */
export function getAllSubtitlePatterns(): string[] {
    const set = new Set<string>()
    for (const platform of platforms) {
        for (const pattern of platform.subtitleUrlPatterns) {
            set.add(pattern)
        }
    }
    return Array.from(set)
}
