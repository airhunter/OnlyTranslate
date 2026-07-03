interface TranslationServiceBaseMessage {
    context?: string;
    sourceLang?: string;
    targetLang?: string;
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

export type TranslationServiceMessage = SingleTranslationServiceMessage | BatchTranslationServiceMessage;

export type TranslationServiceResult = string | string[];

export type TranslationServiceFunction = (message: TranslationServiceMessage) => Promise<TranslationServiceResult>;

export function assertSingleTranslationMessage(
    message: TranslationServiceMessage
): asserts message is SingleTranslationServiceMessage {
    if (message.type === 'BATCH_TRANSLATION') {
        throw new Error('Batch translation is not supported by this service');
    }
}
