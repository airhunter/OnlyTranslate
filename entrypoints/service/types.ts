export interface TranslationServiceMessage {
    origin: string;
    context?: string;
    sourceLang?: string;
    targetLang?: string;
}

export type TranslationServiceResult = string;

export type TranslationServiceFunction = (message: TranslationServiceMessage) => Promise<TranslationServiceResult>;
