# OnlyTranslate Privacy Policy

Last updated: September 1, 2026

OnlyTranslate is committed to protecting your privacy. This Privacy Policy explains how our browser extension handles your data.

**1. What data do we collect?**
OnlyTranslate does not automatically collect or send personal information, browsing history, translation content, or routine usage analytics to servers we operate. Data is sent to us only when you explicitly use Private feedback and confirm the visible submission contents.

**2. How core data (webpage, subtitle, and book text) is processed**
To provide the core translation functionality, the extension reads text that needs translation from the current webpage, video subtitles, or an opened EPUB/PDF only when you initiate translation. This data is sent directly to the **third-party translation API that you configure** (such as OpenAI or DeepL). We, the extension developers, do not proxy, intercept, or retain translated content. Original EPUB/PDF files are not sent to translation providers, and PDF original-only mode does not pre-send text for translation.

**3. Read-aloud and online voice**
System voice is handled by a speech engine provided by Chrome, Edge, or the operating system. When you select “Edge online voice” and explicitly click Read aloud or Preview, the corresponding source text, translation, or preview text is sent directly over an encrypted connection to the Microsoft speech synthesis service to generate and return audio. Servers operated by the OnlyTranslate project do not receive or retain this text or audio. The request is governed by the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement) and its data-processing terms.

**4. Local storage**
Your configuration information, such as API keys and preferred languages, is stored only in your browser's local storage (`chrome.storage.local`) and is never uploaded to any cloud server.

EPUB/PDF files that you import or add to the library, together with covers, reading progress, and bookmarks, are stored in the extension's private local storage. Semantic layout reflow for complex PDFs also offers an optional model of about 23 MB. It is downloaded from a public model repository, verified, and stored locally only after you explicitly request it. The model analyzes PDF page pixels on your device; the original PDF and page contents are not sent to the model host. You can remove the model from the PDF reader at any time. Uninstalling the extension or clearing extension data removes these local items.

When “Local cache” is enabled, the extension also stores translated video subtitles in its private extension storage so they can be displayed quickly when you revisit the same position. Cached subtitle translations are retained for up to 30 days. The browser removes expired entries while it is running; if it was not running when an entry expired, the extension removes that entry the next time it starts. Translations remain in your browser and are never uploaded to the extension developer's servers. You can turn off “Local cache” to stop reading and writing this cache, or use “Clear cache” to delete saved subtitle translations immediately. Incognito windows do not read from or write to this persistent cache.

The extension also keeps up to 5 translation performance diagnostics locally for no more than 24 hours. These diagnostics include only text size, request and cache counts, queue and API timings, time to first result and completion, service, a known model or `custom` marker, retries, and error types. They do not contain source text, translations, API keys, custom model names, or endpoints. You can clear them at any time from the feedback interface.

**5. Private feedback you choose to submit**
Private feedback stores the message, category, extension version, interface language, and submission time. Diagnostics, the page URL, and a contact email are off by default and are included only when you explicitly enable the corresponding option. An explicitly submitted page URL retains its query string and has its `#` fragment removed; query parameters may contain tokens or personal information, so review them before submitting. A contact email and follow-up consent you voluntarily provide are used only by project maintainers to follow up on that feedback and are retained with it for no more than 90 days. We do not persist IP addresses or request headers.

**6. Third-party services**
Because translation data is sent directly to the third-party API server you configure, and online voice text is sent directly to the voice service you select, its processing is governed by the corresponding third-party service provider's privacy policy. The optional PDF layout model is hosted in a public Hugging Face model repository. Downloading it discloses ordinary network connection information to that service, but does not upload your PDF or page contents.
