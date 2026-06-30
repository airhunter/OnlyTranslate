import type { TranslationServiceMessage } from './types';

function isDevelopmentRuntime(): boolean {
    return process.env.NODE_ENV === 'development';
}

export function logBatchTranslationRequest(service: string, origins: string[]): void {
    if (!isDevelopmentRuntime()) return;
    console.info('[OnlyTranslate][batch-translation]', 'request', {
        service,
        items: origins.length,
        characters: origins.reduce((total, origin) => total + origin.length, 0)
    });
}

function stripJsonFence(content: string): string {
    const trimmed = content.trim();
    const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseJson(value: string): unknown {
    return JSON.parse(value);
}

function tryParseJson(value: string): unknown | undefined {
    try {
        return parseJson(value);
    } catch {
        return undefined;
    }
}

function extractJsonArrayText(content: string): string | undefined {
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return undefined;
    return content.slice(start, end + 1);
}

function extractStringArray(parsed: unknown): unknown {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== 'object') return parsed;

    const record = parsed as Record<string, unknown>;
    for (const key of ['translations', 'results', 'items']) {
        if (Array.isArray(record[key])) return record[key];
    }

    return parsed;
}

export function parseBatchTranslationContent(content: string, expectedCount: number): string[] {
    let parsed: unknown;
    const stripped = stripJsonFence(content);
    const extractedArray = extractJsonArrayText(stripped);

    parsed = tryParseJson(stripped);
    if (parsed === undefined && extractedArray) {
        parsed = tryParseJson(extractedArray);
    }

    if (parsed === undefined) {
        throw new Error('Batch translation response is not valid JSON');
    }

    const translations = extractStringArray(parsed);

    if (!Array.isArray(translations) || !translations.every(item => typeof item === 'string')) {
        throw new Error('Batch translation response must be a JSON string array');
    }

    if (translations.length !== expectedCount) {
        throw new Error('Batch translation result count mismatch');
    }

    return translations;
}

export function isBatchTranslationMessage(message: TranslationServiceMessage): message is TranslationServiceMessage & { origins: string[] } {
    return message.type === 'BATCH_TRANSLATION'
        && Array.isArray(message.origins)
        && message.origins.length > 0
        && message.origins.every(origin => typeof origin === 'string' && origin.trim().length > 0);
}
