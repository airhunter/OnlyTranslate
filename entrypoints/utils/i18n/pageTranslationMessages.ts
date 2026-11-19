export const pageTranslationMessages = {
  'zh-CN': {
    pending: '正在翻译，点击可取消',
    optOut: '网页标记了整页禁译。可手动点击翻译。',
    noTargets: '当前翻译范围内没有找到可翻译的内容。',
    noOutput: '本次没有生成可显示的译文。',
    failed: '本次翻译失败，请重试。'
  },
  'en-US': {
    pending: 'Translating. Click to cancel.',
    optOut: 'This page opts out of automatic translation. Click to translate it manually.',
    noTargets: 'No translatable content was found in the selected scope.',
    noOutput: 'This run produced no translation to display.',
    failed: 'Translation failed. Try again.'
  },
  'zh-TW': {
    pending: '正在翻譯，點擊可取消',
    optOut: '網頁標記了整頁禁譯。可手動點擊翻譯。',
    noTargets: '目前翻譯範圍內找不到可翻譯的內容。',
    noOutput: '本次沒有產生可顯示的譯文。',
    failed: '本次翻譯失敗，請重試。'
  },
  'ja-JP': {
    pending: '翻訳中です。クリックでキャンセルできます。',
    optOut: 'このページは自動翻訳を禁止しています。クリックすると手動で翻訳できます。',
    noTargets: '選択した範囲内に翻訳できる内容が見つかりませんでした。',
    noOutput: '表示できる翻訳結果がありませんでした。',
    failed: '翻訳に失敗しました。もう一度お試しください。'
  }
} as const;
