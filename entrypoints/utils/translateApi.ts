/**
 * 翻译API代理模块
 * 整合翻译队列管理，作为翻译函数和后台翻译服务之间的中间层
 */

import { enqueueTranslation, clearTranslationQueue } from './translateQueue';
import browser from 'webextension-polyfill';
import { config } from './config';
import { cache } from './cache';
import { storage } from '@wxt-dev/storage';
import { resolveTranslationDirection } from './translationDirection';
import { t } from './i18n';

// 调试相关
const isDev = process.env.NODE_ENV === 'development';
const MAX_RETRY_DELAY = 30000;

let cancellationGeneration = 0;
const inFlightTranslations = new Map<string, Promise<string>>();

export class TranslationCancelledError extends Error {
  constructor() {
    super('Translation cancelled');
    this.name = 'TranslationCancelledError';
  }
}

export function isTranslationCancelledError(error: unknown): boolean {
  return error instanceof TranslationCancelledError
    || (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'TranslationCancelledError');
}

function normalizeRuntimeTranslationResult(result: unknown): string {
  if (typeof result === 'string') return result;

  if (result && typeof result === 'object') {
    const response = result as Record<string, unknown>;
    if (response.success === false) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Translation failed');
    }

    for (const key of ['translatedText', 'text', 'content']) {
      if (typeof response[key] === 'string') return response[key];
    }

    throw new Error(`Unexpected translation response: ${JSON.stringify(result)}`);
  }

  return result == null ? '' : String(result);
}

function assertNotCancelled(startGeneration: number): void {
  if (startGeneration !== cancellationGeneration) {
    throw new TranslationCancelledError();
  }
}

function getRetryDelay(retryCount: number, baseDelay: number): number {
  return Math.min(baseDelay * (2 ** retryCount), MAX_RETRY_DELAY);
}

function buildInFlightTranslationKey(
  origin: string,
  context: string,
  sourceLang: string,
  targetLang: string
): string {
  const service = config.service;
  const model = config.model?.[service] ?? '';
  const customModel = config.customModel?.[service] ?? '';
  return JSON.stringify([
    service,
    model,
    customModel,
    config.style ?? '',
    sourceLang,
    targetLang,
    context,
    origin
  ]);
}

/**
 * 翻译API的统一入口
 * 所有翻译请求都应该通过此函数发送，以便集中管理队列和重试逻辑
 * 
 * @param origin 原始文本
 * @param context 上下文信息，通常是页面标题
 * @param options 翻译选项
 * @returns 翻译结果的Promise
 */
export async function translateText(origin: string, context: string = document.title, options: TranslateOptions = {}): Promise<string> {
  const {
    maxRetries = 3, 
    retryDelay = 1000, 
    timeout = 45000,
    useCache = config.useCache,
  } = options;

  const safeOrigin = typeof origin === 'string' ? origin : String(origin ?? '');

  // 空原文不进入翻译队列，避免 AI 服务在空提示下生成无关内容。
  if (!safeOrigin.trim()) {
    return safeOrigin;
  }

  const direction = resolveTranslationDirection(safeOrigin);

  // 如果本次目标语言与当前文本语言相同，直接返回原文
  if (!direction.shouldTranslate) {
    return origin;
  }

  const inFlightKey = buildInFlightTranslationKey(safeOrigin, context, direction.sourceLang, direction.targetLang);
  const inFlight = inFlightTranslations.get(inFlightKey);
  if (inFlight) return inFlight;

  // 检查缓存
  if (useCache) {
    const cachedResult = cache.localGet(safeOrigin, direction.targetLang);
    if (cachedResult) {
      if (isDev) {
        console.log('[翻译API] 命中缓存，直接返回缓存结果');
      }
      return cachedResult;
    }
  }

  // 增加翻译计数
  config.count++;
  // 保存配置以确保计数持久化
  storage.setItem('local:config', JSON.stringify(config));

  // 使用队列处理翻译请求
  const requestGeneration = cancellationGeneration;
  const translationPromise = enqueueTranslation(async () => {
    // 创建翻译任务
    const translationTask = async (retryCount: number = 0): Promise<string> => {
      try {
        assertNotCancelled(requestGeneration);
        // 发送翻译请求给background脚本处理
        const response = await Promise.race([
          browser.runtime.sendMessage({
            context,
            origin: safeOrigin,
            sourceLang: direction.sourceLang,
            targetLang: direction.targetLang,
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(t('runtime.translationRequestTimeout'))), timeout)
          )
        ]);
        assertNotCancelled(requestGeneration);
        const result = normalizeRuntimeTranslationResult(response);

        // 如果翻译结果为空或与原文完全相同，直接返回原文
        if (!result || result === safeOrigin) {
          return safeOrigin;
        }

        // 缓存翻译结果
        if (useCache) {
          cache.localSet(safeOrigin, result, direction.targetLang);
        }

        return result;
      } catch (error) {
        if (isTranslationCancelledError(error)) {
          throw error;
        }

        // 处理错误，根据重试策略决定是否重试
        if (retryCount < maxRetries) {
          if (isDev) {
            console.log(`[翻译API] 翻译失败，${retryCount + 1}/${maxRetries} 次重试，原因:`, error);
          }
          
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, getRetryDelay(retryCount, retryDelay)));
          return translationTask(retryCount + 1);
        }
        
        // 超过最大重试次数，抛出异常
        throw error;
      }
    };

    // 开始执行翻译任务
    return translationTask();
  });

  const trackedPromise = translationPromise.finally(() => {
    if (inFlightTranslations.get(inFlightKey) === trackedPromise) {
      inFlightTranslations.delete(inFlightKey);
    }
  });
  inFlightTranslations.set(inFlightKey, trackedPromise);

  return trackedPromise;
}

/**
 * 当用户离开页面或主动取消翻译时，清空翻译队列
 */
export function cancelAllTranslations() {
  if (isDev) {
    console.log('[翻译API] 取消所有等待中的翻译任务');
  }
  cancellationGeneration += 1;
  inFlightTranslations.clear();
  clearTranslationQueue();
}

/**
 * 翻译参数接口
 */
export interface TranslateOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试间隔(毫秒) */
  retryDelay?: number;
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
} 
