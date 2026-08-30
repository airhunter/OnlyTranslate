import type { TranslationPriority } from '@/entrypoints/utils/translateQueue'
import {
  cancelAllTranslations,
  isTranslationCancelledError,
  translateText,
} from '@/entrypoints/utils/translateApi'
import {
  createTranslationDiagnosticId,
  type TranslationDiagnosticContext,
} from '@/entrypoints/utils/translationDiagnostics'
import type { PdfTextBlock } from './layout'

interface PdfTranslationUnit extends PdfTextBlock {
  translationSource?: string
}

export interface PdfTranslationStatus {
  total: number
  completed: number
  failed: number
  running: boolean
}

type Translate = (origin: string, context: string, options: {
  allowBatch: true
  priority: TranslationPriority
  diagnostics?: TranslationDiagnosticContext
}) => Promise<string>

interface PdfTranslationCoordinatorOptions {
  translate?: Translate
  onTranslation?: (blockId: string, translation: string) => void
  onStatus?: (status: PdfTranslationStatus) => void
}

const ACADEMIC_ACRONYM = /\b[A-Z]{2,}[A-Z0-9]*s?\b/g

function protectAcademicAcronyms(source: string): { source: string, restore: (translation: string) => string } {
  const terms: string[] = []
  const protectedSource = source.replace(ACADEMIC_ACRONYM, term => {
    const token = `{{PDFTERM${terms.length}}}`
    terms.push(term)
    return token
  })
  return {
    source: protectedSource,
    restore: translation => terms.reduce(
      (restored, term, index) => restored.replaceAll(`{{PDFTERM${index}}}`, term),
      translation,
    ),
  }
}

function normalizeHeadingTranslation(block: PdfTextBlock, translation: string): string {
  if (block.kind === 'heading' && /^abstract$/i.test(block.text.trim()) && /^抽象的?$/u.test(translation.trim())) {
    return '摘要'
  }
  return translation
}

export class PdfTranslationCoordinator {
  private generation = 0
  private readonly translate: Translate
  private status: PdfTranslationStatus = { total: 0, completed: 0, failed: 0, running: false }

  constructor(private readonly options: PdfTranslationCoordinatorOptions = {}) {
    this.translate = options.translate ?? translateText
  }

  async start(blocks: PdfTranslationUnit[], context: string, pageUrl?: string): Promise<void> {
    this.cancel()
    const generation = this.generation
    const units = blocks.filter(block => block.translatable)
    const diagnostics: TranslationDiagnosticContext = {
      sessionId: createTranslationDiagnosticId('pdf'),
      scene: 'pdf',
      startedAt: Date.now(),
      pageUrl,
    }
    this.status = { total: units.length, completed: 0, failed: 0, running: units.length > 0 }
    this.emitStatus()

    await Promise.allSettled(units.map(async block => {
      try {
        const protectedText = protectAcademicAcronyms(block.translationSource ?? block.text)
        const translated = await this.translate(protectedText.source, context, {
          allowBatch: true,
          priority: 'high',
          diagnostics,
        })
        if (generation !== this.generation) return
        const translation = normalizeHeadingTranslation(block, protectedText.restore(translated))
        this.options.onTranslation?.(block.id, translation)
        this.status.completed += 1
        this.emitStatus()
      }
      catch (error) {
        if (generation !== this.generation || isTranslationCancelledError(error)) return
        this.status.failed += 1
        this.emitStatus()
      }
    }))

    if (generation !== this.generation) return
    this.status.running = false
    this.emitStatus()
  }

  cancel(): void {
    this.generation += 1
    cancelAllTranslations()
    if (!this.status.running) return
    this.status.running = false
    this.emitStatus()
  }

  private emitStatus(): void {
    this.options.onStatus?.({ ...this.status })
  }
}
