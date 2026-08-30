import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, services, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner, showExtensionReloadedTip } from "../utils/icon";
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
    smashTruncationStyle,
    DIRECT_TEXT_TARGET_ATTR,
    cleanupDirectTextTargets,
    unwrapDirectTextTarget
} from "@/entrypoints/main/dom";
import { throttle } from "@/entrypoints/utils/common";
import { afterBilingualAppendCompatFn, replaceCompatFn } from "@/entrypoints/main/compat";
import { getMainDomain } from "@/entrypoints/utils/domain";
import { config } from "@/entrypoints/utils/config";
import { getBackgroundTranslationSlotLimit } from "@/entrypoints/utils/translateQueue";
import {
    isTranslationCancelledError,
    isExtensionContextInvalidatedError,
    translateText,
    cancelAllTranslations,
    type TranslateOptions
} from '@/entrypoints/utils/translateApi';
import { shouldTranslateText } from "@/entrypoints/utils/translationDirection";
import { createTranslationDiagnosticId } from '@/entrypoints/utils/translationDiagnostics';
import { t } from '@/entrypoints/utils/i18n';
import { type TranslationPromptContext } from '@/entrypoints/utils/translationPrompt';
import {
    hasTranslationOnlyRecord,
    hideOriginalForTranslationOnly,
    prepareTranslationOnly,
    restoreAllTranslationOnly,
    restoreTranslationOnly,
    type PreparedTranslationOnly,
} from '@/entrypoints/main/translationOnly';
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
    BILINGUAL_TEXT_CLASS,
    BILINGUAL_WRAPPER_CLASS,
    TRANSLATED_ATTR,
    TRANSLATED_ID_ATTR
} from '@/entrypoints/main/translationTarget/constants';

// 刻意不监听 style：内联 style 是动画/过渡产生 mutation 风暴的主要来源，且对“是否需要翻译”几乎没有信号价值；
// 内容显隐由 class / hidden / aria-* 覆盖即可。
const DYNAMIC_MUTATION_ATTRIBUTES = ['class', 'hidden', 'aria-hidden', 'aria-expanded'];
const ACTIVE_TRANSLATION_STATUS_SELECTOR = '.only-translate-loading, .only-translate-failure, .only-translate-retry-wrapper';
const BACKGROUND_TRANSLATION_START_DELAY = 1000;
const BACKGROUND_TRANSLATION_INTERVAL = 250;

const translationState = {
    hoverTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    backgroundTimer: null as ReturnType<typeof setTimeout> | null,
    htmlSet: new Set<string>(),
    originalContents: new Map<string, string>(),
    isAutoTranslating: false,
    observer: null as IntersectionObserver | null,
    mutationObserver: null as MutationObserver | null,
    nodeIdCounter: 0
};

let hasReportedInvalidatedExtensionContext = false;

function getWebpagePromptContext(_node: HTMLElement | null = null): TranslationPromptContext {
    return {
        scene: 'webpage',
        title: document.title,
    };
}

function getHoverPromptContext(_node: Node | null = null): TranslationPromptContext {
    return {
        scene: 'hover',
        title: document.title,
    };
}

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

function clearBackgroundTranslationTimer(): void {
    if (translationState.backgroundTimer !== null) {
        clearTimeout(translationState.backgroundTimer);
        translationState.backgroundTimer = null;
    }
}

function stopForInvalidatedExtensionContext(error: unknown, failedNode: HTMLElement): boolean {
    if (!isExtensionContextInvalidatedError(error)) return false;
    if (hasReportedInvalidatedExtensionContext) {
        clearUnfinishedAutoTranslation(failedNode);
        return true;
    }

    hasReportedInvalidatedExtensionContext = true;
    const unfinishedNodes = new Set<HTMLElement>([failedNode]);
    document.querySelectorAll<HTMLElement>('.only-translate-loading').forEach(element => {
        if (element.parentElement) unfinishedNodes.add(element.parentElement);
        element.remove();
    });
    setAutoTranslating(false);
    clearHoverTimer();
    clearBackgroundTranslationTimer();
    translationState.observer?.disconnect();
    translationState.observer = null;
    translationState.mutationObserver?.disconnect();
    translationState.mutationObserver = null;
    cancelAllTranslations();
    unfinishedNodes.forEach(clearUnfinishedAutoTranslation);
    clearStaleBilingualTranslationMarkers();
    showExtensionReloadedTip();
    return true;
}

