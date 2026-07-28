export type WebsiteLocale = 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP';

export type DemoId = 'web' | 'video' | 'epub';

interface HomeCopy {
  brand: {
    name: string;
    subtitle: string;
    homeAria: string;
  };
  language: {
    label: string;
  };
  nav: {
    aria: string;
    demo: string;
    services: string;
    privacy: string;
    faq: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    install: string;
    source: string;
    issues: string;
    trustAria: string;
    trustItems: string[];
    visualAria: string;
    browserLabel: string;
    screenshotAlt: string;
    smart: string;
    smartDetail: string;
    bilingual: string;
    bilingualDetail: string;
  };
  proof: {
    aria: string;
    items: Array<{ title: string; detail: string }>;
  };
  demo: {
    sectionLabel: string;
    title: string;
    description: string;
    tabsAria: string;
    unsupported: string;
    items: Record<DemoId, {
      tab: string;
      label: string;
      title: string;
      ariaLabel: string;
      note?: string;
    }>;
  };
  services: {
    sectionLabel: string;
    title: string;
    description: string;
    finePrint: string;
    aria: string;
    providers: string[];
  };
  privacy: {
    sectionLabel: string;
    title: string;
    description: string;
    cards: Array<{ title: string; detail: string }>;
    fullPolicy: string;
    source: string;
  };
  steps: {
    sectionLabel: string;
    title: string;
    items: Array<{ title: string; detail: string }>;
  };
  limits: {
    label: string;
    title: string;
    items: string[];
  };
  faq: {
    sectionLabel: string;
    title: string;
    introBefore: string;
    introLink: string;
    introAfter: string;
    items: Array<{ question: string; answer: string }>;
    relationQuestion: string;
    relationBefore: string;
    fluentRead: string;
    relationAfter: string;
  };
  cta: {
    label: string;
    opening: string;
    scenes: string;
    promise: string;
    install: string;
    releases: string;
    source: string;
  };
  footer: {
    aria: string;
    releases: string;
    issues: string;
    help: string;
    privacy: string;
    license: string;
  };
}

export const websiteLocaleRoutes: Record<WebsiteLocale, string> = {
  'zh-CN': '/',
  'en-US': '/en/',
  'zh-TW': '/zh-tw/',
  'ja-JP': '/ja/',
};

export const websiteLocaleOptions: Array<{
  locale: WebsiteLocale;
  label: string;
  href: string;
}> = [
  { locale: 'zh-CN', label: '简体中文', href: '/' },
  { locale: 'en-US', label: 'English', href: '/en/' },
  { locale: 'zh-TW', label: '繁體中文', href: '/zh-tw/' },
  { locale: 'ja-JP', label: '日本語', href: '/ja/' },
];

export function resolveWebsiteLocale(language: string): WebsiteLocale {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hant')) return 'zh-TW';
  if (normalized.startsWith('ja')) return 'ja-JP';
  return 'zh-CN';
}

