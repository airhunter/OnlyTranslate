export interface TranslationServiceMessage {
    type?: string;
    origin: string;
    origins?: string[];
    context?: string;
    sourceLang?: string;
    targetLang?: string;
}

export type TranslationServiceResult = string | string[];

export type TranslationServiceFunction = (message: TranslationServiceMessage) => Promise<TranslationServiceResult>;
