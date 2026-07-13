import type { SubtitleTranslationJob, SubtitleTranslationResult } from '@/entrypoints/video/types'

interface TranslationServiceBaseMessage {
    context?: string;
    sourceLang?: string;
    targetLang?: string;
    /** 实时字幕等低延迟场景使用：服务适配器应关闭或压低模型推理。 */
    fastMode?: boolean;
}

export interface SingleTranslationServiceMessage extends TranslationServiceBaseMessage {
    type?: string;
    origin: string;
    origins?: never;
}

export interface BatchTranslationServiceMessage extends TranslationServiceBaseMessage {
    type: 'BATCH_TRANSLATION';
    origins: string[];
    origin?: never;
}

export interface SubtitleBatchTranslationServiceMessage extends TranslationServiceBaseMessage {
    type: 'SUBTITLE_BATCH_TRANSLATION';
    job: SubtitleTranslationJob;
    origin?: never;
    origins?: never;
}

export type TranslationServiceMessage =
    | SingleTranslationServiceMessage
    | BatchTranslationServiceMessage
    | SubtitleBatchTranslationServiceMessage;

export type TranslationServiceResult = string | string[] | SubtitleTranslationResult[];

export type TranslationServiceFunction = (message: TranslationServiceMessage) => Promise<TranslationServiceResult>;

export function assertSingleTranslationMessage(
    message: TranslationServiceMessage
): asserts message is SingleTranslationServiceMessage {
    if (message.type === 'BATCH_TRANSLATION' || message.type === 'SUBTITLE_BATCH_TRANSLATION') {
        throw new Error('Batch translation is not supported by this service');
    }
}
