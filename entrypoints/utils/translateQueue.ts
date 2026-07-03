/**
 * 翻译队列管理模块
 * 控制并发翻译任务的数量，避免同时进行过多翻译请求
 */

import { config } from './config';

// 队列状态
let activeTranslations = 0; // 当前活跃的翻译任务数量
let activeBackgroundTranslations = 0; // 当前活跃的后台翻译任务数量

export type TranslationPriority = 'high' | 'normal' | 'background';

export interface EnqueueTranslationOptions {
  priority?: TranslationPriority;
}

interface PendingTranslationTask {
  run: () => Promise<unknown>;
  priority: TranslationPriority;
}

let pendingTranslations: PendingTranslationTask[] = []; // 等待执行的翻译任务队列

// 调试相关
const isDev = process.env.NODE_ENV === 'development';
const RESERVED_FOREGROUND_TRANSLATION_SLOTS = 2;

// 获取最大并发翻译数量
function getMaxConcurrentTranslations(): number {
  return config.maxConcurrentTranslations || 6; // 默认值为6
}

export function getBackgroundTranslationSlotLimit(maxConcurrent: number = getMaxConcurrentTranslations()): number {
  const reservedForegroundSlots = Math.min(
    RESERVED_FOREGROUND_TRANSLATION_SLOTS,
    Math.max(0, maxConcurrent - 1)
  );

  return Math.max(1, maxConcurrent - reservedForegroundSlots);
}

function logQueueStatus(event: string) {
  if (!isDev) return;
  console.debug('[OnlyTranslate][translation-queue]', event, getQueueStatus());
}

function normalizePriority(priority: TranslationPriority | undefined): TranslationPriority {
  return priority ?? 'normal';
}

function hasPendingForegroundTranslations(): boolean {
  return pendingTranslations.some(task => task.priority !== 'background');
}

export function hasForegroundTranslationWork(): boolean {
  return activeTranslations > activeBackgroundTranslations || hasPendingForegroundTranslations();
}

function canStartPriority(priority: TranslationPriority): boolean {
  const maxConcurrent = getMaxConcurrentTranslations();
  if (activeTranslations >= maxConcurrent) return false;

  if (priority !== 'background') return true;

  const backgroundSlotLimit = getBackgroundTranslationSlotLimit(maxConcurrent);
  if (hasPendingForegroundTranslations()) return false;
  if (activeBackgroundTranslations >= backgroundSlotLimit) return false;
  if (activeTranslations >= backgroundSlotLimit) return false;

  return true;
}

function startTask(task: PendingTranslationTask): void {
  activeTranslations++;
  if (task.priority === 'background') {
    activeBackgroundTranslations++;
  }
  logQueueStatus('started');
  task.run().catch(() => {
    // 错误已在任务内部处理，这里仅防止未捕获的 Promise 异常。
  });
}

/**
 * 添加翻译任务到队列
 * @param translationTask 翻译任务函数, 需要返回Promise
 * @returns 返回一个Promise，当任务执行完成时resolve
 */
export function enqueueTranslation<T>(
  translationTask: () => Promise<T>,
  options: EnqueueTranslationOptions = {}
): Promise<T> {
  const priority = normalizePriority(options.priority);

  return new Promise((resolve, reject) => {
    // 创建任务包装器，在任务完成后处理队列状态
    const taskWrapper = async () => {
      try {
        // 执行实际的翻译任务
        const result = await translationTask();
        resolve(result);
        return result;
      } catch (error) {
        reject(error);
        throw error;
      } finally {
        // 无论成功失败，都需要减少活跃任务计数并处理队列
        activeTranslations--;
        if (priority === 'background') {
          activeBackgroundTranslations--;
        }
        logQueueStatus('finished');
        processQueue();
      }
    };

    const pendingTask: PendingTranslationTask = {
      run: taskWrapper,
      priority
    };

    // 将任务添加到队列
    if (canStartPriority(priority)) {
      // 直接执行任务
      startTask(pendingTask);
    } else {
      pendingTranslations.push(pendingTask);
      logQueueStatus('queued');
    }
  });
}

function takeNextRunnableTask(): PendingTranslationTask | undefined {
  const priorityOrder: TranslationPriority[] = ['high', 'normal', 'background'];

  for (const priority of priorityOrder) {
    if (!canStartPriority(priority)) continue;
    const index = pendingTranslations.findIndex(task => task.priority === priority);
    if (index >= 0) {
      const [task] = pendingTranslations.splice(index, 1);
      return task;
    }
  }

  return undefined;
}

/**
 * 处理队列中的下一个任务
 */
function processQueue() {
  while (pendingTranslations.length > 0) {
    const nextTask = takeNextRunnableTask();
    if (!nextTask) return;
    logQueueStatus('dequeued-started');
    startTask(nextTask);
  }
}

/**
 * 清空翻译队列
 * 当页面切换或用户手动停止翻译时调用
 */
export function clearTranslationQueue() {
  
  pendingTranslations = [];
  logQueueStatus('cleared');
  // 不重置activeTranslations，让活跃的翻译任务自然完成
}

/**
 * 获取队列状态
 * @returns 返回当前队列状态对象
 */
export function getQueueStatus() {
  const maxConcurrent = getMaxConcurrentTranslations();
  const pendingBackgroundTranslations = pendingTranslations.filter(task => task.priority === 'background').length;
  return {
    activeTranslations,
    activeBackgroundTranslations,
    pendingTranslations: pendingTranslations.length,
    pendingBackgroundTranslations,
    pendingForegroundTranslations: pendingTranslations.length - pendingBackgroundTranslations,
    maxConcurrent: maxConcurrent,
    isQueueFull: activeTranslations >= maxConcurrent,
    totalTasksInProcess: activeTranslations + pendingTranslations.length
  };
}

/**
 * 检查是否可以添加更多任务
 * 当快速扫描页面，判断是否需要暂停扫描时使用
 */
export function canAcceptMoreTasks(): boolean {
  // 如果等待队列太长，返回false表示需要暂停扫描
  const MAX_QUEUE_LENGTH = getMaxConcurrentTranslations() * 3;
  return pendingTranslations.length < MAX_QUEUE_LENGTH;
}
