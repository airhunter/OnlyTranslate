# OnlyTranslate

> Focused, capable, and intentionally quiet. It does one thing well: translation.

[中文](./README.md) | English | [Official website](https://onlytranslate.top/)

OnlyTranslate is an open-source browser extension for bilingual reading. It translates web content, video subtitles, local EPUB ebooks, and PDFs while preserving the original structure and reading flow as much as possible. No OnlyTranslate account or subscription is required, and you choose the translation service.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi?utm_source=github&utm_medium=referral&utm_campaign=readme_202608)

<p align="center">
  <img src="./store-assets/chrome-web-store/zh-CN/01-web-translation.png" alt="OnlyTranslate Smart translation on a real webpage" width="32%" />
  <img src="./store-assets/chrome-web-store/zh-CN/02-video-subtitles.png" alt="OnlyTranslate bilingual video subtitles" width="32%" />
  <img src="./store-assets/chrome-web-store/zh-CN/03-ebook-reader-beta.png" alt="OnlyTranslate EPUB and PDF translation reader" width="32%" />
</p>

> If OnlyTranslate helps you, consider giving it a ⭐ **Star** to support the project and help more people discover an open-source bilingual reading tool.

## Quick Start

1. Install OnlyTranslate from the [Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi?utm_source=github&utm_medium=referral&utm_campaign=readme_202608), then open a regular webpage you want to translate.
2. Select the OnlyTranslate icon in the browser toolbar and choose an available translation service. No-setup services such as Microsoft Translator and Google Translate can be used immediately; AI services require their corresponding API keys.
3. For your first translation, try **Bilingual + Smart**, then select **Translate current page**. Select **Restore original** whenever you want to undo the translation.

To read an ebook or PDF, choose **Reading and library (Beta)** at the bottom of the popup and import a local DRM-free EPUB or PDF. You can also open an accessible online PDF with OnlyTranslate and save it to the library. Continue from the popup or use the full library to manage, back up, and restore books.

The **More** menu in the top-right of the popup contains Clear cache and Help. Help provides searchable instructions for translation modes, selection and hover translation, input fields, video subtitles, service setup, and common issues. The guide is bundled with the extension and is available offline.

## Core Features

- **Smart / full-page translation**: Smart mode focuses on articles, comments, and the main reading area. Full-page mode covers more visible text on documentation, forums, and tool pages.
- **Bilingual / translation-only display**: Keep the original text for comparison and language learning, or show only the translation for a cleaner reading flow.
- **Multiple ways to translate**: Start from the extension popup, the floating page toolbar, a keyboard shortcut, or the context menu.
- **Selection, hover, and input-field translation**: Translate selected content or text under the pointer, preview suggestions beside the caret, switch target language in place, and press `Tab` to replace the original text.
- **Video subtitle translation**: Captures source subtitles on supported sites, translates them in context-aware segments, and shows bilingual subtitles. Playback-aware scheduling and local caching reduce waiting and repeated requests.
- **Ebook and PDF translation (Beta)**: Import local EPUB/PDF files or save accessible online PDFs. Keep the library, reading progress, bookmarks, and original files. PDFs can use an optional local layout model to improve reading order on multi-column and visually complex pages.
- **Flexible translation services**: Includes presets for Microsoft Translator, Google Translate, Chrome's built-in translator, DeepL, OpenAI, DeepSeek, Gemini, Claude, and more, plus OpenAI Chat Completions-compatible gateways.
- **Advanced AI settings**: Control thinking mode separately for each service and configure a default target language with an optional reverse-translation language.
- **Built-in user guide**: Searchable offline instructions and interface screenshots are available in Simplified Chinese, English, Traditional Chinese, and Japanese.

## Choosing a Translation Scope

- **Smart**: Best for articles, blogs, posts, comments, and long-form reading. It prioritizes the main reading area and reduces noise from menus and navigation.
- **Full page**: Best for documentation, admin pages, forums, tool sites, and information-dense pages. It translates more visible content while preserving the original page structure and interactions as much as possible.

If Smart mode misses content, switch to Full page and translate again. For dynamically loaded content, scroll it into view and trigger translation again.

## Reading and Library (Beta)

Choose **Reading and library** at the bottom of the popup to import EPUB/PDF files, view recently read books, or continue reading. The EPUB reader supports chapter translation, navigation, bookmarks, themes, and typography controls. The PDF reader supports page-based bilingual reading, translation-only and layout-preserving translation, library storage, and original-file export.