interface AutoTranslateTarget {
    contentRoot: Element;
    nodes: Element[];
    grabOptions?: GrabAllNodeOptions;
}

type TranslationRequestOptions = Pick<TranslateOptions, 'allowBatch' | 'priority' | 'diagnostics'>;

interface BilingualTranslationOptions extends TranslationRequestOptions {
    removeExisting?: boolean;
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
    const diagnostics = {
        sessionId: createTranslationDiagnosticId('hover'),
        scene: 'hover' as const,
        startedAt: Date.now(),
        pageUrl: document.location.href,
    };
    translateText(origin, getHoverPromptContext(textNode), { diagnostics })
        .then((text: string) => {
            textNode.textContent = text;
            notifyDiagnosticVisible({ diagnostics });
        })
        .catch((error: Error) => {
            if (isTranslationCancelledError(error)) return;
            console.error('翻译失败:', error);
        });
}

function shouldBeautifyTranslatedHTML(origin: string, translated: string): boolean {
    return /<[^>]+>/.test(origin) || /<[^>]+>/.test(translated);
}

function usesSafeTranslationOnlyWrapper(service: string): boolean {
    return service === services.google || service === services.microsoft;
}

function shouldStartTranslation(node: HTMLElement): boolean {
    const translatableText = getTranslatableText(node);
    return Boolean(translatableText.trim()) && shouldTranslateText(translatableText);
}

function clearUnfinishedAutoTranslation(node: HTMLElement): void {
    if (!node.hasAttribute(TRANSLATED_ATTR)) return;
    if (node.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)) return;

    clearTranslationHostMarkers(node);
}

function clearTranslationHostMarkers(node: HTMLElement): void {
    const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
    if (nodeId) {
        originalContents.delete(nodeId);
        node.removeAttribute(TRANSLATED_ID_ATTR);
    }
    node.removeAttribute(TRANSLATED_ATTR);
    node.classList.remove(BILINGUAL_WRAPPER_CLASS);
}

function clearStaleBilingualTranslationMarkers(root: ParentNode = document.body): void {
    const translatedSelector = `[${TRANSLATED_ATTR}="true"]`;
    const translatedElements = Array.from(root.querySelectorAll<HTMLElement>(translatedSelector));
    if (root instanceof HTMLElement && root.matches(translatedSelector)) {
        translatedElements.unshift(root);
    }

    translatedElements.forEach(element => {
        if (element.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)) return;
        if (element.matches(ACTIVE_TRANSLATION_STATUS_SELECTOR)) return;
        if (element.querySelector(ACTIVE_TRANSLATION_STATUS_SELECTOR)) return;

        clearUnfinishedAutoTranslation(element);
    });
}

