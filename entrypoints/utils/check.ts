import { customModelString, isServiceConfigured, services, servicesType } from "./option";
import { sendErrorMessage } from "./tip";
import { config } from "@/entrypoints/utils/config";
import { t } from "@/entrypoints/utils/i18n";

export function checkConfig(): boolean {
    if (!config.on) return false;

    if (!isServiceConfigured(config.service, config)) {
        sendErrorMessage(t("runtime.serviceNotConfigured"));
        return false;
    }

    if (servicesType.isAI(config.service)) {
        const { model, customModel } = getConfiguredModel();
        if (!model || (model === customModelString && !customModel)) {
            sendErrorMessage(t("runtime.modelNotConfigured"));
            return false;
        }
    }

    if (config.display === 0 && config.service === services.google) {
        sendErrorMessage(t("runtime.googleTranslationOnlyUnsupported"));
        return false;
    }

    return true;
}

function getConfiguredModel() {
    let model = config.model[config.service];
    let customModel = config.customModel[config.service];

    if (servicesType.isCustom(config.service)) {
        const provider = config.customProviders?.find(p => p.id === config.service);
        if (provider) {
            model = provider.model;
            customModel = provider.customModel;
        }
    }

    return { model, customModel };
}

export function skipNode(node: Node): boolean {
    return !node || !node.textContent?.trim() || hasLoadingSpinner(node) || hasRetryTag(node);
}

export function hasLoadingSpinner(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) return false;
    if (node instanceof Element && node.classList.contains('only-translate-loading')) return true;
    if (node instanceof Element) {
        return Array.from(node.children).some(child => hasLoadingSpinner(child));
    }
    return false;
}

export function hasRetryTag(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) return false;
    if (node instanceof Element && node.classList.contains('only-translate-failure')) return true;
    if (node instanceof Element) {
        return Array.from(node.children).some(child => hasRetryTag(child));
    }
    return false;
}

export function searchClassName(node: Node, className: string): Node | null {
    if (node instanceof Element && node.classList.contains(className)) return node;
    if (node instanceof Element) {
        for (const child of node.children) {
            const result = searchClassName(child, className);
            if (result) return result;
        }
    }
    return null;
}

function normalizeContentValue(value: any): string {
    if (typeof value === 'string') return value;
    if (value == null) return '';

    if (Array.isArray(value)) {
        return value.map(item => normalizeContentValue(item)).join('');
    }

    if (typeof value === 'object') {
        for (const key of ['text', 'content', 'translation', 'translatedText', 'output', 'response']) {
            if (key in value) {
                return normalizeContentValue(value[key]);
            }
        }
        return JSON.stringify(value);
    }

    return String(value);
}

export function contentPostHandler(text: any) {
    let content = normalizeContentValue(text);
    content = content.replace(/^<think>[\s\S]*?<\/think>/, "");
    return content;
}
