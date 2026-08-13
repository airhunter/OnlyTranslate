# OnlyTranslate Privacy Policy

Last updated: August 13, 2026

OnlyTranslate is committed to protecting your privacy. This Privacy Policy explains how our browser extension handles your data.

**1. What data do we collect?**
OnlyTranslate does not automatically collect or send personal information, browsing history, translation content, or routine usage analytics to servers we operate. Data is sent to us only when you explicitly use Private feedback and confirm the visible submission contents.

**2. How core data (webpage text) is processed**
To provide the core translation functionality, the extension reads text from the current webpage or video subtitles only when you initiate a translation request. This data is sent directly to the **third-party translation API that you configure** (such as OpenAI or DeepL). We, the extension developers, do not proxy, intercept, or retain any translated content.

**3. Local storage**
Your configuration information, such as API keys and preferred languages, is stored only in your browser's local storage (`chrome.storage.local`) and is never uploaded to any cloud server.

When “Local cache” is enabled, the extension also stores translated video subtitles in its private extension storage so they can be displayed quickly when you revisit the same position. Cached subtitle translations are retained for up to 30 days. The browser removes expired entries while it is running; if it was not running when an entry expired, the extension removes that entry the next time it starts. Translations remain in your browser and are never uploaded to the extension developer's servers. You can turn off “Local cache” to stop reading and writing this cache, or use “Clear cache” to delete saved subtitle translations immediately. Incognito windows do not read from or write to this persistent cache.

The extension also keeps up to 5 translation performance diagnostics locally for no more than 24 hours. These diagnostics include only text size, request and cache counts, queue and API timings, time to first result and completion, service, a known model or `custom` marker, retries, and error types. They do not contain source text, translations, API keys, custom model names, or endpoints. You can clear them at any time from the feedback interface.

**4. Private feedback you choose to submit**
Private feedback stores the message, category, extension version, interface language, and submission time. Diagnostics, the page URL, and a contact email are off by default and are included only when you explicitly enable the corresponding option. An explicitly submitted page URL retains its query string and has its `#` fragment removed; query parameters may contain tokens or personal information, so review them before submitting. A contact email and follow-up consent you voluntarily provide are used only by project maintainers to follow up on that feedback and are retained with it for no more than 90 days. We do not persist IP addresses or request headers.

**5. Third-party services**
Because translation data is sent directly to the third-party API server that you configure, its processing is governed by that service provider's privacy policy.
