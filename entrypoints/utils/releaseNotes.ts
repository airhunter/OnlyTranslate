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
