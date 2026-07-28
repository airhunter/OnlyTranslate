---
title: User guide
description: How to install and configure OnlyTranslate, translate web pages and video subtitles, and read local EPUB books.
---

# User guide

OnlyTranslate primarily supports Chrome. The extension also includes a complete searchable guide that works offline; this page covers the information most useful before installation.

## Installation

Install [OnlyTranslate from the Chrome Web Store](https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi), then pin the extension to your browser toolbar.

You can also download a release package from [GitHub Releases](https://github.com/airhunter/OnlyTranslate/releases) and install it manually.

## Translate your first webpage

1. Open a regular webpage you want to translate.
2. Select the OnlyTranslate icon in the browser toolbar.
3. Choose an available translation service.
4. For your first translation, try **Bilingual** and **Smart**.
5. Select **Translate current page**.

To restore the page, open the extension again and select **Restore original**.

## Smart or Full page

### Smart

Best for articles, blogs, posts, comments, and long-form reading. It prioritizes the main reading area and reduces noise from menus, navigation, subscription buttons, and sidebar recommendations.

### Full page

Best for documentation, admin pages, forums, tool sites, and information-dense pages. It translates more visible text and also serves as a fallback when Smart misses content.

## Video subtitles

OnlyTranslate can read an existing subtitle track on supported websites, translate it in context-aware segments, and show bilingual subtitles that follow playback.

The main supported platforms are:

- YouTube;
- Udemy;
- Coursera;
- Khan Academy.

The video must already provide a subtitle track that OnlyTranslate can read. OnlyTranslate does not currently include speech recognition and cannot generate subtitles for a video without them.

## Local EPUB

Open **Ebooks (Beta)** from the bottom of the extension popup, select **Import EPUB**, and choose a local DRM-free EPUB file.

OnlyTranslate automatically translates the current chapter and saves your library, reading progress, and location bookmarks. The first version does not support PDF, MOBI, cloud sync, notes, or AI content analysis.

## Translation services

No-setup services such as Microsoft Translator and Google Translate work immediately. OpenAI, DeepSeek, Gemini, Claude, DeepL, and similar services require an API key under their respective terms.

Some providers may charge or apply usage limits. Those rules are set by the provider.

## Frequently asked questions

### Why can’t extension-store and browser-internal pages be translated?

Chrome does not allow ordinary extensions to run on the extension store, browser settings, and some security-restricted pages.

### Why did Smart miss part of the page?

Smart prioritizes the main reading area. Scroll until dynamically loaded content appears and translate again, or switch to Full page.

### Is my data uploaded?

Settings, cache, library, and reading progress stay in your browser. When you use an online translation service, the text being translated is sent to the provider you selected. See the [privacy notice](/en/privacy) for details.

### How do I report a problem?

Open a [GitHub issue](https://github.com/airhunter/OnlyTranslate/issues) and, when possible, include:

- the affected page URL;
- the translation scope and display mode;
- the selected translation service;
- steps to reproduce the problem;
- a screenshot or error message without private information.
