import { storage } from '@wxt-dev/storage';

export type ReleaseNoteLocale = 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP';

export interface LocalizedReleaseNote {
  title: string;
  items: string[];
}

export interface ReleaseNote {
  version: string;
  notes: Partial<Record<ReleaseNoteLocale, LocalizedReleaseNote>>;
}

export interface ResolvedReleaseNote extends LocalizedReleaseNote {
  version: string;
  locale: ReleaseNoteLocale;
}

export const RELEASE_NOTES_SEEN_VERSION_KEY = 'local:lastSeenReleaseNotesVersion';
export const RELEASE_NOTES_INIT_KEY = 'local:releaseNotesInitialized';
export const releaseNoteLocales: ReleaseNoteLocale[] = ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'];

const releaseNoteFallbackLocale: ReleaseNoteLocale = 'zh-CN';

export const releaseNotes: ReleaseNote[] = [
  {
    version: '1.0.0',
    notes: {
      'zh-CN': {
        title: '只译 1.0：字幕翻译全面升级',
        items: [
          '重构视频字幕翻译流程，自动清理重复与滚动字幕，并结合上下文智能分段，让连续对话的译文更完整、更自然。',
          '新增播放感知调度、前台追赶和后台预取，拖动进度或连续播放时能更快补齐当前字幕，接口异常时也会自动回退。',
          '新增隐私友好的本地字幕缓存，相同视频可复用已翻译片段；缓存最多保留 30 天，支持一键清空，隐身窗口不会读写。',
          '新增按翻译服务控制思考模式，并继续修复部分文章段落漏翻，让网页与字幕翻译更容易在质量和速度之间取舍。'
        ]
      },
      'en-US': {
        title: 'OnlyTranslate 1.0: A Major Subtitle Upgrade',
        items: [
          'Rebuilt the video subtitle pipeline to clean up duplicate and scrolling captions and segment dialogue with surrounding context for more complete, natural translations.',
          'Added playback-aware scheduling, foreground catch-up, and background prefetch so current captions fill in faster after seeking or during continuous playback, with graceful fallback on service errors.',
          'Added a privacy-friendly local subtitle cache that reuses translated segments for the same video; entries last up to 30 days, can be cleared with one click, and are never used in incognito windows.',
          'Added per-service reasoning controls and fixed additional missed article paragraphs, making it easier to balance translation quality and speed across webpages and subtitles.'
        ]
      },
      'zh-TW': {
        title: '只譯 1.0：字幕翻譯全面升級',
        items: [
          '重構影片字幕翻譯流程，自動清理重複與捲動字幕，並結合上下文智慧分段，讓連續對話的譯文更完整、更自然。',
          '新增播放感知調度、前景追趕和背景預取，拖動進度或連續播放時能更快補齊當前字幕，介面異常時也會自動回退。',
          '新增隱私友善的本機字幕快取，相同影片可重複使用已翻譯片段；快取最多保留 30 天，支援一鍵清空，無痕視窗不會讀寫。',
          '新增依翻譯服務控制思考模式，並繼續修復部分文章段落漏翻，讓網頁與字幕翻譯更容易在品質和速度之間取舍。'
        ]
      },
      'ja-JP': {
        title: 'OnlyTranslate 1.0：字幕翻訳を全面的に強化',
        items: [
          '動画字幕の翻訳パイプラインを再構築し、重複やスクロール式字幕を自動的に整理した上で、周辺の文脈を使って会話を分割し、より完全で自然な訳文を生成します。',
          '再生状況に応じたスケジューリング、表示中字幕の追い上げ、バックグラウンドの先読みを追加し、シーク後や連続再生中でも現在の字幕を素早く補完し、サービスエラー時は自動的にフォールバックします。',
          '同じ動画の翻訳済み区間を再利用できる、プライバシーに配慮したローカル字幕キャッシュを追加しました。保存期間は最長 30 日で、ワンクリックで消去でき、シークレットウィンドウでは使用されません。',
          '翻訳サービスごとの思考モード設定を追加し、一部の記事段落が翻訳されない問題も修正し、Web ページと字幕の品質と速度のバランスを調整しやすくしました。'
        ]
      }
    }
  },
  {
    version: '0.9.1',
    notes: {
      'zh-CN': {
        title: '悬浮入口图标修正',
        items: [
          '修正悬浮翻译入口旁的“更多”按钮图标，不再显示成像占位头像一样的怪异圆点。',
          '更多入口现在使用清晰的三点图标，和右侧主翻译按钮的职责区分更明确。',
          '优化小圆按钮里的图标尺寸和显示方式，减少页面悬浮控件的视觉干扰。'
        ]
      },
      'en-US': {
        title: 'Floating Entry Icon Fix',
        items: [
          'Fixed the More button beside the floating translation entry so it no longer looks like an odd placeholder avatar.',
          'The More entry now uses a clear three-dot icon, making it easier to distinguish from the primary translate button.',
          'Improved the icon sizing and rendering inside the small round button to reduce visual noise on the page.'
        ]
      },
      'zh-TW': {
        title: '懸浮入口圖示修正',
        items: [
          '修正懸浮翻譯入口旁的「更多」按鈕圖示，不再顯示得像奇怪的佔位頭像。',
          '更多入口現在使用清楚的三點圖示，和右側主要翻譯按鈕的用途區分更明確。',
          '優化小圓按鈕中的圖示尺寸和顯示方式，減少頁面懸浮控制項的視覺干擾。'
        ]
      },
      'ja-JP': {
        title: 'フローティング入口のアイコン修正',
        items: [
          'フローティング翻訳入口の横にある「More」ボタンが、不自然なプレースホルダー画像のように見える問題を修正しました。',
          'More 入口は分かりやすい三点アイコンになり、右側のメイン翻訳ボタンとの役割がより明確になりました。',
          '小さな丸ボタン内のアイコンサイズと表示を調整し、ページ上の視覚的な違和感を減らしました。'
        ]
      }
    }
  },
  {
    version: '0.9.0',
    notes: {
      'zh-CN': {
        title: '悬浮翻译入口更顺手',
        items: [
          '点击页面小圆球现在会直接翻译或还原当前页面，常用操作不用再移动到长工具条末端。',
          '新增独立的“更多”入口，用来展开翻译范围、服务切换和设置，避免和主翻译动作混在一起。',
          '优化悬浮入口在左右两侧的排列，小圆球始终贴近屏幕边缘，拖动后的点击也会更稳。',
          '修复 Substack 文章下方 Comments 和 Restacks 切换后评论、转发内容漏翻的问题。'
        ]
      },
      'en-US': {
        title: 'A Smoother Floating Translation Entry',
        items: [
          'Clicking the floating page button now translates or restores the current page directly, so the everyday action no longer requires reaching across the long toolbar.',
          'Added a separate More entry for translation scope, service switching, and settings, keeping the primary translation action distinct.',
          'Improved the left/right layout of the floating entry so the round button stays close to the screen edge and clicks after dragging feel more reliable.',
          'Fixed missed translations for Substack Comments and Restacks after switching between the two discussion tabs.'
        ]
      },
      'zh-TW': {
        title: '懸浮翻譯入口更順手',
        items: [
          '點擊頁面小圓球現在會直接翻譯或還原目前頁面，常用操作不用再移到長工具列末端。',
          '新增獨立的「更多」入口，用來展開翻譯範圍、服務切換和設定，避免和主要翻譯動作混在一起。',
          '優化懸浮入口在左右兩側的排列，小圓球始終貼近螢幕邊緣，拖動後的點擊也會更穩。',
          '修復 Substack 文章下方 Comments 和 Restacks 切換後評論、轉發內容漏翻的問題。'
        ]
      },
      'ja-JP': {
        title: 'フローティング翻訳入口をより使いやすく',
        items: [
          'ページ上の丸いフローティングボタンをクリックすると、現在のページを直接翻訳または復元できるようになりました。',
          '翻訳範囲、サービス切り替え、設定を開くための独立した More 入口を追加し、主な翻訳操作と分けました。',
          '左右どちらに置いても丸いボタンが画面端に近い位置を保つよう、フローティング入口の並びを改善しました。',
          'Substack の Comments と Restacks を切り替えた後に、コメントやリスタック本文が翻訳されない問題を修正しました。'
        ]
      }
    }
  },
  {
    version: '0.8.0',
    notes: {
      'zh-CN': {
        title: '批量翻译与正文识别升级',
        items: [
          '新增网页批量翻译队列，支持合并请求、失败回退和取消处理，长页面翻译更稳。',
          '恢复“可视区优先、后台继续”的翻译调度，先翻当前看到的内容，再持续处理页面其他区域。',
          '优化长文档扫描性能，减少动态页面和整页翻译时的卡顿、卡死和重复计算。',
          '修复多类新闻、论文、更新日志页面的标题、摘要、导语和图文混排正文漏翻问题。'
        ]
      },
      'en-US': {
        title: 'Batch Translation and Article Detection Upgrade',
        items: [
          'Added a batch translation queue for webpages with request merging, failure fallback, and cancellation handling for more reliable long-page translation.',
          'Restored viewport-first scheduling with background continuation, translating what you see first while the rest of the page keeps progressing.',
          'Improved long-document scanning performance to reduce stalls, freezes, and repeated work on dynamic pages and full-page translation.',
          'Fixed missed titles, abstracts, summaries, leads, and image-wrapped article paragraphs across news, research, and changelog pages.'
        ]
      },
      'zh-TW': {
        title: '批量翻譯與正文識別升級',
        items: [
          '新增網頁批量翻譯佇列，支援合併請求、失敗回退和取消處理，長頁面翻譯更穩。',
          '恢復「可視區優先、背景繼續」的翻譯調度，先翻目前看到的內容，再持續處理頁面其他區域。',
          '優化長文件掃描效能，減少動態頁面和整頁翻譯時的卡頓、卡死和重複計算。',
          '修復多類新聞、論文、更新日誌頁面的標題、摘要、導語和圖文混排正文漏翻問題。'
        ]
      },
      'ja-JP': {
        title: 'バッチ翻訳と本文検出を強化',
        items: [
          'Web ページ向けのバッチ翻訳キューを追加し、リクエスト統合、失敗時のフォールバック、キャンセル処理により長いページの翻訳が安定しました。',
          '表示中の範囲を優先しつつバックグラウンドで続きを翻訳するスケジューリングを復元し、今見ている内容から先に翻訳されます。',
          '長い文書のスキャン性能を改善し、動的ページや全ページ翻訳での停止、固まり、重複計算を減らしました。',
          'ニュース、論文、更新履歴ページで、タイトル、要約、リード文、画像付き本文段落が翻訳されない問題を修正しました。'
        ]
      }
    }
  },
  {
    version: '0.7.0',
    notes: {
      'zh-CN': {
        title: '网页识别与双语排版增强',
        items: [
          '改进旧式文章页面、嵌套目录和多层列表的识文能力，减少 Paul Graham、技术博客目录等页面中的漏翻。',
          '优化双语译文插入布局，标题、卡片和弹性布局中的译文更不容易挤在同一行或破坏原页面排版。',
          '新增行内代码、变量和数学内容保护，翻译技术文章和文档时更好保留代码片段、公式与周围正文。',
          '修复弹窗和页面浮动工具条的翻译/还原状态同步，入口状态现在更一致。'
        ]
      },
      'en-US': {
        title: 'Better Page Detection and Bilingual Layout',
        items: [
          'Improved smart detection for legacy article pages, nested tables of contents, and multi-level lists, reducing missed translations on pages such as Paul Graham essays and technical blog outlines.',
          'Improved bilingual insertion layout so translations around headings, cards, and flex-style layouts are less likely to crowd the original text or disturb the page.',
          'Added protection for inline code, variables, and math content so technical articles and documentation keep code snippets, formulas, and surrounding prose in better shape.',
          'Fixed state sync between the popup and floating page toolbar so translate and restore actions stay consistent across entry points.'
        ]
      },
      'zh-TW': {
        title: '網頁識別與雙語排版增強',
        items: [
          '改進舊式文章頁面、巢狀目錄和多層列表的識文能力，減少 Paul Graham、技術部落格目錄等頁面中的漏翻。',
          '優化雙語譯文插入版面，標題、卡片和彈性版面中的譯文更不容易擠在同一行或破壞原頁面排版。',
          '新增內嵌程式碼、變數和數學內容保護，翻譯技術文章和文件時更好保留程式碼片段、公式與周圍正文。',
          '修復彈窗和頁面浮動工具列的翻譯/還原狀態同步，入口狀態現在更一致。'
        ]
      },
      'ja-JP': {
        title: 'ページ検出とバイリンガル表示を強化',
        items: [
          '古い形式の記事ページ、入れ子の目次、多階層リストのスマート検出を改善し、Paul Graham のエッセイや技術ブログの目次などで翻訳漏れを減らしました。',
          '見出し、カード、flex レイアウト付近のバイリンガル挿入を改善し、訳文が原文と同じ行に詰まったりページレイアウトを崩したりしにくくなりました。',
          'インラインコード、変数、数式の保護を追加し、技術記事やドキュメントでコード片、数式、周辺の本文をより自然に保ちます。',
          'ポップアップとページ上のフローティングツールバーの翻訳/復元状態同期を修正し、どの入口から操作しても状態が揃うようになりました。'
        ]
      }
    }
  },
  {
    version: '0.6.0',
    notes: {
      'zh-CN': {
        title: '页面浮动工具条升级',
        items: [
          '点击页面浮动入口会展开分离式胶囊工具条，翻译、还原、设置入口更集中也更清爽。',
          '可以直接在页面上切换“识文”和“全页”翻译范围，不必每次回到弹窗或设置页调整。',
          '浮动工具条支持快速切换已配置的翻译服务，当前服务状态在页面内一眼可见。',
          '优化页面翻译快捷键和工具条文案，翻译与还原状态表达更准确。'
        ]
      },
      'en-US': {
        title: 'Floating Page Toolbar Upgrade',
        items: [
          'The floating page entry now opens a detached capsule toolbar, bringing translate, restore, and settings actions into one cleaner control.',
          'You can switch between Smart and Full-page translation directly on the page without returning to the popup or settings page.',
          'The toolbar lets you quickly switch between configured translation services and shows the active service in place.',
          'Improved page-translation shortcut and toolbar labels so translate and restore states are clearer.'
        ]
      },
      'zh-TW': {
        title: '頁面浮動工具列升級',
        items: [
          '點擊頁面浮動入口會展開分離式膠囊工具列，翻譯、還原和設定入口更集中也更清爽。',
          '可以直接在頁面上切換「識文」和「全頁」翻譯範圍，不必每次回到彈窗或設定頁調整。',
          '浮動工具列支援快速切換已設定的翻譯服務，當前服務狀態可在頁面內直接查看。',
          '優化頁面翻譯快捷鍵和工具列文案，翻譯與還原狀態表達更準確。'
        ]
      },
      'ja-JP': {
        title: 'ページ上のフローティングツールバーを刷新',
        items: [
          'ページ上のフローティング入口をクリックすると、独立したカプセル型ツールバーが開き、翻訳、復元、設定をより扱いやすくまとめました。',
          'ポップアップや設定ページに戻らず、ページ上で「スマート」と「全ページ」の翻訳範囲を切り替えられます。',
          '設定済みの翻訳サービスをツールバーから素早く切り替えられ、現在のサービスもその場で確認できます。',
          'ページ翻訳のショートカットとツールバー文言を見直し、翻訳中と復元の状態がより分かりやすくなりました。'
        ]
      }
    }
  },
  {
    version: '0.5.7',
    notes: {
      'zh-CN': {
        title: '嵌套列表与引用内容翻译修复',
        items: [
          '修复 Smashing Magazine 等文章中嵌套列表前导文字漏翻的问题，父列表文字和子列表内容会分别进入翻译。',
          '改进列表项、定义说明、引用和图片说明中“文字 + 子块”结构的识别，减少父子内容合并或直接文字漏掉的情况。',
          '修复部分嵌入式 X/Twitter 引用块、博客摘录和说明框中的正文内容没有被识文翻译命中的问题。',
          '优化临时翻译目标的清理，翻译被跳过或页面动态再扫描后不再留下多余的内部包装节点。'
        ]
      },
      'en-US': {
        title: 'Nested List and Quote Translation Fixes',
        items: [
          'Fixed missed leading text in nested article lists, such as Smashing Magazine examples where parent list text and child list details should translate separately.',
          'Improved detection for list items, definition text, quotes, and captions that mix direct text with nested blocks, reducing merged or missed translation targets.',
          'Fixed missed readable text in embedded X/Twitter quotes, blog excerpts, and note-style content blocks during manual page-text translation.',
          'Improved cleanup for temporary translation targets so skipped translations and dynamic rescans do not leave extra internal wrapper nodes behind.'
        ]
      },
      'zh-TW': {
        title: '巢狀列表與引用內容翻譯修復',
        items: [
          '修復 Smashing Magazine 等文章中巢狀列表前導文字漏翻的問題，父列表文字和子列表內容會分別進入翻譯。',
          '改進列表項目、定義說明、引用和圖片說明中「文字 + 子區塊」結構的識別，減少父子內容合併或直接文字漏掉的情況。',
          '修復部分嵌入式 X/Twitter 引用區塊、部落格摘錄和說明框中的正文內容沒有被識文翻譯命中的問題。',
          '優化臨時翻譯目標的清理，翻譯被跳過或頁面動態重新掃描後不再留下多餘的內部包裝節點。'
        ]
      },
      'ja-JP': {
        title: '入れ子リストと引用文の翻訳修正',
        items: [
          'Smashing Magazine などの記事で、入れ子リストの親項目の先頭テキストが翻訳されない問題を修正しました。',
          'リスト項目、定義説明、引用、キャプションで「直接の文章 + 子ブロック」が混在する構造の検出を改善し、結合や翻訳漏れを減らしました。',
          '埋め込み X/Twitter 引用、ブログ抜粋、注記風の本文ブロックが識文翻訳で拾われないことがある問題を修正しました。',
          '一時的な翻訳対象の後片付けを改善し、翻訳をスキップした後や動的な再スキャン後に余分な内部ラッパーが残らないようにしました。'
        ]
      }
    }
  },
  {
    version: '0.5.6',
    notes: {
      'zh-CN': {
        title: '文章识别与标题漏翻修复',
        items: [
          '修复 archive.md、Substack、SemiAnalysis 和 Claude 帮助页等文章开头、标题或短说明漏翻的问题。',
          '改进正文识别逻辑，带有分享、订阅、相关内容等词的真实正文不再容易被误判跳过。',
          '优化带按钮和链接的文章区块处理，正文里出现 Copy、Share、Subscribe 等操作时仍能保留可读内容。',
          '补充多组网页结构回归样本，降低后续版本再次出现漏翻和误杀的风险。'
        ]
      },
      'en-US': {
        title: 'Article Detection and Missed Title Fixes',
        items: [
          'Fixed missed translations for article openings, titles, and short descriptions on pages such as archive.md, Substack, SemiAnalysis, and Claude Help.',
          'Improved article detection so real content mentioning share, subscribe, related, or similar words is less likely to be skipped by mistake.',
          'Improved handling for article blocks that contain buttons and links, keeping readable content even when actions such as Copy, Share, or Subscribe are nearby.',
          'Added more webpage-structure regression samples to reduce future missed translations and false skips.'
        ]
      },
      'zh-TW': {
        title: '文章識別與標題漏翻修復',
        items: [
          '修復 archive.md、Substack、SemiAnalysis 和 Claude 說明頁等文章開頭、標題或短說明漏翻的問題。',
          '改進正文識別邏輯，帶有分享、訂閱、相關內容等字詞的真實正文不再容易被誤判跳過。',
          '優化帶有按鈕和連結的文章區塊處理，正文裡出現 Copy、Share、Subscribe 等操作時仍能保留可讀內容。',
          '補充多組網頁結構回歸樣本，降低後續版本再次出現漏翻和誤殺的風險。'
        ]
      },
      'ja-JP': {
        title: '記事検出とタイトル翻訳漏れの修正',
        items: [
          'archive.md、Substack、SemiAnalysis、Claude ヘルプなどで、記事冒頭、タイトル、短い説明が翻訳されない問題を修正しました。',
          '本文検出を改善し、share、subscribe、related などの語を含む実際の本文が誤って除外されにくくなりました。',
          'ボタンやリンクを含む記事ブロックの処理を改善し、Copy、Share、Subscribe などの操作が近くにあっても読み物としての内容を保持します。',
          '複数のページ構造回帰サンプルを追加し、今後の翻訳漏れや誤除外の再発リスクを減らしました。'
        ]
      }
    }
  },
  {
    version: '0.5.5',
    notes: {
      'zh-CN': {
        title: '论坛回复翻译与稳定性修复',
        items: [
          '修复 Ziggit/Discourse 帖子回复中，带有内联代码的短段落漏翻的问题。',
          '改进动态论坛页的补扫识别，新增回复和正文旁的新段落更容易进入翻译范围。',
          '优化页面翻译入口、悬浮球快捷键、手动触发和输入框翻译的初始化稳定性。',
          '补充回归测试和发布前检查，降低升级后再次出现漏翻或误翻的风险。'
        ]
      },
      'en-US': {
        title: 'Forum Reply Translation and Stability Fixes',
        items: [
          'Fixed missed translations for short Ziggit/Discourse reply paragraphs that contain inline code.',
          'Improved follow-up scanning on dynamic forum pages so new replies and nearby readable paragraphs are picked up more reliably.',
          'Improved initialization stability for page translation, floating-ball shortcuts, manual triggers, and input-box translation.',
          'Expanded regression coverage and release checks to reduce the chance of translation misses or false positives after updates.'
        ]
      },
      'zh-TW': {
        title: '論壇回覆翻譯與穩定性修復',
        items: [
          '修復 Ziggit/Discourse 帖子回覆中，帶有內嵌程式碼的短段落漏翻問題。',
          '改進動態論壇頁的補掃識別，新增回覆和正文旁的新段落更容易進入翻譯範圍。',
          '優化頁面翻譯入口、懸浮球快捷鍵、手動觸發和輸入框翻譯的初始化穩定性。',
          '補充回歸測試和發布前檢查，降低升級後再次出現漏翻或誤翻的風險。'
        ]
      },
      'ja-JP': {
        title: 'フォーラム返信翻訳と安定性の修正',
        items: [
          'Ziggit/Discourse の返信で、インラインコードを含む短い段落が翻訳されない問題を修正しました。',
          '動的なフォーラムページの再検出を改善し、新しい返信や本文付近の段落をより確実に翻訳対象にしました。',
          'ページ翻訳、フローティングボールのショートカット、手動トリガー、入力欄翻訳の初期化をより安定させました。',
          '回帰テストとリリース前チェックを追加し、更新後の翻訳漏れや誤検出のリスクを減らしました。'
        ]
      }
    }
  },
  {
    version: '0.5.4',
    notes: {
      'zh-CN': {
        title: '识文性能与论坛页修复',
        items: [
          '优化大型新闻、门户和直播类页面的识文扫描，减少导航、广告、推荐区域带来的卡顿。',
          '新增共享扫描缓存和扫描预算，页面动态更新时会合并补扫，翻译响应更稳定。',
          '修复 Ziggit/Discourse 论坛主题列表标题无法进入翻译范围的问题。',
          '补充 Heavy 页面、直播流页面和论坛列表回归样本，降低识文规则反复风险。'
        ]
      },
      'en-US': {
        title: 'Content Detection Performance and Forum Fixes',
        items: [
          'Optimized content detection on large news, portal, and live-style pages to reduce slowdown from navigation, ads, and recommendation areas.',
          'Added shared scan caching and scan budgets so dynamic page updates are batched and translated more reliably.',
          'Fixed Ziggit/Discourse forum topic list titles not being included in the translation scope.',
          'Added regression fixtures for Heavy pages, live-like pages, and forum lists to reduce content-detection rule regressions.'
        ]
      },
      'zh-TW': {
        title: '識文效能與論壇頁修復',
        items: [
          '優化大型新聞、入口網站和直播類頁面的識文掃描，減少導覽、廣告、推薦區域造成的卡頓。',
          '新增共用掃描快取和掃描預算，頁面動態更新時會合併補掃，翻譯反應更穩定。',
          '修復 Ziggit/Discourse 論壇主題列表標題無法進入翻譯範圍的問題。',
          '補充 Heavy 頁面、直播流頁面和論壇列表回歸樣本，降低識文規則反覆風險。'
        ]
      },
      'ja-JP': {
        title: 'コンテンツ検出の高速化とフォーラム修正',
        items: [
          '大型ニュース、ポータル、ライブ形式のページで、ナビゲーション、広告、推薦エリアによる検出の遅さを軽減しました。',
          '共有スキャンキャッシュとスキャン上限を追加し、動的なページ更新をまとめて再検出できるようにしました。',
          'Ziggit/Discourse のフォーラム一覧で、トピックタイトルが翻訳対象に入らない問題を修正しました。',
          'Heavy ページ、ライブ風ページ、フォーラム一覧の回帰サンプルを追加し、検出ルールの揺り戻しを抑えました。'
        ]
      }
    }
  },
  {
    version: '0.5.3',
    notes: {
      'zh-CN': {
        title: '站点翻译排版修复',
        items: [
          '修复 Decrypt 文章页标题和部分正文段落漏翻的问题。',
          '修复 GitHub Pull Request 评论翻译挤在一起的问题，段落和列表会按原结构显示译文。',
          '修复 Asterisk 文章页顶部章节导航被误翻译的问题。',
          '继续减少阅读模式下侧栏、目录和页面控件对正文翻译的干扰。'
        ]
      },
      'en-US': {
        title: 'Site Translation Layout Fixes',
        items: [
          'Fixed missing title and article paragraph translations on Decrypt article pages.',
          'Fixed GitHub Pull Request comment translations being grouped at the bottom instead of following each paragraph and list item.',
          'Fixed Asterisk article progress navigation being translated as extra page content.',
          'Reduced sidebar, table-of-contents, and page-control noise in article translation targets.'
        ]
      },
      'zh-TW': {
        title: '站點翻譯排版修復',
        items: [
          '修復 Decrypt 文章頁標題和部分正文段落漏翻的問題。',
          '修復 GitHub Pull Request 留言譯文擠在一起的問題，段落和列表會依照原結構顯示譯文。',
          '修復 Asterisk 文章頁頂部章節導覽被誤翻譯的問題。',
          '持續減少閱讀模式下側欄、目錄和頁面控制項對正文翻譯的干擾。'
        ]
      },
      'ja-JP': {
        title: 'サイト翻訳レイアウトの修正',
        items: [
          'Decrypt の記事ページでタイトルや一部本文段落が翻訳されない問題を修正しました。',
          'GitHub Pull Request コメントの翻訳が末尾にまとまって表示される問題を修正し、段落やリスト項目ごとに表示されるようにしました。',
          'Asterisk の記事ページで上部の章ナビゲーションが余分な本文として翻訳される問題を修正しました。',
          '記事翻訳時にサイドバー、目次、ページ操作部品が本文翻訳に混ざるケースを減らしました。'
        ]
      }
    }
  },
  {
    version: '0.5.2',
    notes: {
      'zh-CN': {
        title: '页面翻译识别与排版修复',
        items: [
          '修复部分文章正文段落被误判为作者信息而漏翻的问题，包含链接的长段落也能正常进入翻译范围。',
          '优化代码、键盘按键和终端示例等内联格式，双语显示时会尽量保留原页面样式。',
          '改进 Claude 学习页等文档页面的侧栏内容识别，比较卡片和详情区不再容易漏翻。',
          '修复划词翻译在服务可用时仍提示访问令牌未配置的问题。'
        ]
      },
      'en-US': {
        title: 'Page Translation Detection and Layout Fixes',
        items: [
          'Fixed article paragraphs being mistaken for author metadata, so long linked paragraphs are included in translation again.',
          'Improved inline formatting preservation for code, keyboard keys, and terminal examples in bilingual output.',
          'Improved document-page side content detection, including comparison cards and detail sections on Claude learning pages.',
          'Fixed selection translation showing an access-token warning even when the active translation service was usable.'
        ]
      },
      'zh-TW': {
        title: '頁面翻譯識別與排版修復',
        items: [
          '修復部分文章正文段落被誤判為作者資訊而漏翻的問題，包含連結的長段落也能正常進入翻譯範圍。',
          '優化程式碼、鍵盤按鍵和終端範例等內嵌格式，雙語顯示時會盡量保留原頁面樣式。',
          '改進 Claude 學習頁等文件頁面的側欄內容識別，比較卡片和詳細資訊區不再容易漏翻。',
          '修復劃詞翻譯在服務可用時仍提示存取權杖未設定的問題。'
        ]
      },
      'ja-JP': {
        title: 'ページ翻訳の検出とレイアウト修正',
        items: [
          '記事本文の段落が著者情報として誤判定され、一部翻訳されない問題を修正しました。リンクを含む長い段落も翻訳対象になります。',
          'コード、キーボード入力、端末例などのインライン形式を改善し、バイリンガル表示でも元の見た目をできるだけ維持します。',
          'Claude 学習ページなどのドキュメントページで、比較カードや詳細セクションの検出を改善しました。',
          '利用可能な翻訳サービスがある場合でも、選択翻訳でアクセストークン未設定の警告が出る問題を修正しました。'
        ]
      }
    }
  },
  {
    version: '0.5.1',
    notes: {
      'zh-CN': {
        title: '更新说明支持多语言',
        items: [
          '扩展内更新说明会跟随界面语言显示，中文、英文、繁体中文和日文用户都能直接阅读。',
          'Popup 和 Options 关于页共用同一份多语言更新说明，避免两个入口内容不一致。',
          '发布前校验会检查目标版本的多语言文案，减少后续版本漏写说明的风险。'
        ]
      },
      'en-US': {
        title: 'Multilingual Release Notes',
        items: [
          'In-extension release notes now follow the interface language across Chinese, English, Traditional Chinese, and Japanese.',
          'The Popup and Options About page read from the same localized release notes so both entry points stay consistent.',
          'Release readiness checks now validate localized notes for the target version to prevent missing user-facing copy.'
        ]
      },
      'zh-TW': {
        title: '更新說明支援多語言',
        items: [
          '擴充套件內的更新說明會跟隨介面語言顯示，中文、英文、繁體中文和日文使用者都能直接閱讀。',
          'Popup 和 Options 關於頁共用同一份多語言更新說明，避免兩個入口內容不一致。',
          '發布前校驗會檢查目標版本的多語言文案，降低後續版本漏寫說明的風險。'
        ]
      },
      'ja-JP': {
        title: 'リリースノートの多言語対応',
        items: [
          '拡張機能内のリリースノートが表示言語に合わせて、中国語、英語、繁体字中国語、日本語で表示されます。',
          'Popup と Options の About ページが同じ多言語リリースノートを参照し、表示内容のずれを防ぎます。',
          'リリース前チェックで対象バージョンの多言語文言を検証し、今後の記載漏れを減らします。'
        ]
      }
    }
  },
  {
    version: '0.5.0',
    notes: {
      'zh-CN': {
        title: 'GitHub 页面翻译与服务选择优化',
        items: [
          '修复 GitHub 搜索结果页仓库描述漏翻，同时避免筛选栏、排序按钮和结果元信息被误翻译。',
          '修复 GitHub Issue 和 Pull Request 列表标题漏翻，列表标签和元信息会继续保持原样。',
          '优化 GitHub 搜索页右侧赞助提示的译文位置，避免译文出现在 ProTip 等无关区域。',
          '精简 Popup 翻译服务列表，移除旧的固定自定义接口入口，并将分组文案改得更清晰。',
          '修正 New API 一键填充逻辑，配置会直接写入 New API 服务，不再走旧自定义接口。'
        ]
      },
      'en-US': {
        title: 'GitHub Translation and Service Picker Improvements',
        items: [
          'Fixed missing translations for GitHub repository search descriptions while keeping filters, sort controls, and result metadata untouched.',
          'Fixed missing translations for GitHub Issue and Pull Request list titles while preserving labels and list metadata.',
          'Improved translation placement for the sponsor suggestion on GitHub search pages so translated text no longer appears in unrelated ProTip areas.',
          'Simplified the Popup translation service list by removing the old fixed custom interface entry and clarifying group labels.',
          'Fixed New API one-click filling so configuration is written directly to the New API service instead of the old custom interface.'
        ]
      },
      'zh-TW': {
        title: 'GitHub 頁面翻譯與服務選擇優化',
        items: [
          '修復 GitHub 搜尋結果頁倉庫描述漏翻，同時避免篩選欄、排序按鈕和結果中繼資訊被誤翻譯。',
          '修復 GitHub Issue 和 Pull Request 列表標題漏翻，列表標籤和中繼資訊會繼續保持原樣。',
          '優化 GitHub 搜尋頁右側贊助提示的譯文位置，避免譯文出現在 ProTip 等無關區域。',
          '精簡 Popup 翻譯服務列表，移除舊的固定自訂介面入口，並讓分組文案更清楚。',
          '修正 New API 一鍵填充邏輯，設定會直接寫入 New API 服務，不再走舊自訂介面。'
        ]
      },
      'ja-JP': {
        title: 'GitHub ページ翻訳とサービス選択の改善',
        items: [
          'GitHub 検索結果ページのリポジトリ説明が翻訳されない問題を修正し、フィルター、並び替えボタン、結果メタ情報は翻訳対象外のままにしました。',
          'GitHub Issue と Pull Request 一覧のタイトルが翻訳されない問題を修正し、ラベルと一覧メタ情報は元の表示を維持します。',
          'GitHub 検索ページ右側のスポンサー案内の翻訳位置を改善し、ProTip など無関係な領域に翻訳が出ないようにしました。',
          'Popup の翻訳サービス一覧を整理し、古い固定カスタムインターフェース項目を削除して、グループ名を分かりやすくしました。',
          'New API のワンクリック入力を修正し、設定が古いカスタムインターフェースではなく New API サービスへ直接保存されるようにしました。'
        ]
      }
    }
  },
  {
    version: '0.4.0',
    notes: {
      'zh-CN': {
        title: '识文内容结构优化',
        items: [
          '增强识文模式的内容单元识别，文章外的重点卡片和说明内容也能更稳定地翻译。',
          '修复可展开内容卡片的翻译时机和显示位置，折叠内容不再提前露出译文。',
          '优化 GitHub README 列表翻译，长列表会按条目显示译文，阅读更清晰。',
          '改进 CNN、Towards Data Science 等站点适配，首页标题和相关文章卡片不再漏翻。',
          '减少社交链接、分享区和作者信息的误翻译。'
        ]
      }
    }
  },
  {
    version: '0.3.1',
    notes: {
      'zh-CN': {
        title: '识文范围与页面兼容性修复',
        items: [
          '优化文章标题识别，CNN 等页面的正文标题可以一起翻译。',
          '改进动态内容翻译，展开后的正文会更稳定地进入翻译流程。',
          '增强 Reddit、GitHub 等页面的识文兜底与站点适配，减少漏翻和误翻。',
          '修复脚本源码被当作正文翻译的问题。'
        ]
      }
    }
  },
  {
    version: '0.3.0',
    notes: {
      'zh-CN': {
        title: '智能识文与交互体验升级',
        items: [
          '翻译范围改为“识文 / 全页”分段按钮，快速进行模式切换。',
          '智能模式更精准，自动跳过按钮、菜单等交互元素，减少干扰性译文。',
          '修复 GitHub 全文翻译不一致，About 侧边栏各条目不再出现部分原文、部分译文混排。',
          '设置页新增“关于只译”页面。',
          '支持一键刷新 AI 厂商模型列表。'
        ]
      }
    }
  },
  {
    version: '0.2.0',
    notes: {
      'zh-CN': {
        title: '双向互译与翻译稳定性优化',
        items: [
          '新增双向互译设置，可在默认目标语言和互译语言之间自动判断翻译方向。',
          'Popup 新增更新说明入口，后续版本的新功能可以在扩展内快速查看。',
          '优化 Reddit、CNN 等页面的全文翻译稳定性，减少空内容误翻译和重复译文。',
          '清理商店版运行时体验，减少无关调试信息对日常使用的干扰。'
        ]
      }
    }
  },
  {
    version: '0.1.0',
    notes: {
      'zh-CN': {
        title: '首个商店版本',
        items: [
          '支持网页全文翻译与划词翻译，阅读外语网页更顺手。',
          '新增 YouTube、Udemy、Coursera 等平台的视频字幕翻译。',
          '重做设置面板，支持按需启用翻译服务和管理自定义接口。'
        ]
      }
    }
  }
];