export const homeMessages: Record<WebsiteLocale, HomeCopy> = {
  'zh-CN': {
    brand: {
      name: '只译',
      subtitle: 'OnlyTranslate',
      homeAria: '只译 OnlyTranslate 首页',
    },
    language: {
      label: '选择网站语言',
    },
    nav: {
      aria: '页面导航',
      demo: '真实演示',
      services: '翻译服务',
      privacy: '隐私与开源',
      faq: '常见问题',
    },
    hero: {
      eyebrow: '免费开源的 Chrome 翻译扩展',
      titleLine1: '网页、视频、电子书，',
      titleLine2: '都能双语读。',
      lead: '给认真读外语内容的人。只译把译文放回正在阅读的内容里，尽量保留原来的结构和节奏；无需注册只译账号，也不绑定订阅。',
      install: '从 Chrome Web Store 安装',
      source: '查看 GitHub 源码',
      issues: '遇到问题或有建议？前往 GitHub Issues',
      trustAria: '产品特点',
      trustItems: ['无需注册', '自选翻译服务', '本地保存设置'],
      visualAria: '只译网页识文翻译效果',
      browserLabel: '外语文章正在双语阅读',
      screenshotAlt: '只译在真实网页中保留正文原文并插入中文译文',
      smart: '识文',
      smartDetail: '优先处理正文',
      bilingual: '双语',
      bilingualDetail: '原文随时可核对',
    },
    proof: {
      aria: '产品原则',
      items: [
        { title: '免费使用', detail: '扩展本身不含订阅' },
        { title: '开放源码', detail: '遵循 GPL v3 协议' },
        { title: '无需账号', detail: '不建立只译账户体系' },
        { title: '服务自选', detail: '按需要选择翻译服务' },
      ],
    },
    demo: {
      sectionLabel: '01 · 真实演示',
      title: '切换场景，看清每一次双语阅读',
      description: '真实操作展示只译如何在网页、视频和本地电子书中呈现双语内容。',
      tabsAria: '选择真实演示场景',
      unsupported: '你的浏览器暂不支持视频播放。',
      items: {
        web: {
          tab: '网页识文',
          label: '01 · 网页识文',
          title: '留在原网页，只翻正在读的正文',
          ariaLabel: '只译网页识文翻译演示视频',
        },
        video: {
          tab: '视频字幕',
          label: '02 · 视频字幕',
          title: '外语字幕，跟着播放进度双语显示',
          ariaLabel: '只译视频双语字幕真实演示',
        },
        epub: {
          tab: '本地 EPUB',
          label: '03 · 本地 EPUB',
          title: '导入电子书，沿着章节继续双语读',
          ariaLabel: '只译本地 EPUB 双语阅读真实演示',
        },
      },
    },
    services: {
      sectionLabel: '02 · 翻译服务',
      title: '不把你锁进一种服务',
      description: '微软翻译、Google 翻译等免配置服务可以直接使用；如果需要 AI 翻译，也可以填写自己的 API Key。兼容 OpenAI Chat Completions 的接口同样可以接入。',
      finePrint: '只译本身免费；第三方在线服务可能有自己的账号、额度、计费和隐私规则。',
      aria: '支持的翻译服务',
      providers: ['微软翻译', 'Google 翻译', 'Chrome 内置翻译', 'DeepL', 'OpenAI', 'DeepSeek', 'Gemini', 'Claude'],
    },
    privacy: {
      sectionLabel: '03 · 隐私与开源',
      title: '数据去哪里，应该说清楚',
      description: '开源不等于数据不会离开设备。只译把本地保存与在线翻译的边界明确写出来。',
      cards: [
        { title: '只译不要求注册', detail: '没有只译账号，也没有项目方订阅。项目方不收集扩展使用数据。' },
        { title: '阅读数据保存在本地', detail: '设置、缓存、EPUB 书架、阅读进度和书签保存在当前浏览器中。' },
        { title: '在线翻译会发送文本', detail: '开始翻译后，相关文本会发送给你选择的服务商，并受其隐私政策约束。' },
        { title: '源码可以公开检查', detail: '项目遵循 GPL v3 开源，功能实现、问题记录和版本历史均公开可见。' },
      ],
      fullPolicy: '阅读完整隐私说明 →',
      source: '查看项目源码 →',
    },
    steps: {
      sectionLabel: '04 · 开始使用',
      title: '三步开始双语阅读',
      items: [
        { title: '安装只译', detail: '从 Chrome Web Store 安装扩展，并固定到浏览器工具栏。' },
        { title: '选择翻译服务', detail: '免配置服务可以直接使用；AI 服务需要填写对应的 API Key。' },
        { title: '打开正在读的内容', detail: '选择双语对照与识文，开始翻译网页；或进入字幕和 EPUB 场景。' },
      ],
    },
    limits: {
      label: '当前边界',
      title: '有些事情，只译现在还做不到',
      items: [
        '当前主要支持 Chrome；浏览器内部页和扩展商店等受限页面无法运行。',
        '字幕翻译依赖网站已有的可读取字幕，不负责从音频生成字幕。',
        'EPUB 阅读器仍处于 Beta，仅支持本地无 DRM 的 EPUB。',
        '复杂动态网页仍可能出现漏翻或排版问题，可以切换全页模式重试。',
      ],
    },
    faq: {
      sectionLabel: '05 · 常见问题',
      title: '安装前，你可能还想知道',
      introBefore: '没找到答案？可以前往',
      introLink: 'GitHub Issues',
      introAfter: '反馈具体页面和问题。',
      items: [
        { question: '只译收费吗？', answer: '只译本身免费、开源，也不提供项目方订阅。部分第三方翻译服务可能按自己的规则收费。' },
        { question: '需要注册只译账号吗？', answer: '不需要。设置、缓存和电子书数据保存在当前浏览器配置中。' },
        { question: '翻译内容会被上传吗？', answer: '使用在线翻译服务时，待翻译文本会发送给你选择的服务商。可用的 Chrome 内置翻译则在浏览器本地处理。' },
        { question: '为什么有些页面不能翻译？', answer: '浏览器内部页、扩展商店、安全受限页面和部分嵌入内容不允许普通扩展运行；复杂动态页面也可能需要切换到全页模式。' },
        { question: '没有原字幕的视频能翻译吗？', answer: '目前不能。只译读取网站已有字幕进行翻译，不包含语音识别和字幕生成能力。' },
      ],
      relationQuestion: '为什么又做一个翻译扩展？与流畅阅读是什么关系？',
      relationBefore: '只译不是因为现有产品都不够强，而是希望保留一个更克制的选择：不建立新的账号和订阅体系，让用户自己选择翻译服务，专注处理网页、字幕和电子书里的阅读体验。项目基于开源扩展',
      fluentRead: 'FluentRead（流畅阅读）',
      relationAfter: '继续开发，并按照 GPL v3 协议开源。',
    },
    cta: {
      label: 'OnlyTranslate · 只译',
      opening: '小而克制，',
      scenes: '网页、视频、电子书，',
      promise: '让双语阅读更简单。',
      install: '安装只译',
      releases: '查看更新说明',
      source: '查看源码',
    },
    footer: {
      aria: '页脚导航',
      releases: '更新说明',
      issues: '问题反馈',
      help: '使用帮助',
      privacy: '隐私说明',
      license: 'GPL v3 · 免费开源',
    },
  },
  'en-US': {
    brand: {
      name: 'OnlyTranslate',
      subtitle: 'Bilingual reading',
      homeAria: 'OnlyTranslate home',
    },
    language: {
      label: 'Choose website language',
    },
    nav: {
      aria: 'Page navigation',
      demo: 'Live demos',
      services: 'Translation services',
      privacy: 'Privacy & open source',
      faq: 'FAQ',
    },
    hero: {
      eyebrow: 'A free, open-source Chrome translation extension',
      titleLine1: 'Web pages, videos, and ebooks—',
      titleLine2: 'read them bilingually.',
      lead: 'Built for people who read carefully in another language. OnlyTranslate places translations back into what you are reading while preserving the original structure and rhythm. No OnlyTranslate account or subscription required.',
      install: 'Install from Chrome Web Store',
      source: 'View source on GitHub',
      issues: 'Have a problem or suggestion? Open a GitHub issue',
      trustAria: 'Product highlights',
      trustItems: ['No account required', 'Choose your provider', 'Settings stay local'],
      visualAria: 'OnlyTranslate Smart translation preview',
      browserLabel: 'Reading a foreign-language article bilingually',
      screenshotAlt: 'OnlyTranslate keeps the original webpage structure and adds translations beside the content',
      smart: 'Smart',
      smartDetail: 'Focuses on main content',
      bilingual: 'Bilingual',
      bilingualDetail: 'Keep the original in view',
    },
    proof: {
      aria: 'Product principles',
      items: [
        { title: 'Free to use', detail: 'No subscription for the extension' },
        { title: 'Open source', detail: 'Licensed under GPL v3' },
        { title: 'No account', detail: 'No OnlyTranslate account system' },
        { title: 'Provider choice', detail: 'Use the service that suits you' },
      ],
    },
    demo: {
      sectionLabel: '01 · LIVE DEMOS',
      title: 'Switch scenes and see bilingual reading in action',
      description: 'Real workflows show how OnlyTranslate handles web pages, video subtitles, and local ebooks.',
      tabsAria: 'Choose a demo scene',
      unsupported: 'Your browser does not support video playback.',
      items: {
        web: {
          tab: 'Smart web',
          label: '01 · SMART WEB',
          title: 'Stay on the original page and translate what you are reading',
          ariaLabel: 'OnlyTranslate Smart webpage translation demo',
          note: 'Recorded for the Chinese release: this demo shows English → Chinese. Other language pairs are supported.',
        },
        video: {
          tab: 'Video subtitles',
          label: '02 · VIDEO SUBTITLES',
          title: 'Bilingual subtitles that follow playback',
          ariaLabel: 'OnlyTranslate bilingual video subtitle demo',
          note: 'Recorded for the Chinese release: this demo shows Spanish → Chinese subtitles. Other language pairs are supported.',
        },
        epub: {
          tab: 'Local EPUB',
          label: '03 · LOCAL EPUB',
          title: 'Import an ebook and keep reading chapter by chapter',
          ariaLabel: 'OnlyTranslate local EPUB bilingual reading demo',
          note: 'Recorded for the Chinese release: this demo shows English → Chinese. Other language pairs are supported.',
        },
      },
    },
    services: {
      sectionLabel: '02 · TRANSLATION SERVICES',
      title: 'You are not locked into one provider',
      description: 'No-setup services such as Microsoft Translator and Google Translate work right away. For AI translation, add your own API key. OpenAI Chat Completions-compatible endpoints are supported too.',
      finePrint: 'OnlyTranslate itself is free. Third-party services may have their own accounts, quotas, pricing, and privacy policies.',
      aria: 'Supported translation services',
      providers: ['Microsoft Translator', 'Google Translate', 'Chrome built-in translator', 'DeepL', 'OpenAI', 'DeepSeek', 'Gemini', 'Claude'],
    },
    privacy: {
      sectionLabel: '03 · PRIVACY & OPEN SOURCE',
      title: 'You should know where your data goes',
      description: 'Open source does not automatically mean data never leaves your device. OnlyTranslate clearly separates local storage from online translation.',
      cards: [
        { title: 'No OnlyTranslate account', detail: 'There is no OnlyTranslate account or project subscription, and the project does not collect extension usage data.' },
        { title: 'Reading data stays local', detail: 'Settings, cache, EPUB library, reading progress, and bookmarks stay in your current browser.' },
        { title: 'Online translation sends text', detail: 'When you translate, relevant text is sent to the provider you selected and is governed by its privacy policy.' },
        { title: 'The source is inspectable', detail: 'The project is open source under GPL v3, including its implementation, issue history, and releases.' },
      ],
      fullPolicy: 'Read the full privacy notice →',
      source: 'View the source code →',
    },
    steps: {
      sectionLabel: '04 · GET STARTED',
      title: 'Start bilingual reading in three steps',
      items: [
        { title: 'Install OnlyTranslate', detail: 'Install it from the Chrome Web Store and pin it to your browser toolbar.' },
        { title: 'Choose a translation service', detail: 'No-setup services work immediately; AI services require their corresponding API keys.' },
        { title: 'Open what you want to read', detail: 'Choose Bilingual and Smart to translate a webpage, or open the subtitle and EPUB features.' },
      ],
    },
    limits: {
      label: 'CURRENT LIMITS',
      title: 'What OnlyTranslate cannot do yet',
      items: [
        'Chrome is the primary supported browser. Extensions cannot run on browser-internal pages, extension stores, and other restricted pages.',
        'Subtitle translation requires a readable subtitle track from the website; it does not generate subtitles from audio.',
        'The EPUB reader is still in Beta and supports local DRM-free EPUB files only.',
        'Complex dynamic pages can still have missed text or layout issues. Full page mode is available as a fallback.',
      ],
    },
    faq: {
      sectionLabel: '05 · FAQ',
      title: 'What you may want to know before installing',
      introBefore: 'Could not find an answer? Visit',
      introLink: 'GitHub Issues',
      introAfter: 'and tell us which page or feature is affected.',
      items: [
        { question: 'Does OnlyTranslate cost anything?', answer: 'OnlyTranslate itself is free and open source, with no project subscription. Some third-party translation providers may charge under their own terms.' },
        { question: 'Do I need an OnlyTranslate account?', answer: 'No. Settings, cache, and ebook data are stored in your current browser profile.' },
        { question: 'Is translated content uploaded?', answer: 'When you use an online translation service, the text is sent to the provider you selected. Chrome built-in translation, when available, runs locally in the browser.' },
        { question: 'Why can’t some pages be translated?', answer: 'Browser-internal pages, extension stores, security-restricted pages, and some embedded content do not allow ordinary extensions to run. Complex dynamic pages may also require Full page mode.' },
        { question: 'Can it translate a video without source subtitles?', answer: 'Not currently. OnlyTranslate reads and translates subtitles supplied by the website; it does not include speech recognition or subtitle generation.' },
      ],
      relationQuestion: 'Why another translation extension, and how is it related to FluentRead?',
      relationBefore: 'OnlyTranslate is not based on the idea that every existing product falls short. It preserves a more restrained option: no new account or subscription system, your choice of translation provider, and a focused reading experience for web pages, subtitles, and ebooks. The project continues development from the open-source extension',
      fluentRead: 'FluentRead',
      relationAfter: 'and is released under GPL v3.',
    },
    cta: {
      label: 'OnlyTranslate',
      opening: 'Small and focused—',
      scenes: 'web pages, videos, and ebooks,',
      promise: 'made easier to read bilingually.',
      install: 'Install OnlyTranslate',
      releases: 'View release notes',
      source: 'View source',
    },
    footer: {
      aria: 'Footer navigation',
      releases: 'Release notes',
      issues: 'Report an issue',
      help: 'User guide',
      privacy: 'Privacy notice',
      license: 'GPL v3 · Free and open source',
    },
  },
  'zh-TW': {
    brand: {
      name: '只譯',
      subtitle: 'OnlyTranslate',
      homeAria: '只譯 OnlyTranslate 首頁',
    },
    language: {
      label: '選擇網站語言',
    },
    nav: {
      aria: '頁面導覽',
      demo: '實際示範',
      services: '翻譯服務',
      privacy: '隱私與開源',
      faq: '常見問題',
    },
    hero: {
      eyebrow: '免費開源的 Chrome 翻譯擴充功能',
      titleLine1: '網頁、影片、電子書，',
      titleLine2: '都能雙語閱讀。',
      lead: '為認真閱讀外語內容的人而做。只譯會把譯文放回正在閱讀的內容中，盡量保留原有結構與節奏；不必註冊只譯帳號，也沒有綁定訂閱。',
      install: '從 Chrome 線上應用程式商店安裝',
      source: '查看 GitHub 原始碼',
      issues: '遇到問題或有建議？前往 GitHub Issues',
      trustAria: '產品特色',
      trustItems: ['不必註冊', '自選翻譯服務', '設定保存在本機'],
      visualAria: '只譯智慧辨識翻譯效果',
      browserLabel: '正在雙語閱讀外語文章',
      screenshotAlt: '只譯保留原網頁結構，並在主要內容旁加入譯文',
      smart: '識文',
      smartDetail: '優先處理正文',
      bilingual: '雙語',
      bilingualDetail: '隨時核對原文',
    },
    proof: {
      aria: '產品原則',
      items: [
        { title: '免費使用', detail: '擴充功能本身沒有訂閱' },
        { title: '開放原始碼', detail: '遵循 GPL v3 授權' },
        { title: '不必申請帳號', detail: '不建立只譯帳號系統' },
        { title: '自由選擇服務', detail: '依需求選擇翻譯服務' },
      ],
    },
    demo: {
      sectionLabel: '01 · 實際示範',
      title: '切換不同場景，看清每一次雙語閱讀',
      description: '以實際操作展示只譯如何處理網頁、影片字幕與本機電子書。',
      tabsAria: '選擇示範場景',
      unsupported: '您的瀏覽器暫不支援影片播放。',
      items: {
        web: {
          tab: '網頁識文',
          label: '01 · 網頁識文',
          title: '留在原網頁，只翻譯正在閱讀的正文',
          ariaLabel: '只譯網頁智慧辨識翻譯示範影片',
          note: '此影片為簡體中文版錄製，示範英語 → 簡體中文；擴充功能亦支援其他語言組合。',
        },
        video: {
          tab: '影片字幕',
          label: '02 · 影片字幕',
          title: '外語字幕跟隨播放進度，以雙語顯示',
          ariaLabel: '只譯影片雙語字幕實際示範',
          note: '此影片為簡體中文版錄製，示範西班牙語 → 簡體中文字幕；擴充功能亦支援其他語言組合。',
        },
        epub: {
          tab: '本機 EPUB',
          label: '03 · 本機 EPUB',
          title: '匯入電子書，沿著章節繼續雙語閱讀',
          ariaLabel: '只譯本機 EPUB 雙語閱讀實際示範',
          note: '此影片為簡體中文版錄製，示範英語 → 簡體中文；擴充功能亦支援其他語言組合。',
        },
      },
    },
    services: {
      sectionLabel: '02 · 翻譯服務',
      title: '不把你綁在單一服務',
      description: 'Microsoft Translator、Google 翻譯等免設定服務可直接使用；需要 AI 翻譯時，也可以填入自己的 API Key。相容 OpenAI Chat Completions 的介面同樣可以接入。',
      finePrint: '只譯本身免費；第三方線上服務可能有各自的帳號、額度、計費與隱私規則。',
      aria: '支援的翻譯服務',
      providers: ['Microsoft Translator', 'Google 翻譯', 'Chrome 內建翻譯', 'DeepL', 'OpenAI', 'DeepSeek', 'Gemini', 'Claude'],
    },
    privacy: {
      sectionLabel: '03 · 隱私與開源',
      title: '資料去了哪裡，應該說清楚',
      description: '開源不代表資料一定不會離開裝置。只譯清楚說明本機保存與線上翻譯的界線。',
      cards: [
        { title: '只譯不要求註冊', detail: '沒有只譯帳號，也沒有專案方訂閱；專案方不收集擴充功能使用資料。' },
        { title: '閱讀資料保存在本機', detail: '設定、快取、EPUB 書庫、閱讀進度與書籤都保存在目前瀏覽器中。' },
        { title: '線上翻譯會傳送文字', detail: '開始翻譯後，相關文字會傳送給您選擇的服務商，並受其隱私權政策約束。' },
        { title: '原始碼可公開檢查', detail: '專案依 GPL v3 開源，功能實作、問題紀錄與版本歷史皆公開可見。' },
      ],
      fullPolicy: '閱讀完整隱私說明 →',
      source: '查看專案原始碼 →',
    },
    steps: {
      sectionLabel: '04 · 開始使用',
      title: '三步開始雙語閱讀',
      items: [
        { title: '安裝只譯', detail: '從 Chrome 線上應用程式商店安裝擴充功能，並固定在瀏覽器工具列。' },
        { title: '選擇翻譯服務', detail: '免設定服務可直接使用；AI 服務需要填入對應的 API Key。' },
        { title: '開啟正在閱讀的內容', detail: '選擇雙語對照與識文後開始翻譯網頁，或進入字幕與 EPUB 功能。' },
      ],
    },
    limits: {
      label: '目前限制',
      title: '有些事情，只譯目前還做不到',
      items: [
        '目前主要支援 Chrome；瀏覽器內部頁面、擴充功能商店等受限頁面無法執行。',
        '字幕翻譯依賴網站提供且可讀取的字幕，不會從音訊產生字幕。',
        'EPUB 閱讀器仍處於 Beta，僅支援本機無 DRM 的 EPUB。',
        '複雜的動態網頁仍可能漏翻或出現排版問題，可切換全頁模式重試。',
      ],
    },
    faq: {
      sectionLabel: '05 · 常見問題',
      title: '安裝前，你可能還想知道',
      introBefore: '找不到答案？可以前往',
      introLink: 'GitHub Issues',
      introAfter: '回報具體頁面與問題。',
      items: [
        { question: '只譯需要付費嗎？', answer: '只譯本身免費且開源，也沒有專案方訂閱。部分第三方翻譯服務可能依自己的規則收費。' },
        { question: '需要註冊只譯帳號嗎？', answer: '不需要。設定、快取與電子書資料都保存在目前瀏覽器設定檔中。' },
        { question: '翻譯內容會被上傳嗎？', answer: '使用線上翻譯服務時，待翻譯文字會傳送給您選擇的服務商。可用的 Chrome 內建翻譯則在瀏覽器本機處理。' },
        { question: '為什麼有些頁面不能翻譯？', answer: '瀏覽器內部頁面、擴充功能商店、安全受限頁面與部分嵌入內容不允許一般擴充功能執行；複雜動態頁面也可能需要切換到全頁模式。' },
        { question: '沒有原始字幕的影片能翻譯嗎？', answer: '目前不能。只譯會讀取並翻譯網站既有字幕，不包含語音辨識或字幕生成功能。' },
      ],
      relationQuestion: '為什麼還要做一個翻譯擴充功能？與流暢閱讀有什麼關係？',
      relationBefore: '只譯並不是因為現有產品都不夠好，而是希望保留一個更克制的選擇：不建立新的帳號與訂閱系統，讓使用者自行選擇翻譯服務，專注處理網頁、字幕與電子書的閱讀體驗。專案基於開源擴充功能',
      fluentRead: 'FluentRead（流暢閱讀）',
      relationAfter: '繼續開發，並依 GPL v3 授權開源。',
    },
    cta: {
      label: 'OnlyTranslate · 只譯',
      opening: '小而克制，',
      scenes: '網頁、影片、電子書，',
      promise: '讓雙語閱讀更簡單。',
      install: '安裝只譯',
      releases: '查看更新說明',
      source: '查看原始碼',
    },
    footer: {
      aria: '頁尾導覽',
      releases: '更新說明',
      issues: '問題回報',
      help: '使用說明',
      privacy: '隱私說明',
      license: 'GPL v3 · 免費開源',
    },
  },
  'ja-JP': {
    brand: {
      name: 'OnlyTranslate',
      subtitle: 'バイリンガル読書',
      homeAria: 'OnlyTranslate ホーム',
    },
    language: {
      label: 'サイトの言語を選択',
    },
    nav: {
      aria: 'ページナビゲーション',
      demo: '実際のデモ',
      services: '翻訳サービス',
      privacy: 'プライバシーとオープンソース',
      faq: 'よくある質問',
    },
    hero: {
      eyebrow: '無料・オープンソースの Chrome 翻訳拡張機能',
      titleLine1: 'ウェブ、動画、電子書を、',
      titleLine2: '原文と訳文で読む。',
      lead: '外国語の文章をじっくり読む人のための拡張機能です。OnlyTranslate は、元の構成や読むリズムをできるだけ保ちながら、いま読んでいる場所へ訳文を戻します。専用アカウントもサブスクリプションも必要ありません。',
      install: 'Chrome ウェブストアからインストール',
      source: 'GitHub でソースを見る',
      issues: '問題や提案がありますか？GitHub Issues へ',
      trustAria: '製品の特長',
      trustItems: ['登録不要', '翻訳サービスを選べる', '設定はローカル保存'],
      visualAria: 'OnlyTranslate スマート翻訳の表示例',
      browserLabel: '外国語の記事を対訳で閲覧中',
      screenshotAlt: 'OnlyTranslate が元のウェブページ構造を保ち、本文に訳文を追加している画面',
      smart: '本文',
      smartDetail: '本文を優先して翻訳',
      bilingual: '対訳',
      bilingualDetail: '原文をいつでも確認',
    },
    proof: {
      aria: '製品の方針',
      items: [
        { title: '無料で利用', detail: '拡張機能に購読料金なし' },
        { title: 'オープンソース', detail: 'GPL v3 ライセンス' },
        { title: 'アカウント不要', detail: '専用アカウントを作らない' },
        { title: 'サービスを選択', detail: '用途に合う翻訳サービスを利用' },
      ],
    },
    demo: {
      sectionLabel: '01 · 実際のデモ',
      title: '場面を切り替えて、対訳で読む流れを確認',
      description: 'ウェブページ、動画字幕、ローカル電子書で OnlyTranslate がどのように動作するかを実際の操作で紹介します。',
      tabsAria: 'デモ場面を選択',
      unsupported: 'お使いのブラウザーは動画再生に対応していません。',
      items: {
        web: {
          tab: '本文翻訳',
          label: '01 · 本文翻訳',
          title: '元のページを離れず、読んでいる本文だけを翻訳',
          ariaLabel: 'OnlyTranslate ウェブページのスマート翻訳デモ',
          note: 'この動画は簡体字中国語版向けに収録され、英語 → 簡体字中国語を紹介しています。ほかの言語ペアにも対応しています。',
        },
        video: {
          tab: '動画字幕',
          label: '02 · 動画字幕',
          title: '再生位置に合わせて字幕を原文と訳文で表示',
          ariaLabel: 'OnlyTranslate 動画の対訳字幕デモ',
          note: 'この動画は簡体字中国語版向けに収録され、スペイン語 → 簡体字中国語の字幕を紹介しています。ほかの言語ペアにも対応しています。',
        },
        epub: {
          tab: 'ローカル EPUB',
          label: '03 · ローカル EPUB',
          title: '電子書籍を読み込み、章ごとに対訳で読み進める',
          ariaLabel: 'OnlyTranslate ローカル EPUB 対訳読書デモ',
          note: 'この動画は簡体字中国語版向けに収録され、英語 → 簡体字中国語を紹介しています。ほかの言語ペアにも対応しています。',
        },
      },
    },
    services: {
      sectionLabel: '02 · 翻訳サービス',
      title: '一つのサービスに縛られない',
      description: 'Microsoft Translator や Google 翻訳など、設定不要のサービスはすぐに使えます。AI 翻訳を使う場合は、ご自身の API キーを設定できます。OpenAI Chat Completions 互換のエンドポイントにも対応しています。',
      finePrint: 'OnlyTranslate 自体は無料です。第三者サービスには、独自のアカウント、利用枠、料金、プライバシールールが適用される場合があります。',
      aria: '対応する翻訳サービス',
      providers: ['Microsoft Translator', 'Google 翻訳', 'Chrome 内蔵翻訳', 'DeepL', 'OpenAI', 'DeepSeek', 'Gemini', 'Claude'],
    },
    privacy: {
      sectionLabel: '03 · プライバシーとオープンソース',
      title: 'データの行き先を明確に',
      description: 'オープンソースだからといって、データが常に端末内だけで処理されるとは限りません。OnlyTranslate は、ローカル保存とオンライン翻訳の境界を明記しています。',
      cards: [
        { title: '専用アカウントは不要', detail: 'OnlyTranslate のアカウントやプロジェクト側のサブスクリプションはなく、拡張機能の利用データも収集しません。' },
        { title: '読書データはローカル保存', detail: '設定、キャッシュ、EPUB 本棚、読書位置、ブックマークは現在のブラウザーに保存されます。' },
        { title: 'オンライン翻訳では文字を送信', detail: '翻訳を開始すると、対象テキストは選択したサービスへ送信され、そのプライバシーポリシーが適用されます。' },
        { title: 'ソースコードを確認可能', detail: '実装、問題履歴、リリース履歴を含め、プロジェクトは GPL v3 で公開されています。' },
      ],
      fullPolicy: 'プライバシー説明を読む →',
      source: 'ソースコードを見る →',
    },
    steps: {
      sectionLabel: '04 · はじめ方',
      title: '3 ステップで対訳読書を開始',
      items: [
        { title: 'OnlyTranslate をインストール', detail: 'Chrome ウェブストアからインストールし、ブラウザーのツールバーに固定します。' },
        { title: '翻訳サービスを選択', detail: '設定不要のサービスはすぐに使えます。AI サービスには対応する API キーが必要です。' },
        { title: '読みたいコンテンツを開く', detail: '「対訳」と「本文」を選んでウェブページを翻訳するか、字幕・EPUB 機能を開きます。' },
      ],
    },
    limits: {
      label: '現在の制限',
      title: 'OnlyTranslate がまだできないこと',
      items: [
        '現在は主に Chrome をサポートしています。ブラウザー内部ページ、拡張機能ストアなどの制限されたページでは動作しません。',
        '字幕翻訳には、サイトが提供する読み取り可能な字幕が必要です。音声から字幕を生成する機能はありません。',
        'EPUB リーダーは Beta 版で、ローカルの DRM なし EPUB のみに対応しています。',
        '複雑な動的ページでは、翻訳漏れやレイアウトの問題が起こる場合があります。その場合は全ページモードをお試しください。',
      ],
    },
    faq: {
      sectionLabel: '05 · よくある質問',
      title: 'インストール前に知っておきたいこと',
      introBefore: '回答が見つからない場合は、',
      introLink: 'GitHub Issues',
      introAfter: 'で対象ページや問題をお知らせください。',
      items: [
        { question: 'OnlyTranslate は有料ですか？', answer: 'OnlyTranslate 自体は無料・オープンソースで、プロジェクト側のサブスクリプションもありません。一部の第三者翻訳サービスは独自の規約に基づき課金される場合があります。' },
        { question: 'OnlyTranslate のアカウントは必要ですか？', answer: '必要ありません。設定、キャッシュ、電子書籍データは現在のブラウザープロファイルに保存されます。' },
        { question: '翻訳内容はアップロードされますか？', answer: 'オンライン翻訳サービスを使用すると、翻訳対象のテキストは選択したサービスへ送信されます。利用可能な Chrome 内蔵翻訳はブラウザー内で処理されます。' },
        { question: '翻訳できないページがあるのはなぜですか？', answer: 'ブラウザー内部ページ、拡張機能ストア、セキュリティ制限ページ、一部の埋め込みコンテンツでは通常の拡張機能を実行できません。複雑な動的ページでは全ページモードが必要な場合もあります。' },
        { question: '元字幕がない動画も翻訳できますか？', answer: '現時点ではできません。OnlyTranslate はサイトが提供する字幕を読み取って翻訳します。音声認識や字幕生成機能は含まれていません。' },
      ],
      relationQuestion: 'なぜ新しい翻訳拡張機能を作ったのですか？FluentRead との関係は？',
      relationBefore: 'OnlyTranslate は、既存の製品がすべて不十分だという考えから生まれたものではありません。新しいアカウントや購読システムを設けず、翻訳サービスを自分で選び、ウェブ、字幕、電子書籍の読書体験に集中する、より控えめな選択肢を残すためのプロジェクトです。オープンソース拡張機能',
      fluentRead: 'FluentRead',
      relationAfter: 'を基に開発を継続し、GPL v3 で公開しています。',
    },
    cta: {
      label: 'OnlyTranslate',
      opening: '小さく、控えめに。',
      scenes: 'ウェブ、動画、電子書籍を、',
      promise: 'もっと読みやすい対訳に。',
      install: 'OnlyTranslate をインストール',
      releases: '更新情報を見る',
      source: 'ソースを見る',
    },
    footer: {
      aria: 'フッターナビゲーション',
      releases: '更新情報',
      issues: '問題を報告',
      help: '使い方',
      privacy: 'プライバシー',
      license: 'GPL v3 · 無料・オープンソース',
    },
  },
};
