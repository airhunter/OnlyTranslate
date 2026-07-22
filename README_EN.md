# OnlyTranslate

> Focused, capable, and intentionally quiet. It does one thing well: translation.

[中文](./README.md) | English

OnlyTranslate is a browser extension designed for a focused reading experience. It translates main web content, full pages, selected or hovered text, input fields, video subtitles, and local EPUB ebooks while preserving the original structure and reading flow as much as possible.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi)

## Quick Start

1. Install OnlyTranslate from the [Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi), then open a regular webpage you want to translate.
2. Select the OnlyTranslate icon in the browser toolbar and choose an available translation service. No-setup services such as Microsoft Translator and Google Translate can be used immediately; AI services require their corresponding API keys.
3. For your first translation, try **Bilingual + Smart**, then select **Translate current page**. Select **Restore original** whenever you want to undo the translation.

To read an ebook, choose **Ebooks (Beta)** at the bottom of the popup, select **Import EPUB**, and choose a local DRM-free EPUB. After importing, continue reading from the popup library or open the full library to manage your books.

The **More** menu in the top-right of the popup contains Clear cache and Help. Help provides searchable instructions for translation modes, selection and hover translation, input fields, video subtitles, service setup, and common issues. The guide is bundled with the extension and is available offline.

## Core Features

- **Smart / full-page translation**: Smart mode focuses on articles, comments, and the main reading area. Full-page mode covers more visible text on documentation, forums, and tool pages.
- **Bilingual / translation-only display**: Keep the original text for comparison and language learning, or show only the translation for a cleaner reading flow.
- **Multiple ways to translate**: Start from the extension popup, the floating page toolbar, a keyboard shortcut, or the context menu.
- **Selection, hover, and input-field translation**: Translate selected content or text under the pointer, preview suggestions beside the caret, switch target language in place, and press `Tab` to replace the original text.
- **Video subtitle translation**: Captures source subtitles on supported sites, translates them in context-aware segments, and shows bilingual subtitles. Playback-aware scheduling and local caching reduce waiting and repeated requests.
- **Ebook translation (Beta)**: Import local EPUB files, automatically translate the current chapter while scrolling, and retain your library, reading progress, and location bookmarks.
- **Flexible translation services**: Includes presets for Microsoft Translator, Google Translate, Chrome's built-in translator, DeepL, OpenAI, DeepSeek, Gemini, Claude, and more, plus OpenAI Chat Completions-compatible gateways.
- **Advanced AI settings**: Control thinking mode separately for each service and configure a default target language with an optional reverse-translation language.
- **Built-in user guide**: Searchable offline instructions and interface screenshots are available in Simplified Chinese, English, Traditional Chinese, and Japanese.

## Choosing a Translation Scope

- **Smart**: Best for articles, blogs, posts, comments, and long-form reading. It prioritizes the main reading area and reduces noise from menus and navigation.
- **Full page**: Best for documentation, admin pages, forums, tool sites, and information-dense pages. It translates more visible content while preserving the original page structure and interactions as much as possible.

If Smart mode misses content, switch to Full page and translate again. For dynamically loaded content, scroll it into view and trigger translation again.

## Ebook Translation (Beta)

Choose **Ebooks** at the bottom of the popup to import an EPUB directly, view recently read books, or continue reading. The full reader uses vertical scrolling, automatically translates the current chapter, and supports bilingual or translation-only display, table-of-contents navigation, themes, font size, line spacing, and location bookmarks.

- The first release supports local DRM-free EPUB files only. PDF, MOBI, and DRM-protected books are not supported.
- Books, reading progress, and bookmarks are stored in the current browser profile. Cloud sync, export, notes, and AI analysis are not included.
- The EPUB file itself is never uploaded. Chapter text is sent to the selected translation provider only when translation begins.
- Removing a book also deletes its reading progress and bookmarks. Uninstalling the extension or clearing extension data removes the local library.
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
- Imported EPUB files, reading progress, and bookmarks remain in local browser storage. Only chapter text that needs translation is sent to the selected provider.
- Chrome's built-in translation runs locally in the browser, but availability depends on the Chrome version, language pair, and local model state.
- Some online services require an API key and may charge according to their own terms. OnlyTranslate does not manage provider accounts, quotas, or billing.
- Translations and video subtitles may be cached locally to reduce repeated requests. You can remove them with **Clear cache** in the popup's top-right **More** menu.

## Installation

### Chrome Web Store

[OnlyTranslate - Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi)

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

## Origin

OnlyTranslate is based on [FluentRead](https://github.com/Bistutu/FluentRead). It keeps the core webpage translation experience while adding video subtitle translation, ebook translation, Smart / Full page scope switching, and a more focused settings experience. Thanks to the original author and all contributors for their open-source work.

## License

This project is open sourced under the [GNU GPL v3.0](./LICENSE) license.
