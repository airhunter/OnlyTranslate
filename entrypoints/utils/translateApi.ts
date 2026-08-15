/**
 * 翻译API代理模块
 * 整合翻译队列管理，作为翻译函数和后台翻译服务之间的中间层
 */

import {
  enqueueTranslation,
  clearTranslationQueue,
  hasForegroundTranslationWork,
  type TranslationPriority
} from './translateQueue';
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
import { customModelString, defaultOption, isServiceConfigured, services, servicesType } from './option';
import { getCustomProviderProtocol } from './providerEndpoint';
import {
  createDiagnosticMetadata,
  createTranslationDiagnosticId,
  type TranslationDiagnosticContext,
} from './translationDiagnostics';
import {
  buildSelectionAnalysisPrompt,
  parseSelectionAnalysisResponse,
  type SelectionAnalysisResult,
} from './selectionAnalysis';

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

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /extension context invalidated|receiving end does not exist/i.test(message);
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

function assertSignalNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new TranslationCancelledError();
  }
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new TranslationCancelledError());

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(new TranslationCancelledError());
    signal.addEventListener('abort', handleAbort, { once: true });

    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', handleAbort);
    });
  });
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  if (signal.aborted) {
    return Promise.reject(new TranslationCancelledError());
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delay);
    const handleAbort = () => {
      clearTimeout(timer);
      reject(new TranslationCancelledError());
    };
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function withRequestTimeout<T>(promise: Promise<T>, timeout: number, signal?: AbortSignal): Promise<T> {
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(
      () => reject(new Error(t('runtime.translationRequestTimeout'))),
      timeout
    );
  });

  return withAbortSignal(Promise.race([promise, timeoutPromise]), signal)
    .finally(() => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    });
}

function getRetryDelay(retryCount: number, baseDelay: number): number {
  return Math.min(baseDelay * (2 ** retryCount), MAX_RETRY_DELAY);
}

function getTranslationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

function getTranslationErrorStatus(error: unknown): number | undefined {
  const match = /\b([45]\d{2})\b/.exec(getTranslationErrorMessage(error));
  if (!match) return undefined;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : undefined;
}

export function isRetryableTranslationError(error: unknown): boolean {
  const status = getTranslationErrorStatus(error);
  if (status !== undefined) {
    return status === 408
      || status === 409
      || status === 425
      || status === 429
      || status >= 500;
  }

  const message = getTranslationErrorMessage(error).toLowerCase();
  return /(?:timeout|timed out|network|failed to fetch|load failed|connection|econn|socket|temporarily unavailable|超时|网络|连接|暂时不可用)/.test(message);
}

function canRetryTranslationError(error: unknown, retryCount: number, maxRetries: number): boolean {
  if (!isRetryableTranslationError(error)) return false;
  const message = getTranslationErrorMessage(error).toLowerCase();
  const effectiveMaxRetries = /(?:timeout|timed out|超时)/.test(message)
    ? Math.min(maxRetries, 1)
    : maxRetries;
  return retryCount < effectiveMaxRetries;
}

function buildInFlightTranslationKey(
  origin: string,
  context: string,
  sourceLang: string,
  targetLang: string,
  fastMode: boolean,
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
    fastMode,
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

function buildBatchTranslationKey(context: string, sourceLang: string, targetLang: string, fastMode: boolean): string {
  const service = config.service;
  return JSON.stringify([
    service,
    resolveCurrentModel(),
    config.customModel?.[service] ?? '',
    config.style ?? '',
    sourceLang,
    targetLang,
    fastMode,
    context
  ]);
}

function isDefaultPromptForBatch(): boolean {
  const userPrompt = config.user_role?.[config.service];
  const systemPrompt = config.system_role?.[config.service];
  return (!userPrompt || userPrompt === defaultOption.user_role)
    && (!systemPrompt || systemPrompt === defaultOption.system_role);
}

function supportsBatchTranslation(): boolean {
  const service = config.service;
  if (service.startsWith('custom_')) {
    const provider = config.customProviders?.find(item => item.id === service);
    return getCustomProviderProtocol(provider) === 'openai';
  }
  return BATCH_TRANSLATION_SERVICES.has(service);
}

export function canUseBatchTranslationForCurrentConfig(allowBatch: boolean | undefined = true): boolean {
  return Boolean(allowBatch)
    && servicesType.isAI(config.service)
    && supportsBatchTranslation()
    && isDefaultPromptForBatch();
}

export { hasForegroundTranslationWork };

export interface AnalyzeSelectionInput {
  text: string;
  surroundingContext?: string;
  pageTitle?: string;
}

export interface AnalyzeSelectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  priority?: TranslationPriority;
  signal?: AbortSignal;
}

