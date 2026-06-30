/**
 * 翻译API代理模块
 * 整合翻译队列管理，作为翻译函数和后台翻译服务之间的中间层
 */

import { enqueueTranslation, clearTranslationQueue } from './translateQueue';
import {
  clearBatchTranslationQueue,
  DEFAULT_BATCH_TRANSLATION_OPTIONS,
  enqueueBatchTranslation
} from './batchTranslateQueue';
import browser from 'webextension-polyfill';
import { config } from './config';
import { cache } from './cache';
import { storage } from '@wxt-dev/storage';
import { resolveTranslationDirection } from './translationDirection';
import { t } from './i18n';
import { customModelString, defaultOption, services, servicesType } from './option';

// 调试相关
const isDev = process.env.NODE_ENV === 'development';
const MAX_RETRY_DELAY = 30000;
const BATCH_TRANSLATION_SERVICES = new Set<string>([
  services.openai,
  services.moonshot,
  services.jieyue,
  services.siliconCloud,
  services.openrouter,
  services.grok,
  services.deepseek,
  services.newapi,
]);

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

function resolveCurrentModel(): string {
  const service = config.service;
  if (service.startsWith('custom_')) {
    const provider = config.customProviders?.find(provider => provider.id === service);
    return provider?.model === customModelString ? provider.customModel : (provider?.model ?? '');
  }
  return config.model?.[service] === customModelString
    ? config.customModel?.[service] ?? ''
    : config.model?.[service] ?? '';
}

function buildBatchTranslationKey(context: string, sourceLang: string, targetLang: string): string {
  const service = config.service;
  return JSON.stringify([
    service,
    resolveCurrentModel(),
    config.customModel?.[service] ?? '',
    config.style ?? '',
    sourceLang,
    targetLang,
    context
  ]);
}

function isDefaultPromptForBatch(): boolean {
  const prompt = config.user_role?.[config.service];
  return !prompt || prompt === defaultOption.user_role;
}

function supportsBatchTranslation(): boolean {
  const service = config.service;
  return service.startsWith('custom_')
    || BATCH_TRANSLATION_SERVICES.has(service);
}

export function canUseBatchTranslationForCurrentConfig(allowBatch: boolean | undefined = true): boolean {
  return Boolean(allowBatch)
    && servicesType.isAI(config.service)
    && supportsBatchTranslation()
    && isDefaultPromptForBatch();
}

function shouldUseBatchTranslation(
  allowBatch: boolean | undefined,
  safeOrigin: string
): boolean {
  return canUseBatchTranslationForCurrentConfig(allowBatch)
    && safeOrigin.length <= DEFAULT_BATCH_TRANSLATION_OPTIONS.maxCharacters;
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
    allowBatch = false,
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

  const requestGeneration = cancellationGeneration;

  const executeSingleTranslation = (text: string): Promise<string> => enqueueTranslation(async () => {
    const translationTask = async (retryCount: number = 0): Promise<string> => {
      try {
        assertNotCancelled(requestGeneration);
        const response = await Promise.race([
          browser.runtime.sendMessage({
            context,
            origin: text,
            sourceLang: direction.sourceLang,
            targetLang: direction.targetLang,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(t('runtime.translationRequestTimeout'))), timeout)
          )
        ]);
        assertNotCancelled(requestGeneration);
        const result = normalizeRuntimeTranslationResult(response);

        return !result || result === text ? text : result;
      } catch (error) {
        if (isTranslationCancelledError(error)) {
          throw error;
        }

        if (retryCount < maxRetries) {
          if (isDev) {
            console.log(`[翻译API] 翻译失败，${retryCount + 1}/${maxRetries} 次重试，原因:`, error);
          }

          await new Promise(resolve => setTimeout(resolve, getRetryDelay(retryCount, retryDelay)));
          return translationTask(retryCount + 1);
        }

        throw error;
      }
    };

    return translationTask();
  });

  const executeBatchTranslation = (texts: string[]): Promise<string[]> => enqueueTranslation(async () => {
    assertNotCancelled(requestGeneration);
    const response = await Promise.race([
      browser.runtime.sendMessage({
        type: 'BATCH_TRANSLATION',
        origins: texts,
        context,
        sourceLang: direction.sourceLang,
        targetLang: direction.targetLang,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(t('runtime.translationRequestTimeout'))), timeout)
      )
    ]);
    assertNotCancelled(requestGeneration);

    if (!Array.isArray(response) || response.length !== texts.length || !response.every(item => typeof item === 'string' && item.trim().length > 0)) {
      throw new Error('Invalid batch translation response');
    }

    return response;
  });

  const translationPromise = shouldUseBatchTranslation(allowBatch, safeOrigin)
    ? enqueueBatchTranslation({
      key: buildBatchTranslationKey(context, direction.sourceLang, direction.targetLang),
      origin: safeOrigin,
      executeBatch: executeBatchTranslation,
      executeSingle: executeSingleTranslation
    })
    : executeSingleTranslation(safeOrigin);

  const cacheAwarePromise = translationPromise.then(result => {
    if (useCache && result && result !== safeOrigin) {
      cache.localSet(safeOrigin, result, direction.targetLang);
    }
    return result;
  });

  const trackedPromise = cacheAwarePromise.finally(() => {
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
  clearBatchTranslationQueue(new TranslationCancelledError());
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
  /** 是否允许普通网页批量翻译请求进入内部 batch 队列 */
  allowBatch?: boolean;
} 
