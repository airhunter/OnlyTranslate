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