// 恢复原文内容
export function restoreOriginalContent() {
    // 取消所有等待中的翻译任务
    cancelAllTranslations();

    restoreAllTranslationOnly().forEach(node => {
        clearTranslationHostMarkers(node);
    });
    
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

    document.querySelectorAll(`.${BILINGUAL_WRAPPER_CLASS}`).forEach(element => {
        element.classList.remove(BILINGUAL_WRAPPER_CLASS);
    });
    
    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    document.querySelectorAll('.only-translate-loading, .only-translate-retry-wrapper').forEach(element => {
        element.remove();
    });

    document.querySelectorAll(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`).forEach(element => {
        unwrapDirectTextTarget(element);
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
    clearBackgroundTranslationTimer();
    
    // 6. 重置所有翻译相关的状态
    setAutoTranslating(false);
    translationState.htmlSet.clear(); // 清空防抖集合
    translationState.nodeIdCounter = 0; // 重置节点ID计数器
    hasReportedInvalidatedExtensionContext = false;
    
    // 7. 消除可能存在的全局样式污染
    const tempStyleElements = document.querySelectorAll('style[data-fr-temp-style]');
    tempStyleElements.forEach(el => el.remove());
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage(scopeOverride?: string) {
    // 如果已经在翻译中，则返回
    if (translationState.isAutoTranslating) return;

    clearStaleBilingualTranslationMarkers();
    
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

    const diagnosticContext = {
        sessionId: createTranslationDiagnosticId('webpage'),
        scene: 'webpage' as const,
        startedAt: Date.now(),
        pageUrl: document.location.href,
    };

    setAutoTranslating(true);
    const translateAutoTarget = (
        node: Element,
        activeObserver?: IntersectionObserver,
        requestOptions: TranslationRequestOptions = { allowBatch: true, priority: 'high' }
    ): Promise<void> => {
        if (!(node instanceof HTMLElement)) return Promise.resolve();

        // 去重
        if (node.hasAttribute(TRANSLATED_ATTR)) return Promise.resolve();

        // 为节点分配唯一ID
        const nodeId = `fr-node-${translationState.nodeIdCounter++}`;
        node.setAttribute(TRANSLATED_ID_ATTR, nodeId);

        // 保存原始内容
        originalContents.set(nodeId, node.innerHTML);

        // 标记为已翻译
        node.setAttribute(TRANSLATED_ATTR, 'true');

        const translation = config.display === styles.bilingualTranslation
            ? handleBilingualTranslation(node, false, { removeExisting: false, ...requestOptions, diagnostics: diagnosticContext })
            : handleSingleTranslation(node, false, { ...requestOptions, diagnostics: diagnosticContext });

        // 停止观察该节点
        activeObserver?.unobserve(node);
        return translation;
    };

    // 创建观察器
    translationState.observer = new IntersectionObserver((entries, activeObserver) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && translationState.isAutoTranslating) {
                void translateAutoTarget(entry.target, activeObserver, { allowBatch: true, priority: 'high' });
            }
        });
    }, {
        root: null,
        rootMargin: '400px',
        threshold: 0.1 // 只要进入近可视区域就开始翻译
    });

    // 开始观察所有节点，让首屏内容优先进入翻译队列；支持 batch 的服务仍可合并同一批可视节点。
    nodes.forEach(node => {
        translationState.observer?.observe(node);
    });

    let backgroundCursor = 0;
    let activeBackgroundAutoTranslations = 0;
    const takeNextBackgroundNode = (): Element | null => {
        while (backgroundCursor < nodes.length) {
            const node = nodes[backgroundCursor++];
            if (node instanceof HTMLElement && !node.hasAttribute(TRANSLATED_ATTR)) {
                return node;
            }
        }
        return null;
    };

    const scheduleBackgroundTranslation = (delay = BACKGROUND_TRANSLATION_INTERVAL): void => {
        if (translationState.backgroundTimer !== null) return;
        translationState.backgroundTimer = setTimeout(runBackgroundTranslation, delay);
    };

    const runBackgroundTranslation = (): void => {
        translationState.backgroundTimer = null;
        if (!translationState.isAutoTranslating) return;

        while (activeBackgroundAutoTranslations < getBackgroundTranslationSlotLimit()) {
            const node = takeNextBackgroundNode();
            if (!node) return;

            activeBackgroundAutoTranslations++;
            void translateAutoTarget(node, translationState.observer ?? undefined, {
                allowBatch: true,
                priority: 'background'
            }).finally(() => {
                activeBackgroundAutoTranslations--;
                if (translationState.isAutoTranslating) {
                    scheduleBackgroundTranslation();
                }
            });
        }
    };

    scheduleBackgroundTranslation(BACKGROUND_TRANSLATION_START_DELAY);

    const observeTranslationNodes = (nodes: Element[]) => {
        nodes.forEach(node => translationState.observer?.observe(node));
    };

    // 单次 flush 最多处理的变更根节点数量。动画 / 框架重渲染的页面会在一帧内产生成百上千条 mutation，
    // 必须给待处理集合封顶，避免主线程被无界的扫描任务压垮。
    const MAX_PENDING_MUTATION_ROOTS = 32;
    const pendingMutationRoots = new Set<Element>();
    let dynamicScanTimer: number | null = null;

    // 真正昂贵的作用域判定（invalidateScanCache / getDynamicTranslationScanRoot / 作用域回溯）全部推迟到防抖
    // flush 中执行，并对处理数量封顶。否则会在 MutationObserver 回调里逐条同步执行 querySelectorAll('*') 与
    // closest() 选择器链——在高频 DOM 变更的页面上这会让主线程持续 100% 卡死。
    function flushDynamicScans(): void {
        dynamicScanTimer = null;
        const roots = Array.from(pendingMutationRoots);
        pendingMutationRoots.clear();

        const scanRoots = new Set<Element>();
        roots.forEach(root => {
            invalidateScanCache(activeGrabOptions.scanContext, root);
            if (isManagedTranslationNode(root)) return;
            const scanRoot = getDynamicTranslationScanRoot(root, contentRoot, scope, activeGrabOptions);
            if (!scanRoot) return;
            if (!isDynamicInTranslationScope(scanRoot, contentRoot, scope, activeGrabOptions)) return;
            scanRoots.add(scanRoot);
        });

        scanRoots.forEach(scanRoot => {
            observeTranslationNodes(
                collectDynamicTranslationNodes(scanRoot, contentRoot, scope, activeGrabOptions)
            );
        });
    }

    // 回调里只做最廉价的过滤与收集：跳过自身注入的受管节点，其余加入待处理集合并触发防抖。
    const enqueueMutationRoot = (root: Element): void => {
        if (pendingMutationRoots.size >= MAX_PENDING_MUTATION_ROOTS) return;
        if (isManagedTranslationNode(root)) return;
        pendingMutationRoots.add(root);
        if (dynamicScanTimer === null) {
            dynamicScanTimer = window.setTimeout(flushDynamicScans, 150);
        }
    };

    // 创建 MutationObserver 监听 DOM 变化
    translationState.mutationObserver = new MutationObserver((mutations) => {
        if (!translationState.isAutoTranslating) return;

        for (const mutation of mutations) {
            // 集合已满则停止本批处理，剩余变更会在后续 mutation 中被重新捕获，避免在卡死页面上空转。
            if (pendingMutationRoots.size >= MAX_PENDING_MUTATION_ROOTS) break;

            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) enqueueMutationRoot(node);
                });
                continue;
            }

            if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                enqueueMutationRoot(mutation.target);
                continue;
            }

            if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                if (parent) enqueueMutationRoot(parent);
            }
        }
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
        const directTextRunWrappers = new Set<Element>();
        const cleanupProbeWrappers = (keep?: Element) => {
            cleanupDirectTextTargets(directTextRunWrappers, keep ? [keep] : []);
        };
        let node = grabNode(document.elementFromPoint(mouseX, mouseY), {
            translateFirstLineText,
            translateButtonText: handleBtnTranslation,
            directTextRunWrapperCollector: directTextRunWrappers
        });
        if (!(node instanceof HTMLElement)) {
            cleanupProbeWrappers();
            return;
        }

        // 判断是否跳过节点
        if (skipNode(node)) {
            cleanupProbeWrappers();
            return;
        }

        if (!shouldStartTranslation(node)) {
            cleanupProbeWrappers();
            return;
        }

        // 防抖
        let nodeOuterHTML = node.outerHTML;
        if (translationState.htmlSet.has(nodeOuterHTML)) {
            cleanupProbeWrappers();
            return;
        }
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
export function handleBilingualTranslation(
    node: HTMLElement,
    slide: boolean,
    options: BilingualTranslationOptions = {}
): Promise<void> {
    let nodeOuterHTML = node.outerHTML;
    const originText = getTranslatableText(node);
    // 如果已经翻译过，250ms 后删除翻译结果
    let bilingualNode = searchClassName(node, BILINGUAL_WRAPPER_CLASS);
    if (bilingualNode) {
        if (options.removeExisting === false) {
            translationState.htmlSet.delete(nodeOuterHTML);
            return Promise.resolve();
        }
        if (slide) {
            translationState.htmlSet.delete(nodeOuterHTML);
            return Promise.resolve();
        }
        let spinner = insertLoadingSpinner(bilingualNode as HTMLElement, true);
        return new Promise(resolve => setTimeout(() => {
            spinner.remove();
            const content = searchClassName(bilingualNode as HTMLElement, BILINGUAL_CONTENT_CLASS);
            if (content && content instanceof HTMLElement) content.remove();
            (bilingualNode as HTMLElement).classList.remove(BILINGUAL_WRAPPER_CLASS);
            translationState.htmlSet.delete(nodeOuterHTML);
            resolve();
        }, 250));
    }

    // 检查是否有缓存
    let cached = cache.localGet(originText, config.to, getWebpagePromptContext(node));
    if (cached) {
        let spinner = insertLoadingSpinner(node, true);
        return new Promise(resolve => setTimeout(() => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, cached);
            resolve();
        }, 250));
    }

    // 翻译
    return bilingualTranslate(node, nodeOuterHTML, options);
}

// 单语翻译
export function handleSingleTranslation(node: HTMLElement, slide: boolean, options: TranslationRequestOptions = {}): Promise<void> {
    if (usesSafeTranslationOnlyWrapper(config.service)) {
        return handleSafeTranslationOnly(node, slide, options);
    }

    let nodeOuterHTML = node.outerHTML;
    let outerHTMLCache = cache.localGet(node.outerHTML, config.to, getWebpagePromptContext(node));


    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        return new Promise(resolve => setTimeout(() => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            if (fn) fn(node, outerHTMLCache);
            else node.outerHTML = outerHTMLCache;

            resolve();
        }, 250));
    }

    return singleTranslate(node, options);
}

function handleSafeTranslationOnly(
    node: HTMLElement,
    slide: boolean,
    options: TranslationRequestOptions,
): Promise<void> {
    const nodeOuterHTML = node.outerHTML;
    if (hasTranslationOnlyRecord(node)) {
        if (slide) {
            translationState.htmlSet.delete(nodeOuterHTML);
            return Promise.resolve();
        }

        const spinner = insertLoadingSpinner(node, true);
        return new Promise(resolve => setTimeout(() => {
            spinner.remove();
            restoreTranslationOnly(node);
            clearTranslationHostMarkers(node);
            translationState.htmlSet.delete(nodeOuterHTML);
            resolve();
        }, 250));
    }

    return safeTranslationOnlyTranslate(node, nodeOuterHTML, options);
}


function bilingualTranslate(node: HTMLElement, nodeOuterHTML: string, options: TranslationRequestOptions = {}): Promise<void> {
    const plainOrigin = getTranslatableText(node);
    const protectedInlineOrigin = getTranslatableTextWithProtectedInline(node);
    const origin = protectedInlineOrigin.protectedInlines.length ? protectedInlineOrigin.text : plainOrigin;
    if (!shouldTranslateText(plainOrigin)) {
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }

    if (!origin?.trim()) {
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    const promptContext = getWebpagePromptContext(node);
    return translateText(origin, promptContext, options)
        .then(async (text: string) => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            const content = renderTextWithProtectedInline(text, protectedInlineOrigin.protectedInlines);
            if (content) {
                bilingualAppendChild(node, content);
                notifyDiagnosticVisible(options);
                return;
            }

            if (protectedInlineOrigin.protectedInlines.length) {
                text = await translateText(plainOrigin, promptContext, options);
            }
            bilingualAppendChild(node, text);
            notifyDiagnosticVisible(options);
        })
        .catch((error: Error) => {
            spinner.remove();
            if (stopForInvalidatedExtensionContext(error, node)) return;
            if (isTranslationCancelledError(error)) {
                translationState.htmlSet.delete(nodeOuterHTML);
                clearUnfinishedAutoTranslation(node);
                return;
            }
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}

function safeTranslationOnlyTranslate(
    node: HTMLElement,
    nodeOuterHTML: string,
    options: TranslationRequestOptions = {},
): Promise<void> {
    const plainOrigin = getTranslatableText(node);
    const protectedInlineOrigin = getTranslatableTextWithProtectedInline(node);
    const origin = protectedInlineOrigin.protectedInlines.length ? protectedInlineOrigin.text : plainOrigin;
    if (!shouldTranslateText(plainOrigin)) {
        translationState.htmlSet.delete(nodeOuterHTML);
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }

    if (!origin?.trim()) {
        translationState.htmlSet.delete(nodeOuterHTML);
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }

    const prepared = prepareTranslationOnly(node, getBilingualAppendTarget(node));
    const spinner = insertLoadingSpinner(node);
    const promptContext = getWebpagePromptContext(node);
    return translateText(origin, promptContext, options)
        .then(async (text: string) => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            if (!text || origin === text) {
                clearUnfinishedAutoTranslation(node);
                return;
            }

            const content = renderTextWithProtectedInline(text, protectedInlineOrigin.protectedInlines);
            if (content) {
                appendSafeTranslationOnly(node, content, prepared);
                notifyDiagnosticVisible(options);
                return;
            }

            if (protectedInlineOrigin.protectedInlines.length) {
                text = await translateText(plainOrigin, promptContext, options);
            }
            appendSafeTranslationOnly(node, text, prepared);
            notifyDiagnosticVisible(options);
        })
        .catch((error: Error) => {
            spinner.remove();
            if (stopForInvalidatedExtensionContext(error, node)) return;
            if (isTranslationCancelledError(error)) {
                translationState.htmlSet.delete(nodeOuterHTML);
                clearUnfinishedAutoTranslation(node);
                return;
            }
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}


export function singleTranslate(node: HTMLElement, options: TranslationRequestOptions = {}): Promise<void> {
    const translatableText = getTranslatableText(node);
    if (!shouldTranslateText(translatableText)) {
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }

    let origin = servicesType.isMachine(config.service) ? getTranslatableHTML(node) : LLMStandardHTML(node);
    if (!origin?.trim()) {
        origin = translatableText.trim();
    }
    if (!origin) {
        clearUnfinishedAutoTranslation(node);
        return Promise.resolve();
    }
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    const promptContext = getWebpagePromptContext(node);
    return translateText(origin, promptContext, options)
        .then((text: string) => {
            spinner.remove();
            
            if (shouldBeautifyTranslatedHTML(origin, text)) {
                text = beautyHTML(text);
            }
            
            if (!text || origin === text) {
                clearUnfinishedAutoTranslation(node);
                return;
            }
            
            let oldOuterHtml = node.outerHTML;
            node.innerHTML = text;
            let newOuterHtml = node.outerHTML;
            
            // 缓存翻译结果
            cache.localSetDual(oldOuterHtml, newOuterHtml, config.to, promptContext);
            cache.set(translationState.htmlSet, newOuterHtml, 250);
            translationState.htmlSet.delete(oldOuterHtml);
            notifyDiagnosticVisible(options);
        })
        .catch((error: Error) => {
            spinner.remove();
            if (stopForInvalidatedExtensionContext(error, node)) return;
            if (isTranslationCancelledError(error)) {
                clearUnfinishedAutoTranslation(node);
                return;
            }
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}

export const handleBtnTranslation = throttle((node: HTMLElement) => {
    let origin = node.innerText;
    const promptContext = getHoverPromptContext(node);
    let rs = cache.localGet(origin, config.to, promptContext);
    if (rs) {
        node.innerText = rs;
        return;
    }

    const diagnostics = {
        sessionId: createTranslationDiagnosticId('hover'),
        scene: 'hover' as const,
        startedAt: Date.now(),
        pageUrl: document.location.href,
    };
    translateText(origin, promptContext, { diagnostics })
        .then((text: string) => {
            if (!text || text === origin) return;
            cache.localSetDual(origin, text, config.to, promptContext);
            node.innerText = text;
            notifyDiagnosticVisible({ diagnostics });
        }).catch((error: unknown) => {
            if (isTranslationCancelledError(error)) return;
            console.error('调用失败:', error);
        })
}, 250)


function bilingualAppendChild(node: HTMLElement, text: string | Node): boolean {
    return appendTranslationContent(node, text, false);
}

function appendSafeTranslationOnly(
    node: HTMLElement,
    text: string | Node,
    prepared: PreparedTranslationOnly,
): void {
    if (!appendTranslationContent(node, text, prepared)) {
        throw new Error(t('runtime.translationOnlyApplyFailed'));
    }
}

function appendTranslationContent(
    node: HTMLElement,
    text: string | Node,
    translationOnly: PreparedTranslationOnly | false,
): boolean {
    if (searchClassName(node, BILINGUAL_CONTENT_CLASS)) return false;

    node.classList.add(BILINGUAL_WRAPPER_CLASS);
    smashTruncationStyle(node);
    const appendTarget = translationOnly
        ? translationOnly.appendTarget
        : getBilingualAppendTarget(node);
    const insertionNode = document.createElement('span');
    insertionNode.classList.add(BILINGUAL_CONTENT_CLASS);
    const translationNode = document.createElement('span');
    translationNode.classList.add(BILINGUAL_TEXT_CLASS);
    // find the style
    const style = options.styles.find(s => s.value === config.style && !s.disabled);
    if (style?.class) {
        translationNode.classList.add(style.class);
    }
    translationNode.append(text);
    const layout = resolveBilingualInsertionLayout(appendTarget);
    if (!translationOnly && (layout === 'normal-flow' || layout === 'float-aware-inline')) {
        insertionNode.appendChild(document.createElement('br'));
    }
    insertionNode.appendChild(translationNode);
    appendTarget.appendChild(insertionNode);
    applyBilingualInsertionLayout(appendTarget, insertionNode, translationNode, layout);

    const fn = afterBilingualAppendCompatFn[getMainDomain(document.location.hostname)];
    if (fn) fn(node, translationNode, appendTarget, insertionNode);

    if (translationOnly && !hideOriginalForTranslationOnly(translationOnly, insertionNode)) {
        insertionNode.remove();
        node.classList.remove(BILINGUAL_WRAPPER_CLASS);
        return false;
    }

    cache.set(translationState.htmlSet, node.outerHTML, 250);
    return true;
}

function notifyDiagnosticVisible(options: TranslationRequestOptions): void {
    const sessionId = options.diagnostics?.sessionId;
    if (!sessionId) return;
    const extensionBrowser = (globalThis as typeof globalThis & {
        browser?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } }
    }).browser;
    void extensionBrowser?.runtime?.sendMessage?.({
        type: 'TRANSLATION_DIAGNOSTIC_VISIBLE',
        sessionId,
    })?.catch(() => undefined);
}

type BilingualInsertionLayout = 'normal-flow' | 'float-aware-inline' | 'blockified-flex' | 'preserved-flex';

function applyBilingualInsertionLayout(
    appendTarget: HTMLElement,
    insertionNode: HTMLElement,
    translationNode: HTMLElement,
    layout: BilingualInsertionLayout
): void {
    if (layout === 'float-aware-inline') {
        translationNode.style.display = 'inline';
        return;
    }

    if (layout !== 'blockified-flex') return;

    appendTarget.style.display = 'block';
    insertionNode.style.display = 'block';
    insertionNode.style.width = '100%';
    translationNode.style.display = 'block';
    translationNode.style.width = '100%';
}

function resolveBilingualInsertionLayout(appendTarget: HTMLElement): BilingualInsertionLayout {
    const targetDisplay = getComputedDisplay(appendTarget);
    if (!isFlexOrGridDisplay(targetDisplay)) {
        return hasPrecedingFloatSibling(appendTarget) ? 'float-aware-inline' : 'normal-flow';
    }

    const parent = appendTarget.parentElement;
    if (parent && isFlexOrGridDisplay(getComputedDisplay(parent))) return 'preserved-flex';

    return 'blockified-flex';
}

function hasPrecedingFloatSibling(element: HTMLElement): boolean {
    let sibling = element.previousElementSibling;
    while (sibling) {
        if (sibling instanceof HTMLElement) {
            const float = window.getComputedStyle(sibling).float;
            if (float === 'left' || float === 'right') return true;
        }
        sibling = sibling.previousElementSibling;
    }
    return false;
}

function getComputedDisplay(element: HTMLElement): string {
    try {
        return window.getComputedStyle(element).display || '';
    } catch (_) {
        return '';
    }
}

function isFlexOrGridDisplay(display: string): boolean {
    return display.includes('flex') || display.includes('grid');
}

function getBilingualAppendTarget(node: HTMLElement): HTMLElement {
    return getTranslationTargetAppendTarget(node, {
        mode: config.translationScope === 'full' ? 'full' : 'smart',
        scope: config.translationScope,
        contentRoot: document.body
    });
}
