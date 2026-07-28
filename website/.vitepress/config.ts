import {
  defineConfig,
  type DefaultTheme,
  type HeadConfig,
} from 'vitepress';

const siteUrl = 'https://onlytranslate.top';
const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi';

type LocaleKey = 'root' | 'en' | 'zh-tw' | 'ja';

interface LocaleDefinition {
  label: string;
  lang: string;
  ogLocale: string;
  title: string;
  description: string;
  base: string;
  theme: DefaultTheme.Config;
}

function localPath(base: string, path = '') {
  return `${base}${path}`;
}

function createTheme(
  base: string,
  labels: {
    siteTitle: string;
    home: string;
    privacy: string;
    help: string;
    install: string;
    footer: string;
    outline: string;
    prev: string;
    next: string;
    appearance: string;
    light: string;
    dark: string;
    menu: string;
    top: string;
    language: string;
    skip: string;
    notFound: string;
    notFoundQuote: string;
    homeLinkLabel: string;
    homeLinkText: string;
  },
): DefaultTheme.Config {
  return {
    siteTitle: labels.siteTitle,
    nav: [
      { text: labels.home, link: base },
      { text: labels.privacy, link: localPath(base, 'privacy') },
      { text: labels.help, link: localPath(base, 'help') },
      { text: labels.install, link: chromeWebStoreUrl },
    ],
    footer: {
      message: labels.footer,
      copyright: 'OnlyTranslate contributors',
    },
    outline: {
      level: [2, 3],
      label: labels.outline,
    },
    docFooter: {
      prev: labels.prev,
      next: labels.next,
    },
    darkModeSwitchLabel: labels.appearance,
    lightModeSwitchTitle: labels.light,
    darkModeSwitchTitle: labels.dark,
    sidebarMenuLabel: labels.menu,
    returnToTopLabel: labels.top,
    langMenuLabel: labels.language,
    skipToContentLabel: labels.skip,
    notFound: {
      title: labels.notFound,
      quote: labels.notFoundQuote,
      linkLabel: labels.homeLinkLabel,
      linkText: labels.homeLinkText,
    },
  };
}

const localeDefinitions: Record<LocaleKey, LocaleDefinition> = {
  root: {
    label: '简体中文',
    lang: 'zh-CN',
    ogLocale: 'zh_CN',
    title: '只译 OnlyTranslate',
    description: '给认真读外语内容的人：网页、视频字幕和本地 EPUB，都能在浏览器里双语阅读。',
    base: '/',
    theme: createTheme('/', {
      siteTitle: '只译 OnlyTranslate',
      home: '首页',
      privacy: '隐私说明',
      help: '使用帮助',
      install: '安装扩展',
      footer: '只译基于 FluentRead 继续开发，遵循 GNU GPL v3.0 协议开源。',
      outline: '本页内容',
      prev: '上一页',
      next: '下一页',
      appearance: '外观',
      light: '切换到浅色主题',
      dark: '切换到深色主题',
      menu: '菜单',
      top: '返回顶部',
      language: '切换语言',
      skip: '跳到正文',
      notFound: '页面未找到',
      notFoundQuote: '这个页面不存在或已被移动。',
      homeLinkLabel: '返回首页',
      homeLinkText: '返回首页',
    }),
  },
  en: {
    label: 'English',
    lang: 'en-US',
    ogLocale: 'en_US',
    title: 'OnlyTranslate',
    description: 'Bilingual reading for web pages, video subtitles, and local EPUB books—right in your browser.',
    base: '/en/',
    theme: createTheme('/en/', {
      siteTitle: 'OnlyTranslate',
      home: 'Home',
      privacy: 'Privacy',
      help: 'User guide',
      install: 'Install',
      footer: 'OnlyTranslate continues development from FluentRead and is open source under GNU GPL v3.0.',
      outline: 'On this page',
      prev: 'Previous page',
      next: 'Next page',
      appearance: 'Appearance',
      light: 'Switch to light theme',
      dark: 'Switch to dark theme',
      menu: 'Menu',
      top: 'Return to top',
      language: 'Change language',
      skip: 'Skip to content',
      notFound: 'Page not found',
      notFoundQuote: 'This page does not exist or has moved.',
      homeLinkLabel: 'Go to home',
      homeLinkText: 'Take me home',
    }),
  },
  'zh-tw': {
    label: '繁體中文',
    lang: 'zh-TW',
    ogLocale: 'zh_TW',
    title: '只譯 OnlyTranslate',
    description: '為認真閱讀外語內容的人而做：在瀏覽器中以雙語閱讀網頁、影片字幕與本機 EPUB。',
    base: '/zh-tw/',
    theme: createTheme('/zh-tw/', {
      siteTitle: '只譯 OnlyTranslate',
      home: '首頁',
      privacy: '隱私說明',
      help: '使用說明',
      install: '安裝擴充功能',
      footer: '只譯基於 FluentRead 繼續開發，並依 GNU GPL v3.0 授權開源。',
      outline: '本頁內容',
      prev: '上一頁',
      next: '下一頁',
      appearance: '外觀',
      light: '切換到淺色主題',
      dark: '切換到深色主題',
      menu: '選單',
      top: '返回頂端',
      language: '切換語言',
      skip: '跳至正文',
      notFound: '找不到頁面',
      notFoundQuote: '此頁面不存在或已被移動。',
      homeLinkLabel: '返回首頁',
      homeLinkText: '返回首頁',
    }),
  },
  ja: {
    label: '日本語',
    lang: 'ja-JP',
    ogLocale: 'ja_JP',
    title: 'OnlyTranslate',
    description: 'ウェブページ、動画字幕、ローカル EPUB をブラウザーで原文と訳文を並べて読める翻訳拡張機能。',
    base: '/ja/',
    theme: createTheme('/ja/', {
      siteTitle: 'OnlyTranslate',
      home: 'ホーム',
      privacy: 'プライバシー',
      help: '使い方',
      install: 'インストール',
      footer: 'OnlyTranslate は FluentRead を基に開発を継続し、GNU GPL v3.0 で公開しています。',
      outline: 'このページの内容',
      prev: '前のページ',
      next: '次のページ',
      appearance: '外観',
      light: 'ライトテーマに切り替える',
      dark: 'ダークテーマに切り替える',
      menu: 'メニュー',
      top: 'ページ上部へ戻る',
      language: '言語を変更',
      skip: '本文へ移動',
      notFound: 'ページが見つかりません',
      notFoundQuote: 'このページは存在しないか、移動しました。',
      homeLinkLabel: 'ホームへ戻る',
      homeLinkText: 'ホームへ戻る',
    }),
  },
};

