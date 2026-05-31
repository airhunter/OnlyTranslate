import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner } from "../utils/icon";
import { styles } from "@/entrypoints/utils/constant";
import {
    beautyHTML,
    getTranslatableHTML,
    getTranslatableText,
    getTranslatableTextWithProtectedInline,
    grabNode,
    renderTextWithProtectedInline,
    type GrabAllNodeOptions,
    LLMStandardHTML,
    smashTruncationStyle
} from "@/entrypoints/main/dom";
import { throttle } from "@/entrypoints/utils/common";
import { afterBilingualAppendCompatFn, replaceCompatFn } from "@/entrypoints/main/compat";
import { getMainDomain } from "@/entrypoints/utils/domain";
import { config } from "@/entrypoints/utils/config";
import { isTranslationCancelledError, translateText, cancelAllTranslations } from '@/entrypoints/utils/translateApi';
import { shouldTranslateText } from "@/entrypoints/utils/translationDirection";
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect';
import { invalidateScanCache } from '@/entrypoints/main/translationTarget/scanContext';
import {
    collectDynamicTranslationNodes as collectDynamicTargetNodes,
    getDynamicTranslationScanRoot,
    isInTranslationScope as isDynamicInTranslationScope
} from '@/entrypoints/main/translationTarget/dynamic';
import { getBilingualAppendTarget as getTranslationTargetAppendTarget } from '@/entrypoints/main/translationTarget/decision';
import {
    BILINGUAL_CONTENT_CLASS,
    BILINGUAL_WRAPPER_CLASS,
    TRANSLATED_ATTR,
    TRANSLATED_ID_ATTR
} from '@/entrypoints/main/translationTarget/constants';

const DYNAMIC_MUTATION_ATTRIBUTES = ['class', 'style', 'hidden', 'aria-hidden', 'aria-expanded'];

const translationState = {
    hoverTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    htmlSet: new Set<string>(),
    originalContents: new Map<string, string>(),
    isAutoTranslating: false,
    observer: null as IntersectionObserver | null,
    mutationObserver: null as MutationObserver | null,
    nodeIdCounter: 0
};

export const originalContents = translationState.originalContents;

function setAutoTranslating(value: boolean): void {
    translationState.isAutoTranslating = value;
}

function clearHoverTimer(): void {
    if (translationState.hoverTimer !== undefined) {
        clearTimeout(translationState.hoverTimer);
        translationState.hoverTimer = undefined;
    }
}

interface AutoTranslateTarget {
    contentRoot: Element;
    nodes: Element[];
    grabOptions?: GrabAllNodeOptions;
}

