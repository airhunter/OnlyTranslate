import { storage } from '@wxt-dev/storage';

export interface ReleaseNote {
  version: string;
  title: string;
  items: string[];
}

export const RELEASE_NOTES_SEEN_VERSION_KEY = 'local:lastSeenReleaseNotesVersion';
export const RELEASE_NOTES_INIT_KEY = 'local:releaseNotesInitialized';

export const releaseNotes: ReleaseNote[] = [
  {
    version: '0.3.0',
    title: '智能识文与交互体验升级',
    items: [
      '翻译范围改为「✦ 识文 / 全页」分段按钮，快速进行模式切换。',
      '智能模式更精准，自动跳过按钮、菜单等交互元素，减少干扰性译文。',
      '修复 GitHub 全文翻译不一致，About 侧边栏各条目不再出现部分原文、部分译文混排。',
      '设置页新增「关于只译」页面。',
      '支持一键刷新 AI 厂商模型列表。'
    ]
  },
  {
    version: '0.2.0',
    title: '双向互译与翻译稳定性优化',
    items: [
      '新增双向互译设置，可在默认目标语言和互译语言之间自动判断翻译方向。',
      'Popup 新增更新说明入口，后续版本的新功能可以在扩展内快速查看。',
      '优化 Reddit、CNN 等页面的全文翻译稳定性，减少空内容误翻译和重复译文。',
      '清理商店版运行时体验，减少无关调试信息对日常使用的干扰。'
    ]
  },
  {
    version: '0.1.0',
    title: '首个商店版本',
    items: [
      '支持网页全文翻译与划词翻译，阅读外语网页更顺手。',
      '新增 YouTube、Udemy、Coursera 等平台的视频字幕翻译。',
      '重做设置面板，支持按需启用翻译服务和管理自定义接口。'
    ]
  }
];

export function findReleaseNoteByVersion(version: string): ReleaseNote | null {
  return releaseNotes.find((item) => item.version === version) ?? null;
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
