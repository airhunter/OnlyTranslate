const isDev = process.env.NODE_ENV === 'development';

export function debugLog(type: string, message: string, ...args: any[]): void {
    if (!isDev) return;

    const colors: { [key: string]: string } = {
        Twitter: 'color: #1DA1F2; font-weight: bold',
        GitHub: 'color: #6e5494; font-weight: bold',
        StackOverflow: 'color: #f48024; font-weight: bold',
        Reddit: 'color: #FF4500; font-weight: bold',
        Medium: 'color: #00ab6c; font-weight: bold',
        YouTube: 'color: #FF0000; font-weight: bold',
        Compat: 'color: #0366d6; font-weight: bold',
        Skip: 'color: #d73a49; font-weight: bold',
        Content: 'color: #28a745; font-weight: bold',
        Default: 'color: #24292e; font-weight: bold'
    };

    const color = colors[type] || colors.Default;
    const prefix = `%c[OnlyTranslate][${type}]`;

    if (['Content', 'Skip', 'YouTube', 'GitHub', 'Twitter'].includes(type) && args.length > 0) {
        console.groupCollapsed(prefix, color, message);
        args.forEach((arg, index) => {
            if (typeof arg === 'string') {
                console.log(`参数${index + 1}:`, arg.substring(0, 100) + (arg.length > 100 ? '...' : ''));
            } else {
                console.log(`参数${index + 1}:`, arg);
            }
        });
        console.groupEnd();
    } else {
        console.log(prefix, color, message, ...args);
    }
}

export function isSpecialContent(text: string): boolean {
    if (!text) return false;

    const trimmedText = text.trim();

    if (/^https?:\/\/\S+/i.test(trimmedText)) return true;
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedText)) return true;
    if (/^@\w+$/.test(trimmedText)) return true;
    if (/^u\/\w+$/.test(trimmedText)) return true;
    if (/^id@https?:\/\/(x\.com|twitter\.com)\/[\w-]+\/status\/\d+/.test(trimmedText)) return true;
    if (/^#\d+$/.test(trimmedText)) return true;
    if (/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+#\d+$/.test(trimmedText)) return true;
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/(blob|tree)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-\/]+$/.test(trimmedText)) return true;
    if (/^[a-f0-9]{7,40}$/.test(trimmedText)) return true;
    if (/^\.[a-zA-Z0-9_.-]+$/.test(trimmedText)) return true;
    if (/^[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+$/.test(trimmedText)) return true;
    if (/^[a-zA-Z0-9_]+\([^)]*\)/.test(trimmedText)) return true;
    if (/^import\s+|^from\s+|^require\(/.test(trimmedText)) return true;
    if (/^const\s+|^let\s+|^var\s+|^function\s+/.test(trimmedText)) return true;
    if (/^[a-f0-9]{8,}$/i.test(trimmedText)) return true;

    return false;
}

export function matchesOrClosest(node: Element, selector: string): boolean {
    try {
        return Boolean(node.matches?.(selector) || node.closest?.(selector));
    } catch (_) {
        return false;
    }
}