function isManagedTranslationNode(node: Node): boolean {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`));
}

export function collectDynamicTranslationNodes(
    root: Element,
    contentRoot: Element,
    scope: string,
    grabOptions: GrabAllNodeOptions = {}
): Element[] {
    return collectDynamicTargetNodes(root, contentRoot, scope, grabOptions);
}

export function resolveAutoTranslateTarget(scope: string): AutoTranslateTarget {
    return resolveAutoTranslationTarget(scope);
}

function translateFirstLineText(textNode: Text, origin: string): void {
    translateText(origin, document.title)
        .then((text: string) => {
            textNode.textContent = text;
        })
        .catch((error: Error) => {
            if (isTranslationCancelledError(error)) return;
            console.error('翻译失败:', error);
        });
}

function shouldBeautifyTranslatedHTML(origin: string, translated: string): boolean {
    return /<[^>]+>/.test(origin) || /<[^>]+>/.test(translated);
}

// 恢复原文内容
export function restoreOriginalContent() {
    // 取消所有等待中的翻译任务
    cancelAllTranslations();
    
    // 1. 遍历所有已翻译的节点
    document.querySelectorAll(`[${TRANSLATED_ATTR}="true"]`).forEach(node => {
        const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
        if (nodeId && originalContents.has(nodeId)) {
            const originalContent = originalContents.get(nodeId);
            if (originalContent === undefined) return;
            node.innerHTML = originalContent;
            node.removeAttribute(TRANSLATED_ATTR);
            node.removeAttribute(TRANSLATED_ID_ATTR);
            
            // 移除可能添加的翻译相关类
            node.classList.remove(BILINGUAL_WRAPPER_CLASS);
        }
    });
    
    // 2. 移除所有翻译内容元素
    document.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}`).forEach(element => {
        element.remove();
    });
    
    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    document.querySelectorAll('.only-translate-loading, .only-translate-retry-wrapper').forEach(element => {
        element.remove();
    });
    
    // 4. 清空存储的原始内容
    originalContents.clear();
    
    // 5. 停止所有观察器
    if (translationState.observer) {
        translationState.observer.disconnect();
        translationState.observer = null;
    }
    if (translationState.mutationObserver) {
        translationState.mutationObserver.disconnect();
        translationState.mutationObserver = null;
    }
    
    // 6. 重置所有翻译相关的状态
    setAutoTranslating(false);
    translationState.htmlSet.clear(); // 清空防抖集合
    translationState.nodeIdCounter = 0; // 重置节点ID计数器
    
    // 7. 消除可能存在的全局样式污染
    const tempStyleElements = document.querySelectorAll('style[data-fr-temp-style]');
    tempStyleElements.forEach(el => el.remove());
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage(scopeOverride?: string) {
    // 如果已经在翻译中，则返回
    if (translationState.isAutoTranslating) return;
    
    // 获取当前页面的语言（暂时注释，存在识别问题）
    // const text = document.documentElement.innerText || '';
    // const cleanText = text.replace(/[\s\u3000]+/g, ' ').trim().slice(0, 500);
    // const language = detectlang(cleanText);
    // console.log('当前页面语言：', language);
    // const to = config.to;
    // if (to.includes(language)) {
    //     console.log('目标语言与当前页面语言相同，不进行翻译');
    //     return;
    // }
    // console.log('当前页面非目标语言，开始翻译');

    // scope 优先取 popup 显式传入的值，再 fallback 到 config 单例（悬浮球等其他入口）
    const scope = scopeOverride ?? config.translationScope;
    const { contentRoot, nodes, grabOptions } = resolveAutoTranslateTarget(scope);
    const activeGrabOptions = grabOptions ?? {};

    if (!nodes.length) return;

    setAutoTranslating(true);

    // 创建观察器
    translationState.observer = new IntersectionObserver((entries, activeObserver) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && translationState.isAutoTranslating) {
                const node = entry.target;
                if (!(node instanceof HTMLElement)) return;

                // 去重
                if (node.hasAttribute(TRANSLATED_ATTR)) return;
                
                // 为节点分配唯一ID
                const nodeId = `fr-node-${translationState.nodeIdCounter++}`;
                node.setAttribute(TRANSLATED_ID_ATTR, nodeId);
                
                // 保存原始内容
                originalContents.set(nodeId, node.innerHTML);
                
                // 标记为已翻译
                node.setAttribute(TRANSLATED_ATTR, 'true');

                if (config.display === styles.bilingualTranslation) {
                    handleBilingualTranslation(node, false);
                } else {
                    handleSingleTranslation(node, false);
                }

                // 停止观察该节点
                activeObserver.unobserve(node);
            }
        });
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1 // 只要出现10%就开始翻译
    });

    // 开始观察所有节点
    nodes.forEach(node => {
        translationState.observer?.observe(node);
    });

    const observeTranslationNodes = (nodes: Element[]) => {
        nodes.forEach(node => translationState.observer?.observe(node));
    };

    const pendingDynamicRoots = new Set<Element>();
    let dynamicScanTimer: number | null = null;

    const scheduleDynamicScan = (root: Element) => {
        invalidateScanCache(activeGrabOptions.scanContext, root);
        if (isManagedTranslationNode(root)) return;
        const scanRoot = getDynamicTranslationScanRoot(root, contentRoot, scope, activeGrabOptions);
        if (!scanRoot) return;
        if (!isDynamicInTranslationScope(scanRoot, contentRoot, scope, activeGrabOptions)) return;

        pendingDynamicRoots.add(scanRoot);
        if (dynamicScanTimer !== null) return;

        dynamicScanTimer = window.setTimeout(() => {
            dynamicScanTimer = null;
            const roots = Array.from(pendingDynamicRoots);
            pendingDynamicRoots.clear();

            roots.forEach(scanRoot => {
                observeTranslationNodes(
                    collectDynamicTranslationNodes(scanRoot, contentRoot, scope, activeGrabOptions)
                );
            });
        }, 120);
    };

    // 创建 MutationObserver 监听 DOM 变化
    translationState.mutationObserver = new MutationObserver((mutations) => {
        if (!translationState.isAutoTranslating) return;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        scheduleDynamicScan(node);
                    }
                });
                return;
            }

            if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                scheduleDynamicScan(mutation.target);
                if (mutation.target.parentElement) {
                    scheduleDynamicScan(mutation.target.parentElement);
                }
                return;
            }

            if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                if (parent) {
                    scheduleDynamicScan(parent);
                }
            }
        });
    });

    // 监听整个 body 的变化
    translationState.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: DYNAMIC_MUTATION_ATTRIBUTES,
        characterData: true
    });
}

