import type { TranslationPriority } from '@/entrypoints/utils/translateQueue';
import {
  cacheTranslationResult,
  cancelAllTranslations,
  isTranslationCancelledError,
  translateText,
} from '@/entrypoints/utils/translateApi';
import {
  applyEbookDisplayMode,
  collectEbookTranslationUnits,
  hasAllPlaceholders,
  insertEbookTranslation,
  isUnitVisible,
  type EbookTranslationUnit,
} from './unitizer';
import type { EbookDisplayMode } from './types';
import type { TranslationPromptContext } from '@/entrypoints/utils/translationPrompt';
import {
  createTranslationDiagnosticId,
  type TranslationDiagnosticContext,
} from '@/entrypoints/utils/translationDiagnostics';

export interface EbookTranslationStatus {
  total: number;
  completed: number;
  failed: number;
  running: boolean;
}

type Translate = (origin: string, context: TranslationPromptContext, options: {
  allowBatch: true;
  priority: TranslationPriority;
  useCache?: boolean;
  diagnostics?: TranslationDiagnosticContext;
}) => Promise<string>;

interface CoordinatorOptions {
  translate?: Translate;
  cacheTranslation?: (origin: string, result: string, context: TranslationPromptContext) => void;
  onStatus?: (status: EbookTranslationStatus) => void;
  captureLocation?: () => string | undefined;
  restoreLocation?: (cfi: string) => Promise<void> | void;
}

export type EbookRetranslationResult = 'success' | 'failed' | 'cancelled' | 'empty';

const EBOOK_CONTENT_STYLE = `
  .onlytranslate-ebook-translation { color: #3975d7 !important; margin-block: .35em .7em !important; }
  [data-onlytranslate-ebook-display="original"] [data-onlytranslate-ebook-translation] { display: none !important; }
  [data-onlytranslate-ebook-display="translation"] [data-onlytranslate-ebook-original="true"].onlytranslate-ebook-has-translation:not(td):not(th) { display: none !important; }
  [data-onlytranslate-ebook-display="translation"] td.onlytranslate-ebook-has-translation > [data-onlytranslate-ebook-original-content],
  [data-onlytranslate-ebook-display="translation"] th.onlytranslate-ebook-has-translation > [data-onlytranslate-ebook-original-content] { display: none !important; }
`;

export class EbookTranslationCoordinator {
  private generation = 0;
  private units: EbookTranslationUnit[] = [];
  private document?: Document;
  private context: TranslationPromptContext = { scene: 'ebook' };
  private status: EbookTranslationStatus = { total: 0, completed: 0, failed: 0, running: false };
  private pendingInsertions: Array<() => void> = [];
  private insertionTimer?: ReturnType<typeof setTimeout>;
  private readonly translate: Translate;
  private readonly cacheTranslation: (origin: string, result: string, context: TranslationPromptContext) => void;
  private diagnosticContext?: TranslationDiagnosticContext;

  constructor(private readonly options: CoordinatorOptions = {}) {
    this.translate = options.translate ?? translateText;
    this.cacheTranslation = options.cacheTranslation ?? cacheTranslationResult;
  }

  async start(document: Document, context: TranslationPromptContext, displayMode: EbookDisplayMode): Promise<void> {
    this.cancel();
    const generation = this.generation;
    this.document = document;
    this.context = context;
    this.diagnosticContext = {
      sessionId: createTranslationDiagnosticId('ebook'),
      scene: 'ebook',
      startedAt: Date.now(),
    };
    this.installStyles(document);
    applyEbookDisplayMode(document, displayMode);
    this.units = collectEbookTranslationUnits(document);
    this.status = { total: this.units.length, completed: 0, failed: 0, running: this.units.length > 0 };
    this.emitStatus();

    const ordered = [...this.units].sort((left, right) => Number(isUnitVisible(right)) - Number(isUnitVisible(left)));
    await Promise.allSettled(ordered.map(unit => this.translateUnit(unit, generation)));
    if (generation !== this.generation) return;
    await this.flushInsertions();
    this.status.running = false;
    this.emitStatus();
  }