function resolvePageLocale(relativePath: string): {
  localeKey: LocaleKey;
  logicalPath: string;
} {
  for (const localeKey of ['en', 'zh-tw', 'ja'] as const) {
    const prefix = `${localeKey}/`;
    if (relativePath.startsWith(prefix)) {
      return {
        localeKey,
        logicalPath: relativePath.slice(prefix.length),
      };
    }
  }

  return { localeKey: 'root', logicalPath: relativePath };
}

function relativePathForLocale(logicalPath: string, localeKey: LocaleKey) {
  return localeKey === 'root' ? logicalPath : `${localeKey}/${logicalPath}`;
}

function routeFromRelativePath(relativePath: string) {
  const withoutExtension = relativePath.replace(/\.md$/, '');
  if (withoutExtension === 'index') return '/';
  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'index'.length)}`;
  }
  return `/${withoutExtension}`;
}

function absolutePageUrl(relativePath: string) {
  return `${siteUrl}${routeFromRelativePath(relativePath)}`;
}

export default defineConfig({
  cleanUrls: true,
  sitemap: {
    hostname: siteUrl,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['meta', { name: 'theme-color', content: '#255fdf' }],
    ['meta', { name: 'author', content: 'OnlyTranslate contributors' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  locales: Object.fromEntries(
    Object.entries(localeDefinitions).map(([key, locale]) => [
      key,
      {
        label: locale.label,
        lang: locale.lang,
        link: locale.base,
        title: locale.title,
        description: locale.description,
        themeConfig: locale.theme,
      },
    ]),
  ),
  themeConfig: {
    logo: '/icon.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/airhunter/OnlyTranslate' },
    ],
    externalLinkIcon: true,
    i18nRouting: true,
  },
  transformPageData(pageData) {
    const { localeKey, logicalPath } = resolvePageLocale(pageData.relativePath);
    const locale = localeDefinitions[localeKey];
    const canonicalUrl = absolutePageUrl(pageData.relativePath);
    const socialTitle =
      logicalPath === 'index.md'
        ? pageData.title
        : `${pageData.title} | ${locale.title}`;
    const description = pageData.description || locale.description;
    const socialImage = `${siteUrl}/${
      localeKey === 'root' ? 'og.png' : 'og-global.png'
    }`;
    const localizedPages = (Object.keys(localeDefinitions) as LocaleKey[]).map(
      (targetLocale) => ({
        locale: localeDefinitions[targetLocale],
        url: absolutePageUrl(
          relativePathForLocale(logicalPath, targetLocale),
        ),
      }),
    );

    const localizedHead: HeadConfig[] = [
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ...localizedPages.map(({ locale: targetLocale, url }) => [
        'link',
        { rel: 'alternate', hreflang: targetLocale.lang, href: url },
      ] as HeadConfig),
      ['link', {
        rel: 'alternate',
        hreflang: 'x-default',
        href: absolutePageUrl(relativePathForLocale(logicalPath, 'root')),
      }],
      ['meta', { property: 'og:locale', content: locale.ogLocale }],
      ...localizedPages
        .filter(({ locale: targetLocale }) => targetLocale.lang !== locale.lang)
        .map(({ locale: targetLocale }) => [
          'meta',
          { property: 'og:locale:alternate', content: targetLocale.ogLocale },
        ] as HeadConfig),
      ['meta', { property: 'og:site_name', content: locale.title }],
      ['meta', { property: 'og:title', content: socialTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:image', content: socialImage }],
      ['meta', { property: 'og:image:alt', content: socialTitle }],
      ['meta', { name: 'twitter:title', content: socialTitle }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: socialImage }],
      ['meta', { name: 'twitter:image:alt', content: socialTitle }],
    ];

    if (logicalPath === 'index.md') {
      localizedHead.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: locale.title,
          operatingSystem: 'Chrome',
          applicationCategory: 'BrowserApplication',
          description,
          url: canonicalUrl,
          downloadUrl: chromeWebStoreUrl,
          license: 'https://www.gnu.org/licenses/gpl-3.0.html',
          isAccessibleForFree: true,
          inLanguage: locale.lang,
        }),
      ]);
    }

    pageData.frontmatter.head = [
      ...(pageData.frontmatter.head || []),
      ...localizedHead,
    ];
  },
});