// 处理鼠标悬停翻译的主函数
export function handleTranslation(mouseX: number, mouseY: number, delayTime: number = 0) {
    // 检查配置
    if (!checkConfig()) return;

    clearHoverTimer();
    translationState.hoverTimer = setTimeout(() => {

        // 只在手动悬停翻译注入副作用回调；smart/full 自动扫描只能收集目标，不能在识文阶段触发翻译。
        let node = grabNode(document.elementFromPoint(mouseX, mouseY), {
            translateFirstLineText,
            translateButtonText: handleBtnTranslation
        });
        if (!(node instanceof HTMLElement)) return;

        // 判断是否跳过节点
        if (skipNode(node)) return;

        // 防抖
        let nodeOuterHTML = node.outerHTML;
        if (translationState.htmlSet.has(nodeOuterHTML)) return;
        translationState.htmlSet.add(nodeOuterHTML);

        // 根据翻译模式进行翻译
        if (config.display === styles.bilingualTranslation) {
            handleBilingualTranslation(node, delayTime > 0);  // 根据 delayTime 可判断是否为滑动翻译
        } else {
            handleSingleTranslation(node, delayTime > 0);
        }
    }, delayTime);
}

// 双语翻译
export function handleBilingualTranslation(node: HTMLElement, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    const originText = getTranslatableText(node);
    // 如果已经翻译过，250ms 后删除翻译结果
    let bilingualNode = searchClassName(node, BILINGUAL_WRAPPER_CLASS);
    if (bilingualNode) {
        if (slide) {
            translationState.htmlSet.delete(nodeOuterHTML);
            return;
        }
        let spinner = insertLoadingSpinner(bilingualNode as HTMLElement, true);
        setTimeout(() => {
            spinner.remove();
            const content = searchClassName(bilingualNode as HTMLElement, BILINGUAL_CONTENT_CLASS);
            if (content && content instanceof HTMLElement) content.remove();
            (bilingualNode as HTMLElement).classList.remove(BILINGUAL_WRAPPER_CLASS);
            translationState.htmlSet.delete(nodeOuterHTML);
        }, 250);
        return;
    }

    // 检查是否有缓存
    let cached = cache.localGet(originText);
    if (cached) {
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, cached);
        }, 250);
        return;
    }

    // 翻译
    bilingualTranslate(node, nodeOuterHTML);
}

