# OnlyTranslate

> Focused, capable, and intentionally quiet. It does one thing well: translation.

[中文](./README.md) | English

OnlyTranslate is a browser extension focused on translation. It supports smart reading translation, full-page translation, selection/hover translation, and video subtitle translation.

It is designed to quietly bridge the language gap while you read foreign-language pages, instead of turning the whole page into another tool you have to manage.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)

---

## Features

- **Smart reading translation**: The recommended default for web pages. It focuses on articles, comments, and main reading content, reducing noise from surrounding page elements.
- **Full-page translation**: A broader translation mode for documentation, forums, tool pages, and pages where you explicitly want to see more translated content.
- **Selection and hover translation**: Select text or hover over it to get a quick translation, useful for checking words, short phrases, and sentence meaning.
- **Video subtitle translation**: Automatically captures and translates subtitles on platforms such as YouTube, Udemy, and Coursera, with bilingual subtitle display.
- **Bilingual / translation-only display**: Switch between reading styles based on whether you want context or immersion.
- **Multiple translation engines**: Includes quick presets for 20+ engines, including OpenAI, DeepSeek, Google Translate, Microsoft Translator, DeepL, and more.
- **Custom gateway pool**: Add multiple OpenAI-compatible custom endpoints for local models, company gateways, or self-hosted services.
- **Privacy first**: All settings are stored locally. No user data is collected.
- **Completely free**: Open source and non-commercial.

---

## Translation Scope

OnlyTranslate provides two web-page translation scopes:

- **Smart**: Best for articles, posts, comments, and long-form reading. It tries to find the main reading area and keeps the translation focused.
- **Full page**: Best for documentation, admin pages, tool sites, and information-dense pages. It translates more visible content while preserving the original page structure and interactions.

---

## Supported Platforms

| Platform | Subtitle Translation | Web Translation |
|----------|----------------------|-----------------|
| YouTube | Yes | Yes |
| Udemy | Yes | Yes |
| Coursera | Yes | Yes |
| Khan Academy | Yes | Yes |
| General webpages | - | Yes |

---

## Origin And Improvements

OnlyTranslate is based on [FluentRead](https://github.com/Bistutu/FluentRead), with focused improvements in the following areas:

| | FluentRead | OnlyTranslate |
|---|---|---|
| Video subtitle translation | Not supported | YouTube, Udemy, Coursera, and more |
| Web translation scope | Mostly full-page translation | Smart / full-page scope switch |
| Product focus | Feature-rich, including some less frequently used options | Focused on core translation workflows, with redundant options removed |
| Settings experience | Many options and a higher setup cost | A redesigned minimal settings experience, including a dynamic "My Services" panel and multiple custom endpoints |

**Main additions:**

- Real-time video subtitle translation with automatic subtitle capture, sentence-by-sentence translation, and bilingual overlay display.
- Smart / full-page translation scope switching, balancing focused reading and complete-page translation.
- Subtitle segment merging based on speech pauses for better translation quality.

**Main simplifications:**

- Less frequently used features were removed to keep the extension clean.
- Settings were reorganized to make the extension easier to use out of the box.
- The "My Services" panel hides unused translation services and reduces configuration clutter.

---

## Installation

**Chrome Web Store:**

[OnlyTranslate - Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi)

**Manual installation in developer mode:**

1. Download the latest `.zip` package from [Releases](https://github.com/airhunter/OnlyTranslate/releases) and unzip it.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the unzipped extension directory.

---

## Development

```bash
# Install dependencies
corepack pnpm install

# Development mode for Chrome
corepack pnpm dev

# Build
corepack pnpm build

# Package zip
corepack pnpm zip
```

This project declares its pnpm version in `package.json`. Prefer
`corepack pnpm ...` so scripts use the package manager version and local
dependencies expected by the project.

For development mode, load `.output/chrome-mv3-dev` in Chrome developer mode.
For production builds, load `.output/chrome-mv3`. Avoid mixing the two output
directories.

Tech stack: [WXT](https://wxt.dev/) + [Vue 3](https://vuejs.org/) + TypeScript, Manifest V3.

## Acknowledgements

This project is based on [FluentRead](https://github.com/Bistutu/FluentRead). Thanks to the original author and all contributors for their open-source work.

---

## License

This project is open sourced under the [GNU GPL v3.0](./LICENSE) license.
