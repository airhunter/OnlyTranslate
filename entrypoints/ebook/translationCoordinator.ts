import type { TranslationPriority } from '@/entrypoints/utils/translateQueue';
import {
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

export interface EbookTranslationStatus {
  total: number;
  completed: number;
  failed: number;
  running: boolean;
}

type Translate = (origin: string, context: string, options: {
  allowBatch: true;
  priority: TranslationPriority;
}) => Promise<string>;

interface CoordinatorOptions {
  translate?: Translate;
  onStatus?: (status: EbookTranslationStatus) => void;
  captureLocation?: () => string | undefined;
  restoreLocation?: (cfi: string) => Promise<void> | void;
}

const EBOOK_CONTENT_STYLE = `
  .onlytranslate-ebook-translation { color: #3975d7; margin-block: .35em .7em; }
  [data-onlytranslate-ebook-display="translation"] [data-onlytranslate-ebook-original="true"].onlytranslate-ebook-has-translation:not(td):not(th) { display: none !important; }
  [data-onlytranslate-ebook-display="translation"] td.onlytranslate-ebook-has-translation > [data-onlytranslate-ebook-original-content],
  [data-onlytranslate-ebook-display="translation"] th.onlytranslate-ebook-has-translation > [data-onlytranslate-ebook-original-content] { display: none !important; }
`;

export class EbookTranslationCoordinator {
  private generation = 0;
  private units: EbookTranslationUnit[] = [];
  private document?: Document;
  private context = '';
  private status: EbookTranslationStatus = { total: 0, completed: 0, failed: 0, running: false };
  private pendingInsertions: Array<() => void> = [];
  private insertionTimer?: ReturnType<typeof setTimeout>;
  private readonly translate: Translate;

  constructor(private readonly options: CoordinatorOptions = {}) {
    this.translate = options.translate ?? translateText;
  }

  async start(document: Document, context: string, display: number): Promise<void> {
    this.cancel();
    const generation = this.generation;
    this.document = document;
    this.context = context;
    this.installStyles(document);
    applyEbookDisplayMode(document, display);
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

  setDisplayMode(display: number): void {
    if (this.document) applyEbookDisplayMode(this.document, display);
  }

  private async translateUnit(unit: EbookTranslationUnit, generation: number): Promise<void> {
    const priority: TranslationPriority = isUnitVisible(unit) ? 'high' : 'background';
    try {
      let translated = await this.translate(unit.sourceHtml || unit.sourceText, this.context, { allowBatch: true, priority });
      if (!hasAllPlaceholders(translated, unit.placeholders)) {
        translated = await this.translate(unit.sourceText, this.context, { allowBatch: true, priority });
      }
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
    await new Promise<void>(resolve => {
      const schedule = this.document?.defaultView?.requestAnimationFrame;
      if (schedule) schedule(() => resolve());
      else setTimeout(resolve, 0);
    });
    if (cfi) await this.options.restoreLocation?.(cfi);
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