// 单语翻译
export function handleSingleTranslation(node: HTMLElement, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    let outerHTMLCache = cache.localGet(node.outerHTML);


    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            if (fn) fn(node, outerHTMLCache);
            else node.outerHTML = outerHTMLCache;

        }, 250);
        return;
    }

    singleTranslate(node);
}


function bilingualTranslate(node: HTMLElement, nodeOuterHTML: string) {
    const plainOrigin = getTranslatableText(node);
    const protectedInlineOrigin = getTranslatableTextWithProtectedInline(node);
    const origin = protectedInlineOrigin.protectedInlines.length ? protectedInlineOrigin.text : plainOrigin;
    if (!shouldTranslateText(plainOrigin)) return;

    if (!origin?.trim()) return;
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then(async (text: string) => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            const content = renderTextWithProtectedInline(text, protectedInlineOrigin.protectedInlines);
            if (content) {
                bilingualAppendChild(node, content);
                return;
            }

            if (protectedInlineOrigin.protectedInlines.length) {
                text = await translateText(plainOrigin, document.title);
            }
            bilingualAppendChild(node, text);
        })
        .catch((error: Error) => {
            spinner.remove();
            if (isTranslationCancelledError(error)) return;
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}


export function singleTranslate(node: HTMLElement) {
    const translatableText = getTranslatableText(node);
    if (!shouldTranslateText(translatableText)) return;

    let origin = servicesType.isMachine(config.service) ? getTranslatableHTML(node) : LLMStandardHTML(node);
    if (!origin?.trim()) {
        origin = translatableText.trim();
    }
    if (!origin) return;
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then((text: string) => {
            spinner.remove();
            
            if (shouldBeautifyTranslatedHTML(origin, text)) {
                text = beautyHTML(text);
            }
            
            if (!text || origin === text) return;
            
            let oldOuterHtml = node.outerHTML;
            node.innerHTML = text;
            let newOuterHtml = node.outerHTML;
            
            // 缓存翻译结果
            cache.localSetDual(oldOuterHtml, newOuterHtml);
            cache.set(translationState.htmlSet, newOuterHtml, 250);
            translationState.htmlSet.delete(oldOuterHtml);
        })
        .catch((error: Error) => {
            spinner.remove();
            if (isTranslationCancelledError(error)) return;
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}

export const handleBtnTranslation = throttle((node: HTMLElement) => {
    let origin = node.innerText;
    let rs = cache.localGet(origin);
    if (rs) {
        node.innerText = rs;
        return;
    }

    translateText(origin, document.title)
        .then((text: string) => {
            if (!text || text === origin) return;
            cache.localSetDual(origin, text);
            node.innerText = text;
        }).catch((error: unknown) => {
            if (isTranslationCancelledError(error)) return;
            console.error('调用失败:', error);
        })
}, 250)


function bilingualAppendChild(node: HTMLElement, text: string | Node) {
    if (searchClassName(node, BILINGUAL_CONTENT_CLASS)) return;

    node.classList.add(BILINGUAL_WRAPPER_CLASS);
    let newNode = document.createElement("span");
    newNode.classList.add(BILINGUAL_CONTENT_CLASS);
    // find the style
    const style = options.styles.find(s => s.value === config.style && !s.disabled);
    if (style?.class) {
        newNode.classList.add(style.class);
    }
    newNode.append(text);
    smashTruncationStyle(node);
    const appendTarget = getBilingualAppendTarget(node);
    appendTarget.appendChild(newNode);

    const fn = afterBilingualAppendCompatFn[getMainDomain(document.location.hostname)];
    if (fn) fn(node, newNode, appendTarget);
}

function getBilingualAppendTarget(node: HTMLElement): HTMLElement {
    return getTranslationTargetAppendTarget(node, {
        mode: config.translationScope === 'full' ? 'full' : 'smart',
        scope: config.translationScope,
        contentRoot: document.body
    });
}
