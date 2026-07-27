import { defineConfig } from 'vitepress';

const siteUrl = 'https://onlytranslate.top';
const description = '给认真读外语内容的人：网页、视频字幕和本地 EPUB，都能在浏览器里双语阅读。';

export default defineConfig({
  lang: 'zh-CN',
  title: '只译 OnlyTranslate',
  description,
  cleanUrls: true,
  sitemap: {
    hostname: siteUrl,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['meta', { name: 'theme-color', content: '#255fdf' }],
    ['meta', { name: 'author', content: 'OnlyTranslate contributors' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:site_name', content: '只译 OnlyTranslate' }],
    ['meta', { property: 'og:title', content: '只译：网页、视频、电子书，都能双语读' }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:url', content: siteUrl }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: '只译：网页、视频、电子书，都能双语读' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: '只译：网页、视频、电子书，都能双语读' }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og.png` }],
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: '只译 OnlyTranslate',
        operatingSystem: 'Chrome',
        applicationCategory: 'BrowserApplication',
        description,
        url: siteUrl,
        downloadUrl:
          'https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi',
        license: 'https://www.gnu.org/licenses/gpl-3.0.html',
        isAccessibleForFree: true,
      }),
    ],
  ],
  themeConfig: {
    logo: '/icon.png',
    siteTitle: '只译 OnlyTranslate',
    nav: [
      { text: '首页', link: '/' },
      { text: '隐私说明', link: '/privacy' },
      { text: '使用帮助', link: '/help' },
      {
        text: '安装扩展',
        link: 'https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi',
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/airhunter/OnlyTranslate' },
    ],
    footer: {
      message:
        '只译基于 FluentRead 继续开发，遵循 GNU GPL v3.0 协议开源。',
      copyright: 'OnlyTranslate contributors',
    },
    outline: {
      level: [2, 3],
      label: '本页内容',
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'medium',
      },
    },
  },
});
