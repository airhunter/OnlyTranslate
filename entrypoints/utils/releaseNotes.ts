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
    version: '0.5.0',
    title: 'GitHub 页面翻译与服务选择优化',
    items: [
      '修复 GitHub 搜索结果页仓库描述漏翻，同时避免筛选栏、排序按钮和结果元信息被误翻译。',
      '修复 GitHub Issue 和 Pull Request 列表标题漏翻，列表标签和元信息会继续保持原样。',
      '优化 GitHub 搜索页右侧赞助提示的译文位置，避免译文出现在 ProTip 等无关区域。',
      '精简 Popup 翻译服务列表，移除旧的固定自定义接口入口，并将分组文案改得更清晰。',
      '修正 New API 一键填充逻辑，配置会直接写入 New API 服务，不再走旧自定义接口。'
    ]
  },
  {
    version: '0.4.0',
    title: '识文内容结构优化',
    items: [
      '增强识文模式的内容单元识别，文章外的重点卡片和说明内容也能更稳定地翻译。',
      '修复可展开内容卡片的翻译时机和显示位置，折叠内容不再提前露出译文。',
      '优化 GitHub README 列表翻译，长列表会按条目显示译文，阅读更清晰。',
      '改进 CNN、Towards Data Science 等站点适配，首页标题和相关文章卡片不再漏翻。',
      '减少社交链接、分享区和作者信息的误翻译。'
    ]
  },
  {
    version: '0.3.1',
    title: '识文范围与页面兼容性修复',
    items: [
      '优化文章标题识别，CNN 等页面的正文标题可以一起翻译。',
      '改进动态内容翻译，展开后的正文会更稳定地进入翻译流程。',
      '增强 Reddit、GitHub 等页面的识文兜底与站点适配，减少漏翻和误翻。',
      '修复脚本源码被当作正文翻译的问题。'
    ]
  },
  {
    version: '0.3.0',
    title: '智能识文与交互体验升级',
    items: [
      '翻译范围改为「识文 / 全页」分段按钮，快速进行模式切换。',
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