- Local DRM-free EPUB and PDF files are supported, and accessible online PDFs can be saved to the library. MOBI and DRM/password-protected books are not supported yet.
- PDF uses basic layout analysis without an additional download. For complex PDFs, explicitly download the optional PP-DocLayout-M model of about 23 MB from the reader's **More** menu. The verified model stays in private extension storage and can be removed at any time. Missing, failed, or incompatible models automatically fall back to basic analysis without blocking normal PDF reading.
- Books, reading progress, and bookmarks are stored in the current browser profile. You can back up and restore them from the full library; cloud sync, notes, and AI analysis are not included.
- Original EPUB/PDF files are not sent to the translation provider or model host. Extracted text is sent to the selected translation provider only when translation begins. Original-only PDF mode does not pre-send text for translation.
- Removing a book also deletes its reading progress and bookmarks. Uninstalling the extension or clearing extension data removes the local library, so use **Back up library** first.
- Imported books remain readable while the extension is disabled, but automatic translation pauses.

## Supported Platforms

Web translation works on most regular webpages. Browser internal pages, extension stores, security-restricted pages, and some embedded content may prevent extensions from running.

| Platform | Subtitle Translation | Web Translation |
|----------|----------------------|-----------------|
| YouTube | Yes | Yes |
| Udemy | Yes | Yes |
| Coursera | Yes | Yes |
| Khan Academy | Yes | Yes |
| General webpages | — | Yes |

Subtitle translation requires a readable source subtitle track provided by the video.

## Privacy and Cost

- OnlyTranslate itself is free and open source. It does not collect usage data for the project, and settings are stored locally in your browser.
- When you use an online translation service, the text being translated is sent to the provider you selected and is subject to that provider's privacy policy.
- Imported EPUB/PDF files, reading progress, bookmarks, and the optional PDF layout model remain in local browser storage. Only text that needs translation is sent to the selected provider.
- Chrome's built-in translation runs locally in the browser, but availability depends on the Chrome version, language pair, and local model state.
- Some online services require an API key and may charge according to their own terms. OnlyTranslate does not manage provider accounts, quotas, or billing.
- Translations and video subtitles may be cached locally to reduce repeated requests. You can remove them with **Clear cache** in the popup's top-right **More** menu.

## Installation

### Chrome Web Store

[OnlyTranslate - Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi?utm_source=github&utm_medium=referral&utm_campaign=readme_202608)

### Manual Installation

1. Download the latest `.zip` package from [Releases](https://github.com/airhunter/OnlyTranslate/releases) and unzip it.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Select **Load unpacked** and choose the unzipped extension directory.

## Development

```bash
# Install dependencies
corepack pnpm install

# Development mode for Chrome
corepack pnpm dev

# Type checking and the full test suite
corepack pnpm verify

# Build and package
corepack pnpm build
corepack pnpm zip
```

The project declares its pnpm version in `package.json`. Prefer `corepack pnpm ...` so scripts use the package manager version and local dependencies expected by the project.

For development mode, load `.output/chrome-mv3-dev` in Chrome developer mode. For production builds, load `.output/chrome-mv3`. Avoid mixing the two output directories.

Tech stack: [WXT](https://wxt.dev/) + [Vue 3](https://vuejs.org/) + TypeScript, Manifest V3.

## Feedback

If translation does not start, a page is only partially translated, or subtitles do not appear, check the built-in guide first. If the issue persists, report it through [GitHub Issues](https://github.com/airhunter/OnlyTranslate/issues).

## Credits and Origin

OnlyTranslate is based on [FluentRead](https://github.com/Bistutu/FluentRead). It keeps the core webpage translation experience while adding video subtitle translation, ebook translation, Smart / Full page scope switching, and a more focused settings experience. Thanks to the original author and all contributors for their open-source work.

The design and implementation of OnlyTranslate's EPUB reader drew inspiration from [taylorren/ai-reader](https://github.com/taylorren/ai-reader). Thanks to the project and its contributors for sharing their open-source ideas and work.

PDF semantic layout analysis uses PaddleOCR's PP-DocLayout-M model and ONNX Runtime Web. The model is an optional, user-initiated download. See [THIRD_PARTY_NOTICES.md](./public/THIRD_PARTY_NOTICES.md) for its source, checksum, and licensing information.

## License

This project is open sourced under the [GNU GPL v3.0](./LICENSE) license.