export async function analyzeSelectionText(
  input: AnalyzeSelectionInput,
  options: AnalyzeSelectionOptions = {},
): Promise<SelectionAnalysisResult> {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) throw new Error('Selection analysis input is empty');
  if (!servicesType.isAI(config.service) || !isServiceConfigured(config.service, config)) {
    throw new Error(t('selection.analysisRequiresAi'));
  }

  const {
    maxRetries = 1,
    retryDelay = 1000,
    timeout = 60000,
    priority = 'high',
    signal,
  } = options;
  assertSignalNotAborted(signal);

  const { kind, prompt } = buildSelectionAnalysisPrompt({
    text,
    context: input.surroundingContext,
    pageTitle: input.pageTitle,
    targetLanguage: config.to,
  });
  const requestGeneration = cancellationGeneration;

  return enqueueTranslation(async () => {
    const run = async (retryCount = 0): Promise<SelectionAnalysisResult> => {
      try {
        assertSignalNotAborted(signal);
        assertNotCancelled(requestGeneration);
        const response = await withRequestTimeout(
          browser.runtime.sendMessage({
            type: 'SELECTION_ANALYSIS',
            origin: text,
            context: input.pageTitle || '',
            sourceLang: 'auto',
            targetLang: config.to,
            prompt,
          }),
          timeout,
          signal,
        );
        assertSignalNotAborted(signal);
        assertNotCancelled(requestGeneration);
        const content = normalizeRuntimeTranslationResult(response).trim();
        if (!content) throw new Error(t('runtime.upstreamNoContent'));
        return parseSelectionAnalysisResponse(content, kind);
      } catch (error) {
        if (isTranslationCancelledError(error)) throw error;
        if (canRetryTranslationError(error, retryCount, maxRetries)) {
          await waitForRetry(getRetryDelay(retryCount, retryDelay), signal);
          return run(retryCount + 1);
        }
        throw error;
      }
    };

    return run();
  }, { priority });
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
    priority = 'normal',
    fastMode = false,
    signal,
  } = options;

  assertSignalNotAborted(signal);

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

  const diagnosticContext: TranslationDiagnosticContext = {
    ...options.diagnostics,
    sessionId: options.diagnostics?.sessionId ?? createTranslationDiagnosticId(),
    startedAt: options.diagnostics?.startedAt ?? Date.now(),
  };

  const inFlightKey = buildInFlightTranslationKey(
    safeOrigin,
    context,
    direction.sourceLang,
    direction.targetLang,
    fastMode,
  );
  // 带独立取消信号的调用不共享进行中的 Promise，避免一个调用者取消时
  // 连带影响整页翻译或其他调用者。
  const shouldTrackInFlight = !signal;
  const inFlight = shouldTrackInFlight ? inFlightTranslations.get(inFlightKey) : undefined;
  if (inFlight) return inFlight;

  // 检查缓存
  if (useCache) {
    const cachedResult = cache.localGet(safeOrigin, direction.targetLang);
    if (cachedResult) {
      if (isDev) {
        console.log('[翻译API] 命中缓存，直接返回缓存结果');
      }
      void browser.runtime.sendMessage({
        type: 'TRANSLATION_DIAGNOSTIC_CACHE_HIT',
        context: diagnosticContext,
        characters: safeOrigin.length,
      }).catch(() => undefined);
      return cachedResult;
    }
  }

  // 增加翻译计数
  config.count++;
  // 保存配置以确保计数持久化
  storage.setItem('local:config', JSON.stringify(config));

  const requestGeneration = cancellationGeneration;

  const executeSingleTranslation = (text: string): Promise<string> => {
    const queuedAt = Date.now();
    return enqueueTranslation(async () => {
    const translationTask = async (retryCount: number = 0): Promise<string> => {
      try {
        assertSignalNotAborted(signal);
        assertNotCancelled(requestGeneration);
        const response = await withRequestTimeout(
          browser.runtime.sendMessage({
            context,
            origin: text,
            sourceLang: direction.sourceLang,
            targetLang: direction.targetLang,
            ...(fastMode ? { fastMode: true } : {}),
            diagnostics: createDiagnosticMetadata(diagnosticContext, retryCount, queuedAt),
          }),
          timeout,
          signal
        );
        assertSignalNotAborted(signal);
        assertNotCancelled(requestGeneration);
        const result = normalizeRuntimeTranslationResult(response);

        return !result || result === text ? text : result;
      } catch (error) {
        if (isTranslationCancelledError(error)) {
          throw error;
        }

        if (canRetryTranslationError(error, retryCount, maxRetries)) {
          if (isDev) {
            console.log(`[翻译API] 翻译失败，${retryCount + 1}/${maxRetries} 次重试，原因:`, error);
          }

          await waitForRetry(getRetryDelay(retryCount, retryDelay), signal);
          return translationTask(retryCount + 1);
        }

        throw error;
      }
    };

    return translationTask();
    }, { priority });
  };

  const executeBatchTranslation = (texts: string[]): Promise<string[]> => {
    const queuedAt = Date.now();
    return enqueueTranslation(async () => {
    assertSignalNotAborted(signal);
    assertNotCancelled(requestGeneration);
    const response = await withRequestTimeout(
      browser.runtime.sendMessage({
        type: 'BATCH_TRANSLATION',
        origins: texts,
        context,
        sourceLang: direction.sourceLang,
        targetLang: direction.targetLang,
        ...(fastMode ? { fastMode: true } : {}),
        diagnostics: createDiagnosticMetadata(diagnosticContext, 0, queuedAt),
      }),
      timeout,
      signal
    );
    assertSignalNotAborted(signal);
    assertNotCancelled(requestGeneration);

    if (!Array.isArray(response) || response.length !== texts.length || !response.every(item => typeof item === 'string' && item.trim().length > 0)) {
      throw new Error('Invalid batch translation response');
    }

    return response;
    }, { priority });
  };

  // 可独立取消的交互请求不进入延迟批处理，确保取消后不会留下待发送的批次。
  const translationPromise = !signal && shouldUseBatchTranslation(allowBatch, safeOrigin)
    ? enqueueBatchTranslation({
      key: buildBatchTranslationKey(context, direction.sourceLang, direction.targetLang, fastMode),
      origin: safeOrigin,
      executeBatch: executeBatchTranslation,
      executeSingle: executeSingleTranslation,
      priority
    })
    : executeSingleTranslation(safeOrigin);

  const cacheAwarePromise = translationPromise.then(result => {
    if (useCache && result && result !== safeOrigin) {
      cache.localSet(safeOrigin, result, direction.targetLang);
    }
    return result;
  });

  if (!shouldTrackInFlight) {
    return withAbortSignal(cacheAwarePromise, signal);
  }

  const trackedPromise = cacheAwarePromise.finally(() => {
    if (inFlightTranslations.get(inFlightKey) === trackedPromise) {
      inFlightTranslations.delete(inFlightKey);
    }
  });
  inFlightTranslations.set(inFlightKey, trackedPromise);

  return trackedPromise;
}

export function cacheTranslationResult(origin: string, result: string): void {
  const safeOrigin = typeof origin === 'string' ? origin : String(origin ?? '');
  if (!config.useCache || !safeOrigin.trim() || !result || result === safeOrigin) return;
  const direction = resolveTranslationDirection(safeOrigin);
  if (!direction.shouldTranslate) return;
  cache.localSet(safeOrigin, result, direction.targetLang);
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
  /** 翻译请求优先级：可视区为 high，后台预热为 background */
  priority?: TranslationPriority;
  /** 低延迟翻译模式：服务适配器应关闭或压低 Thinking/Reasoning */
  fastMode?: boolean;
  /** 仅取消当前调用者的等待、重试和结果回写，不影响其他翻译任务。 */
  signal?: AbortSignal;
  /** 本地性能诊断的会话信息；不会记录原文、译文、密钥或接口地址。 */
  diagnostics?: TranslationDiagnosticContext;
} 