export function findReleaseNoteByVersion(
  version: string,
  localePreference?: string
): ResolvedReleaseNote | null {
  const releaseNote = releaseNotes.find((item) => item.version === version);
  if (!releaseNote) return null;

  const preferredLocale = normalizeReleaseNoteLocale(localePreference);
  const fallback = resolveLocalizedReleaseNote(releaseNote, preferredLocale)
    ?? resolveLocalizedReleaseNote(releaseNote, releaseNoteFallbackLocale)
    ?? resolveFirstLocalizedReleaseNote(releaseNote);

  if (!fallback) return null;

  return {
    version: releaseNote.version,
    locale: fallback.locale,
    title: fallback.note.title,
    items: fallback.note.items
  };
}

export async function syncReleaseNotesInstallState(
  reason: string | undefined,
  currentVersion: string
): Promise<void> {
  if (reason === 'install') {
    await Promise.all([
      storage.setItem(RELEASE_NOTES_INIT_KEY, true),
      storage.setItem(RELEASE_NOTES_SEEN_VERSION_KEY, currentVersion)
    ]);
    return;
  }

  if (reason === 'update') {
    const initialized = await storage.getItem(RELEASE_NOTES_INIT_KEY);
    if (initialized !== true && initialized !== 'true') {
      await storage.setItem(RELEASE_NOTES_INIT_KEY, true);
    }
  }
}

function resolveLocalizedReleaseNote(releaseNote: ReleaseNote, locale: ReleaseNoteLocale) {
  const note = releaseNote.notes[locale];
  return note ? { locale, note } : null;
}

function resolveFirstLocalizedReleaseNote(releaseNote: ReleaseNote) {
  for (const locale of releaseNoteLocales) {
    const localizedNote = resolveLocalizedReleaseNote(releaseNote, locale);
    if (localizedNote) return localizedNote;
  }
  return null;
}

function normalizeReleaseNoteLocale(localePreference?: string): ReleaseNoteLocale {
  if (!localePreference || localePreference === 'auto') return releaseNoteFallbackLocale;
  const normalized = localePreference.replace('_', '-').toLowerCase();

  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ja')) return 'ja-JP';
  if (normalized.startsWith('en')) return 'en-US';

  return releaseNoteFallbackLocale;
}
