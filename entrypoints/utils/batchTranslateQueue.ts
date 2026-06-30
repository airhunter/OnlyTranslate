export interface BatchTranslationQueueOptions {
  batchDelay?: number;
  maxItems?: number;
  maxCharacters?: number;
}

export interface BatchTranslationRequest {
  key: string;
  origin: string;
  executeBatch: (origins: string[]) => Promise<string[]>;
  executeSingle: (origin: string) => Promise<string>;
}

interface PendingBatchItem extends BatchTranslationRequest {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}

interface BatchGroup {
  key: string;
  items: PendingBatchItem[];
  totalCharacters: number;
  timer: ReturnType<typeof setTimeout>;
  options: Required<BatchTranslationQueueOptions>;
}

export const DEFAULT_BATCH_TRANSLATION_OPTIONS: Required<BatchTranslationQueueOptions> = {
  batchDelay: 40,
  maxItems: 4,
  maxCharacters: 6000
};

const groups = new Map<string, BatchGroup>();
const isDev = process.env.NODE_ENV === 'development';
const PROTECTED_INLINE_TOKEN_PATTERN = /__ONLY_TRANSLATE_INLINE_\d+_[a-z0-9]+__/g;

function resolveOptions(options: BatchTranslationQueueOptions = {}): Required<BatchTranslationQueueOptions> {
  return {
    batchDelay: options.batchDelay ?? DEFAULT_BATCH_TRANSLATION_OPTIONS.batchDelay,
    maxItems: options.maxItems ?? DEFAULT_BATCH_TRANSLATION_OPTIONS.maxItems,
    maxCharacters: options.maxCharacters ?? DEFAULT_BATCH_TRANSLATION_OPTIONS.maxCharacters
  };
}

function extractProtectedInlineTokens(value: string): string[] {
  return value.match(PROTECTED_INLINE_TOKEN_PATTERN) ?? [];
}

function hasSameProtectedInlineTokens(origin: string, result: string): boolean {
  const originTokens = extractProtectedInlineTokens(origin);
  const resultTokens = extractProtectedInlineTokens(result);
  if (originTokens.length !== resultTokens.length) return false;

  const remaining = new Map<string, number>();
  originTokens.forEach(token => {
    remaining.set(token, (remaining.get(token) ?? 0) + 1);
  });

  for (const token of resultTokens) {
    const count = remaining.get(token);
    if (!count) return false;
    if (count === 1) {
      remaining.delete(token);
    } else {
      remaining.set(token, count - 1);
    }
  }

  return remaining.size === 0;
}

function validateBatchResults(results: string[], origins: string[]): boolean {
  return Array.isArray(results)
    && results.length === origins.length
    && results.every((result, index) => {
      return typeof result === 'string'
        && result.trim().length > 0
        && hasSameProtectedInlineTokens(origins[index], result);
    });
}

function isCancellationError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'TranslationCancelledError';
}

function createGroup(item: PendingBatchItem, options: Required<BatchTranslationQueueOptions>): BatchGroup {
  const group: BatchGroup = {
    key: item.key,
    items: [item],
    totalCharacters: item.origin.length,
    options,
    timer: setTimeout(() => flushGroup(item.key), options.batchDelay)
  };
  groups.set(item.key, group);
  return group;
}

function scheduleGroupFlush(group: BatchGroup): void {
  clearTimeout(group.timer);
  group.timer = setTimeout(() => flushGroup(group.key), group.options.batchDelay);
}

function canJoinGroup(group: BatchGroup, item: PendingBatchItem): boolean {
  if (item.origin.length > group.options.maxCharacters) return false;
  if (group.items.length >= group.options.maxItems) return false;
  return group.totalCharacters + item.origin.length <= group.options.maxCharacters;
}

async function runSingle(item: PendingBatchItem): Promise<void> {
  try {
    item.resolve(await item.executeSingle(item.origin));
  } catch (error) {
    item.reject(error);
  }
}

async function fallbackSingles(items: PendingBatchItem[]): Promise<void> {
  await Promise.all(items.map(item => runSingle(item)));
}

async function flushItems(items: PendingBatchItem[]): Promise<void> {
  if (items.length === 0) return;
  if (items.length === 1) {
    if (isDev) console.debug('[OnlyTranslate][batch-translation]', 'single', { items: 1 });
    await runSingle(items[0]);
    return;
  }

  try {
    if (isDev) {
      console.debug('[OnlyTranslate][batch-translation]', 'batch', {
        items: items.length,
        characters: items.reduce((total, item) => total + item.origin.length, 0)
      });
    }
    const origins = items.map(item => item.origin);
    const results = await items[0].executeBatch(origins);
    if (!validateBatchResults(results, origins)) {
      if (isDev) console.debug('[OnlyTranslate][batch-translation]', 'fallback-invalid-result', { items: items.length });
      await fallbackSingles(items);
      return;
    }
    results.forEach((result, index) => items[index].resolve(result));
  } catch (error) {
    if (isCancellationError(error)) {
      items.forEach(item => item.reject(error));
      return;
    }
    if (isDev) console.debug('[OnlyTranslate][batch-translation]', 'fallback-error', { items: items.length, error });
    await fallbackSingles(items);
  }
}

function flushGroup(key: string): void {
  const group = groups.get(key);
  if (!group) return;
  groups.delete(key);
  clearTimeout(group.timer);
  void flushItems(group.items);
}

export function enqueueBatchTranslation(
  request: BatchTranslationRequest,
  rawOptions?: BatchTranslationQueueOptions
): Promise<string> {
  const options = resolveOptions(rawOptions);

  if (request.origin.length > options.maxCharacters) {
    return request.executeSingle(request.origin);
  }

  return new Promise((resolve, reject) => {
    const item: PendingBatchItem = {
      ...request,
      resolve,
      reject
    };

    const group = groups.get(item.key);
    if (!group) {
      createGroup(item, options);
      return;
    }

    if (!canJoinGroup(group, item)) {
      flushGroup(group.key);
      createGroup(item, options);
      return;
    }

    group.items.push(item);
    group.totalCharacters += item.origin.length;

    if (group.items.length >= group.options.maxItems) {
      flushGroup(group.key);
      return;
    }

    scheduleGroupFlush(group);
  });
}

export function clearBatchTranslationQueue(reason: unknown = new Error('Batch translation cancelled')): void {
  const pendingGroups = Array.from(groups.values());
  groups.clear();

  pendingGroups.forEach(group => {
    clearTimeout(group.timer);
    group.items.forEach(item => item.reject(reason));
  });
}
