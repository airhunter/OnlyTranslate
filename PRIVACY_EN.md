# OnlyTranslate Privacy Policy

Last updated: July 2026

OnlyTranslate is committed to protecting your privacy. This Privacy Policy explains how our browser extension handles your data.

**1. What data do we collect?**
We do **not** collect, store, or send any of your personal information, browsing history, or network data to any server operated by us.

**2. How core data (webpage text) is processed**
To provide the core translation functionality, the extension reads text from the current webpage or video subtitles only when you initiate a translation request. This data is sent directly to the **third-party translation API that you configure** (such as OpenAI or DeepL). We, the extension developers, do not proxy, intercept, or retain any translated content.

**3. Local storage**
Your configuration information, such as API keys and preferred languages, is stored only in your browser's local storage (`chrome.storage.local`) and is never uploaded to any cloud server.

When “Local cache” is enabled, the extension also stores translated video subtitles in its private extension storage so they can be displayed quickly when you revisit the same position. Cached subtitle translations are retained for up to 30 days. The browser removes expired entries while it is running; if it was not running when an entry expired, the extension removes that entry the next time it starts. Translations remain in your browser and are never uploaded to the extension developer's servers. You can turn off “Local cache” to stop reading and writing this cache, or use “Clear cache” to delete saved subtitle translations immediately. Incognito windows do not read from or write to this persistent cache.

**4. Third-party services**
Because translation data is sent directly to the third-party API server that you configure, its processing is governed by that service provider's privacy policy.