  async retranslate(): Promise<EbookRetranslationResult> {
    if (!this.document || this.units.length === 0) return 'empty';
    const previousStatus = { ...this.status, running: false };
    this.cancel();
    const generation = this.generation;
    this.diagnosticContext = {
      sessionId: createTranslationDiagnosticId('ebook'),
      scene: 'ebook',
      startedAt: Date.now(),
    };
    const ordered = [...this.units].sort((left, right) => Number(isUnitVisible(right)) - Number(isUnitVisible(left)));
    this.status = { total: ordered.length, completed: 0, failed: 0, running: true };
    this.emitStatus();

    const settled = await Promise.allSettled(ordered.map(async unit => {
      try {
        const result = await this.requestTranslation(unit, false);
        if (generation === this.generation) {
          this.status.completed += 1;
          this.emitStatus();
        }
        return { unit, ...result };
      } catch (error) {
        if (generation === this.generation && !isTranslationCancelledError(error)) {
          this.status.failed += 1;
          this.emitStatus();
        }
        throw error;
      }
    }));

    if (generation !== this.generation) return 'cancelled';
    const rejected = settled.filter(result => result.status === 'rejected');
    if (rejected.length > 0) {
      this.status = previousStatus;
      this.emitStatus();
      return rejected.every(result => isTranslationCancelledError(result.reason)) ? 'cancelled' : 'failed';
    }

    const translations = settled
      .filter((result): result is PromiseFulfilledResult<{
        unit: EbookTranslationUnit;
        translated: string;
        cacheOrigin: string;
      }> => result.status === 'fulfilled')
      .map(result => result.value);
    const cfi = this.options.captureLocation?.();
    translations.forEach(({ unit, translated }) => insertEbookTranslation(unit, translated));
    translations.forEach(({ cacheOrigin, translated }) => this.cacheTranslation(cacheOrigin, translated, this.context));
    await this.waitForLayout();
    if (cfi) await this.options.restoreLocation?.(cfi);
    this.status = { total: ordered.length, completed: ordered.length, failed: 0, running: false };
    this.emitStatus();
    return 'success';
  }

  cancel(): void {
    this.generation += 1;
    cancelAllTranslations();
    if (this.insertionTimer) clearTimeout(this.insertionTimer);
    this.insertionTimer = undefined;
    this.pendingInsertions = [];
    if (this.status.running) {
      this.status.running = false;
      this.emitStatus();
    }
  }

  async retryFailed(): Promise<void> {
    const failed = this.units.filter(unit => unit.failed);
    if (failed.length === 0) return;
    const generation = this.generation;
    this.status.failed -= failed.length;
    this.status.running = true;
    this.emitStatus();
    await Promise.allSettled(failed.map(unit => this.translateUnit(unit, generation)));
    if (generation !== this.generation) return;
    await this.flushInsertions();
    this.status.running = false;
    this.emitStatus();
  }

  setDisplayMode(displayMode: EbookDisplayMode): void {
    if (this.document) applyEbookDisplayMode(this.document, displayMode);
  }

  private async translateUnit(unit: EbookTranslationUnit, generation: number): Promise<void> {
    try {
      const { translated } = await this.requestTranslation(unit, true);
      if (generation !== this.generation) return;
      this.queueInsertion(() => insertEbookTranslation(unit, translated));
      this.status.completed += 1;
      this.emitStatus();
    } catch (error) {
      if (generation !== this.generation || isTranslationCancelledError(error)) return;
      unit.failed = true;
      this.status.failed += 1;
      this.emitStatus();
    }
  }

  private async requestTranslation(
    unit: EbookTranslationUnit,
    useCache: boolean,
  ): Promise<{ translated: string; cacheOrigin: string }> {
    const priority: TranslationPriority = isUnitVisible(unit) ? 'high' : 'background';
    const translateOptions = {
      allowBatch: true as const,
      priority,
      diagnostics: this.diagnosticContext,
      ...(useCache ? {} : { useCache: false }),
    };
    let cacheOrigin = unit.sourceHtml || unit.sourceText;
    let translated = await this.translate(cacheOrigin, this.context, translateOptions);
    if (!hasAllPlaceholders(translated, unit.placeholders)) {
      cacheOrigin = unit.sourceText;
      translated = await this.translate(cacheOrigin, this.context, translateOptions);
    }
    return { translated, cacheOrigin };
  }

  private queueInsertion(insertion: () => void): void {
    this.pendingInsertions.push(insertion);
    if (this.insertionTimer) return;
    this.insertionTimer = setTimeout(() => {
      this.insertionTimer = undefined;
      void this.flushInsertions();
    }, 100);
  }

  private async flushInsertions(): Promise<void> {
    if (this.pendingInsertions.length === 0) return;
    const cfi = this.options.captureLocation?.();
    const insertions = this.pendingInsertions.splice(0);
    insertions.forEach(insert => insert());
    const sessionId = this.diagnosticContext?.sessionId;
    if (sessionId) {
      const extensionBrowser = (globalThis as typeof globalThis & {
        browser?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } }
      }).browser;
      void extensionBrowser?.runtime?.sendMessage?.({
        type: 'TRANSLATION_DIAGNOSTIC_VISIBLE',
        sessionId,
      })?.catch(() => undefined);
    }
    await this.waitForLayout();
    if (cfi) await this.options.restoreLocation?.(cfi);
  }

  private async waitForLayout(): Promise<void> {
    await new Promise<void>(resolve => {
      const schedule = this.document?.defaultView?.requestAnimationFrame;
      if (schedule) schedule(() => resolve());
      else setTimeout(resolve, 0);
    });
  }

  private installStyles(document: Document): void {
    if (document.getElementById('onlytranslate-ebook-style')) return;
    const style = document.createElement('style');
    style.id = 'onlytranslate-ebook-style';
    style.textContent = EBOOK_CONTENT_STYLE;
    document.head.append(style);
  }

  private emitStatus(): void {
    this.options.onStatus?.({ ...this.status });
  }
}
