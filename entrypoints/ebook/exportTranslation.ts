import { config } from '@/entrypoints/utils/config';
import { REQUEST_POLICY_VERSION } from '@/entrypoints/utils/modelCapabilities';
import { services } from '@/entrypoints/utils/option';
import { translateText, type TranslateOptions } from '@/entrypoints/utils/translateApi';
import { TRANSLATION_PROMPT_POLICY_VERSION, type TranslationPromptContextInput } from '@/entrypoints/utils/translationPrompt';

const GOOGLE_EXPORT_INTERVAL_MS = 1500;

export class ExportRateLimitError extends Error {
  constructor(cause: unknown) {
    super('Google translation rate limited the export', { cause });
    this.name = 'ExportRateLimitError';
  }
}

export class ExportSettingsChangedError extends Error {
  constructor() {
    super('Translation settings changed during the export');
    this.name = 'ExportSettingsChangedError';
  }
}

function settingsSource(): string {
  const service = config.service;
  const provider = config.customProviders?.find(item => item.id === service);
  return JSON.stringify({
    policy: [REQUEST_POLICY_VERSION, TRANSLATION_PROMPT_POLICY_VERSION],
    service,
    from: config.from,
    to: config.to,
    style: config.style,
    bidirectionalTranslation: config.bidirectionalTranslation,
    bidirectionalTarget: config.bidirectionalTarget,
    model: config.model?.[service],
    customModel: config.customModel?.[service],
    systemRole: config.system_role?.[service],
    userRole: config.user_role?.[service],
    thinking: config.thinking?.[service],
    robotId: config.robot_id?.[service],
    proxy: config.proxy?.[service],
    provider: provider && {
      id: provider.id, protocol: provider.protocol, url: provider.url,
      model: provider.model, customModel: provider.customModel,
    },
    custom: config.custom,
    deeplx: config.deeplx,
    newApiUrl: config.newApiUrl,
    azureOpenaiEndpoint: config.azureOpenaiEndpoint,
  });
}

export async function hashExportSource(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createExportFingerprint(format: 'epub' | 'pdf'): Promise<string> {
  return hashExportSource(JSON.stringify([format, 'bilingual-export-v2', settingsSource()]));
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

function waitForDelay(delay: number, signal?: AbortSignal): Promise<void> {
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Export cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Export cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Export cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
  });
}

export function createExportTranslator(
  signal?: AbortSignal,
  translate: typeof translateText = translateText,
  intervalMs = GOOGLE_EXPORT_INTERVAL_MS,
): (source: string, context: TranslationPromptContextInput, options: TranslateOptions) => Promise<string> {
  const initialSettings = settingsSource();
  const google = config.service === services.google;
  let previous: Promise<void> = Promise.resolve();
  let nextRequestAt = 0;
  let rateLimitError: ExportRateLimitError | undefined;

  return async (source, context, options) => {
    assertActive(signal);
    if (settingsSource() !== initialSettings) throw new ExportSettingsChangedError();
    if (!google) {
      return withAbortSignal(translate(source, context, { ...options, priority: 'background' }), signal);
    }

    const before = previous;
    let release!: () => void;
    previous = new Promise<void>(resolve => { release = resolve; });
    try {
      await withAbortSignal(before, signal);
      assertActive(signal);
      if (rateLimitError) throw rateLimitError;
      if (settingsSource() !== initialSettings) throw new ExportSettingsChangedError();
      await waitForDelay(nextRequestAt - Date.now(), signal);
      assertActive(signal);
      if (settingsSource() !== initialSettings) throw new ExportSettingsChangedError();
      nextRequestAt = Date.now() + intervalMs;
      return await translate(source, context, {
        ...options,
        allowBatch: false,
        priority: 'background',
        maxRetries: 0,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && /\b([45]\d{2})\b/.exec(error.message)?.[1] === '429') {
        rateLimitError = new ExportRateLimitError(error);
        throw rateLimitError;
      }
      throw error;
    } finally {
      release();
    }
  };
}
