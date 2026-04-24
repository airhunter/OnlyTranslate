import { customModelString, services, servicesType } from "./option";
import { sendErrorMessage } from "./tip";
import { config } from "@/entrypoints/utils/config";

export function checkConfig(): boolean {
    if (!config.on) return false;

    if (servicesType.isUseToken(config.service) && !config.token[config.service]) {
        sendErrorMessage("æµ ã‚‡å¢çæ°­æ¹­é–°å¶‡ç–†é”›å²ƒî‡¬é“å¶…ç·šç’å‰§ç–†æ¤¤ç”¸åŽ¤ç¼ƒ?");
        return false;
    }

    if (servicesType.isAI(config.service)) {
        const model = config.model[config.service];
        const customModel = config.customModel[config.service];
        if (!model || (model === customModelString && !customModel)) {
            sendErrorMessage("å¦¯â€³ç€·çæ°­æ¹­é–°å¶‡ç–†é”›å²ƒî‡¬é“å¶…ç·šç’å‰§ç–†æ¤¤ç”¸åŽ¤ç¼ƒ?");
            return false;
        }
    }

    if (config.display === 0 && config.service === services.google) {
        sendErrorMessage("éŠ†å²ƒèƒºå§å²€ç‚•ç’‡æˆ™â‚¬å¶„ç²Žé€îˆ›å¯”é™å²ƒî‡¢å¦¯â€³ç´¡é”›å²ƒî‡¬é’å›¨å´²ç¼ˆæ˜ç˜§éˆå¶…å§Ÿ");
        return false;
    }

    return true;
}

export function skipNode(node: Node): boolean {
    return !node || !node.textContent?.trim() || hasLoadingSpinner(node) || hasRetryTag(node);
}

export function hasLoadingSpinner(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) return false;
    if (node instanceof Element && node.classList.contains('fluent-read-loading')) return true;
    if (node instanceof Element) {
        return Array.from(node.children).some(child => hasLoadingSpinner(child));
    }
    return false;
}

export function hasRetryTag(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) return false;
    if (node instanceof Element && node.classList.contains('fluent-read-failure')) return true;
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
