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
import { t } from '@/entrypoints/utils/i18n/page';
import { type TranslationPromptContext } from '@/entrypoints/utils/translationPrompt';
import {
    hasTranslationOnlyRecord,
    hideOriginalForTranslationOnly,
    prepareTranslationOnly,
    restoreAllTranslationOnly,
    restoreTranslationOnly,
    type PreparedTranslationOnly,
} from '@/entrypoints/main/translationOnly';
import { resolveAutoTranslationTarget, resolveAutoTranslationTargetAsync } from '@/entrypoints/main/translationTarget/collect';
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
import {
    composedContains,
    composedClosest,
    getComposedParentElement,
    isManagedComposedSubtree,
    querySelectorAllComposed
} from '@/entrypoints/main/translationTarget/composedTree';
import { discoverScanShadowRoots, isElementVisible } from '@/entrypoints/main/translationTarget/scanContext';
import shadowTranslationStyles from '@/entrypoints/style.css?inline';

// style 只进入合并后的动态队列，用于捕获组件直接通过内联样式切换正文显隐的情况；
// 回调本身不读取布局，避免把动画 mutation 的成本放在 Observer 回调中。
const DYNAMIC_MUTATION_ATTRIBUTES = ['class', 'style', 'hidden', 'aria-hidden', 'aria-expanded'];
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
    rootMutationObserver: null as MutationObserver | null,
    navigationTimer: null as ReturnType<typeof setTimeout> | null,
    dynamicScanTimer: null as number | null,
    nodeIdCounter: 0,
    sessionVersion: 0,
    shadowRoots: new Set<ShadowRoot>(),
    observedShadowRoots: new Set<ShadowRoot>(),
    styledShadowRoots: new Set<ShadowRoot>(),
    translatedHosts: new Set<HTMLElement>(),
    slotChangeHandler: null as EventListener | null,
    targetCollectionController: null as AbortController | null
};

let sharedShadowStyleSheet: CSSStyleSheet | null = null;

const translationDisplayModes = new Map<string, 'bilingual' | 'single'>();
const appliedSingleTranslationContents = new Map<string, string>();

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

function clearDynamicScanTimer(): void {
    if (translationState.dynamicScanTimer !== null) {
        clearTimeout(translationState.dynamicScanTimer);
        translationState.dynamicScanTimer = null;
    }
}

function removeShadowRootListeners(): void {
    if (translationState.slotChangeHandler) {
        translationState.observedShadowRoots.forEach(root => {
            root.removeEventListener('slotchange', translationState.slotChangeHandler!, true);
        });
    }
    translationState.slotChangeHandler = null;
    translationState.observedShadowRoots.clear();
}

function ensureShadowTranslationStyles(node: Element): void {
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot) || translationState.styledShadowRoots.has(root)) return;

    try {
        if (!sharedShadowStyleSheet) {
            sharedShadowStyleSheet = new CSSStyleSheet();
            sharedShadowStyleSheet.replaceSync(shadowTranslationStyles);
        }
        if (!root.adoptedStyleSheets.includes(sharedShadowStyleSheet)) {
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, sharedShadowStyleSheet];
        }
    } catch (_) {
        const style = document.createElement('style');
        style.dataset.onlyTranslateShadowStyle = 'true';
        style.textContent = shadowTranslationStyles;
        root.appendChild(style);
    }
    translationState.styledShadowRoots.add(root);
}

function removeShadowTranslationStyle(root: ShadowRoot): void {
    root.querySelectorAll('style[data-only-translate-shadow-style="true"]').forEach(style => style.remove());
    try {
        if (sharedShadowStyleSheet && root.adoptedStyleSheets.includes(sharedShadowStyleSheet)) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== sharedShadowStyleSheet);
        }
    } catch (_) {}
    translationState.styledShadowRoots.delete(root);
}

function removeShadowTranslationStyles(): void {
    Array.from(translationState.styledShadowRoots).forEach(removeShadowTranslationStyle);
    translationState.styledShadowRoots.clear();
}

function stopForInvalidatedExtensionContext(error: unknown, failedNode: HTMLElement): boolean {
    if (!isExtensionContextInvalidatedError(error)) return false;
    if (hasReportedInvalidatedExtensionContext) {
        clearUnfinishedAutoTranslation(failedNode);
        return true;
    }

    hasReportedInvalidatedExtensionContext = true;
    translationState.sessionVersion += 1;
    const unfinishedNodes = new Set<HTMLElement>([failedNode]);
    querySelectorAllComposed<HTMLElement>('.only-translate-loading', translationState.shadowRoots).forEach(element => {
        if (element.parentElement) unfinishedNodes.add(element.parentElement);
        element.remove();
    });
    setAutoTranslating(false);
    translationState.targetCollectionController?.abort();
    translationState.targetCollectionController = null;
    clearHoverTimer();
    clearBackgroundTranslationTimer();
    clearDynamicScanTimer();
    translationState.observer?.disconnect();
    translationState.observer = null;
    translationState.mutationObserver?.disconnect();
    translationState.mutationObserver = null;
    translationState.rootMutationObserver?.disconnect();
    translationState.rootMutationObserver = null;
    removeShadowRootListeners();
    clearNavigationRestartTimer();
    cancelAllTranslations();
    unfinishedNodes.forEach(clearUnfinishedAutoTranslation);
    clearStaleBilingualTranslationMarkers();
    translationState.shadowRoots.forEach(root => clearStaleBilingualTranslationMarkers(root));
    removeShadowTranslationStyles();
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
    return isManagedComposedSubtree(node);
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
        translationDisplayModes.delete(nodeId);
        appliedSingleTranslationContents.delete(nodeId);
        node.removeAttribute(TRANSLATED_ID_ATTR);
    }
    node.removeAttribute(TRANSLATED_ATTR);
    node.classList.remove(BILINGUAL_WRAPPER_CLASS);
    translationState.translatedHosts.delete(node);
}

interface TranslationAttemptSnapshot {
    sourceText: string;
    sourceHTML: string;
    nodeId: string | null;
    sessionVersion: number;
}

function normalizeTranslationSource(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function captureTranslationAttempt(node: HTMLElement, sourceText: string): TranslationAttemptSnapshot {
    const sourceClone = node.cloneNode(true) as HTMLElement;
    sourceClone.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}, ${ACTIVE_TRANSLATION_STATUS_SELECTOR}`).forEach(element => element.remove());
    return {
        sourceText: normalizeTranslationSource(sourceText),
        sourceHTML: sourceClone.innerHTML,
        nodeId: node.getAttribute(TRANSLATED_ID_ATTR),
        sessionVersion: translationState.sessionVersion,
    };
}

function isTranslationAttemptCurrent(node: HTMLElement, attempt: TranslationAttemptSnapshot): boolean {
    if (!node.isConnected) return false;
    if (attempt.sessionVersion !== translationState.sessionVersion) return false;
    if (attempt.nodeId && node.getAttribute(TRANSLATED_ID_ATTR) !== attempt.nodeId) return false;
    const currentAttempt = captureTranslationAttempt(node, getTranslatableText(node));
    return currentAttempt.sourceText === attempt.sourceText && currentAttempt.sourceHTML === attempt.sourceHTML;
}

function discardStaleTranslationAttempt(
    node: HTMLElement,
    nodeOuterHTML: string,
    attempt: TranslationAttemptSnapshot,
): void {
    translationState.htmlSet.delete(nodeOuterHTML);
    // 同一宿主可能已经因动态更新启动了下一轮翻译；旧请求不能清掉新一轮的标记和状态。
    if (!attempt.nodeId || node.getAttribute(TRANSLATED_ID_ATTR) !== attempt.nodeId) return;
    const wasAutomaticTarget = node.hasAttribute(TRANSLATED_ATTR);
    clearUnfinishedAutoTranslation(node);
    if (wasAutomaticTarget && translationState.isAutoTranslating && node.isConnected) {
        translationState.observer?.observe(node);
    }
}

function clearNavigationRestartTimer(): void {
    if (translationState.navigationTimer !== null) {
        clearTimeout(translationState.navigationTimer);
        translationState.navigationTimer = null;
    }
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
    translationState.targetCollectionController?.abort();
    translationState.targetCollectionController = null;
    setAutoTranslating(false);
    translationState.sessionVersion += 1;

    restoreAllTranslationOnly().forEach(node => {
        clearTranslationHostMarkers(node);
    });
    
    // 1. 遍历所有已翻译的节点
    const translatedHosts = new Set<HTMLElement>([
        ...translationState.translatedHosts,
        ...querySelectorAllComposed<HTMLElement>(`[${TRANSLATED_ATTR}="true"]`, translationState.shadowRoots)
    ]);
    translatedHosts.forEach(node => {
        const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
        const displayMode = nodeId ? translationDisplayModes.get(nodeId) : undefined;
        if (nodeId && displayMode === 'single') {
            const originalContent = originalContents.get(nodeId);
            const appliedContent = appliedSingleTranslationContents.get(nodeId);
            // 仅当宿主仍保持为只译写入的结果时恢复，避免覆盖网站在翻译期间的新渲染。
            if (originalContent !== undefined && appliedContent !== undefined && node.innerHTML === appliedContent) {
                node.innerHTML = originalContent;
            }
        }

        node.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}`).forEach(element => element.remove());
        clearTranslationHostMarkers(node);
    });
    
    // 2. 移除所有翻译内容元素
    querySelectorAllComposed(`.${BILINGUAL_CONTENT_CLASS}`, translationState.shadowRoots).forEach(element => {
        element.remove();
    });

    querySelectorAllComposed(`.${BILINGUAL_WRAPPER_CLASS}`, translationState.shadowRoots).forEach(element => {
        element.classList.remove(BILINGUAL_WRAPPER_CLASS);
    });
    
    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    querySelectorAllComposed('.only-translate-loading, .only-translate-retry-wrapper', translationState.shadowRoots).forEach(element => {
        element.remove();
    });

    querySelectorAllComposed(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`, translationState.shadowRoots).forEach(element => {
        unwrapDirectTextTarget(element);
    });
    
    // 4. 清空存储的原始内容
    originalContents.clear();
    translationDisplayModes.clear();
    appliedSingleTranslationContents.clear();
    translationState.translatedHosts.clear();
    
    // 5. 停止所有观察器
    if (translationState.observer) {
        translationState.observer.disconnect();
        translationState.observer = null;
    }
    if (translationState.mutationObserver) {
        translationState.mutationObserver.disconnect();
        translationState.mutationObserver = null;
    }
    if (translationState.rootMutationObserver) {
        translationState.rootMutationObserver.disconnect();
        translationState.rootMutationObserver = null;
    }
    removeShadowRootListeners();
    clearDynamicScanTimer();
    clearBackgroundTranslationTimer();
    clearNavigationRestartTimer();
    const tempStyleElements = querySelectorAllComposed('style[data-fr-temp-style]', translationState.shadowRoots);
    tempStyleElements.forEach(el => el.remove());
    removeShadowTranslationStyles();
    translationState.shadowRoots.clear();
    
    // 6. 重置所有翻译相关的状态
    translationState.htmlSet.clear(); // 清空防抖集合
    translationState.nodeIdCounter = 0; // 重置节点ID计数器
    hasReportedInvalidatedExtensionContext = false;
    
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage(scopeOverride?: string) {
    // 如果已经在翻译中，则返回
    if (translationState.isAutoTranslating) return;

    translationState.sessionVersion += 1;
    setAutoTranslating(true);
    const sessionVersion = translationState.sessionVersion;
    const controller = new AbortController();
    translationState.targetCollectionController = controller;
    void startAutoTranslation(scopeOverride, sessionVersion, controller);
}

async function startAutoTranslation(
    scopeOverride: string | undefined,
    sessionVersion: number,
    controller: AbortController
): Promise<void> {

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
    let target: AutoTranslateTarget;
    try {
        target = await resolveAutoTranslationTargetAsync(scope, {
            signal: controller.signal,
            beforeCollect: roots => {
                clearStaleBilingualTranslationMarkers();
                roots.forEach(root => clearStaleBilingualTranslationMarkers(root));
            }
        });
    } catch (error) {
        if (controller.signal.aborted) return;
        if (translationState.sessionVersion === sessionVersion) setAutoTranslating(false);
        console.error('自动翻译目标收集失败:', error);
        return;
    }
    if (controller.signal.aborted || translationState.sessionVersion !== sessionVersion) return;
    translationState.targetCollectionController = null;
    const { contentRoot, nodes, grabOptions } = target;
    const activeGrabOptions = grabOptions ?? {};
    translationState.shadowRoots = activeGrabOptions.scanContext?.openShadowRoots ?? new Set<ShadowRoot>();

    const diagnosticContext = {
        sessionId: createTranslationDiagnosticId('webpage'),
        scene: 'webpage' as const,
        startedAt: Date.now(),
        pageUrl: document.location.href,
    };

    const initialPageUrl = document.location.href;
    const observedBody = document.body;

    const scheduleNavigationRestart = (): void => {
        if (!translationState.isAutoTranslating || translationState.navigationTimer !== null) return;
        translationState.navigationTimer = setTimeout(() => {
            translationState.navigationTimer = null;
            if (!translationState.isAutoTranslating) return;
            restoreOriginalContent();
            autoTranslateEnglishPage(scope);
        }, 150);
    };
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
        translationState.translatedHosts.add(node);
        ensureShadowTranslationStyles(node);

        // 保存原始内容
        originalContents.set(nodeId, node.innerHTML);
        translationDisplayModes.set(
            nodeId,
            config.display === styles.bilingualTranslation ? 'bilingual' : 'single'
        );

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

    const observedTranslationNodes = new Set<Element>(nodes);
    const observeTranslationNodes = (newNodes: Element[]) => {
        newNodes.forEach(node => {
            if (!observedTranslationNodes.has(node)) {
                observedTranslationNodes.add(node);
                nodes.push(node);
            }
            translationState.observer?.observe(node);
        });
        if (newNodes.length > 0) scheduleBackgroundTranslation();
    };

    const refreshTranslatedHost = (host: HTMLElement): void => {
        const nodeId = host.getAttribute(TRANSLATED_ID_ATTR);
        if (!nodeId || translationDisplayModes.get(nodeId) !== 'bilingual') return;
        host.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}`).forEach(element => element.remove());
        host.querySelectorAll(ACTIVE_TRANSLATION_STATUS_SELECTOR).forEach(element => element.remove());
        clearTranslationHostMarkers(host);
        if (translationState.isAutoTranslating && host.isConnected) {
            translationState.observer?.observe(host);
        }
    };

    const handleTranslatedHostMutation = (mutation: MutationRecord): boolean => {
        const targetElement = mutation.target instanceof Element
            ? mutation.target
            : getComposedParentElement(mutation.target);
        if (!targetElement) return false;
        if (composedClosest(targetElement, `.${BILINGUAL_CONTENT_CLASS}, ${ACTIVE_TRANSLATION_STATUS_SELECTOR}`)) return true;

        let host: HTMLElement | null = targetElement instanceof HTMLElement ? targetElement : null;
        while (host && !host.hasAttribute(TRANSLATED_ATTR)) {
            const parent = getComposedParentElement(host);
            host = parent instanceof HTMLElement ? parent : null;
        }
        if (!host) return false;
        const nodeId = host.getAttribute(TRANSLATED_ID_ATTR);
        if (!nodeId || translationDisplayModes.get(nodeId) !== 'bilingual') return true;

        if (mutation.type === 'characterData') {
            refreshTranslatedHost(host);
            return true;
        }

        if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            const removedNodes = Array.from(mutation.removedNodes);
            const isOwnedBilingualInsertion = (node: Node) => node instanceof Element
                && node.matches(`.${BILINGUAL_CONTENT_CLASS}`);
            const isOwnedStatusInsertion = (node: Node) => node instanceof Element
                && node.matches(ACTIVE_TRANSLATION_STATUS_SELECTOR);
            const isOwnedInsertion = (node: Node) => isOwnedBilingualInsertion(node) || isOwnedStatusInsertion(node);
            const addedWebsiteContent = addedNodes.some(node => !isOwnedInsertion(node));
            const removedWebsiteContent = removedNodes.some(node => !isOwnedInsertion(node));
            // 加载提示的挂载/卸载是我们自己的正常生命周期，不能因此重译；只有译文节点本身被移除才需要修复。
            const removedTranslation = removedNodes.some(isOwnedBilingualInsertion);
            if (addedWebsiteContent || removedWebsiteContent || removedTranslation) {
                refreshTranslatedHost(host);
            }
            return true;
        }

        // class / hidden / aria-* 变化只影响扫描可见性；不代表原文已经变化。
        return true;
    };

    // 每批只处理固定数量，但保留剩余项继续调度，避免高频页面既阻塞主线程又永久漏掉正文。
    const MAX_MUTATION_ROOTS_PER_FLUSH = 32;
    const pendingMutationRoots = new Set<Element>();
    const styleVisibilityState = new WeakMap<Element, boolean>();
    let dynamicScanRunning = false;

    const mutationOptions: MutationObserverInit = {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: DYNAMIC_MUTATION_ATTRIBUTES,
        characterData: true
    };

    const scheduleDynamicScan = (delay = 150): void => {
        if (translationState.dynamicScanTimer !== null || dynamicScanRunning) return;
        translationState.dynamicScanTimer = window.setTimeout(() => void flushDynamicScans(), delay);
    };

    const observeRegisteredShadowRoots = (): void => {
        for (const root of translationState.shadowRoots) {
            if (!root.host.isConnected || translationState.observedShadowRoots.has(root)) continue;
            translationState.mutationObserver?.observe(root, mutationOptions);
            if (translationState.slotChangeHandler) {
                root.addEventListener('slotchange', translationState.slotChangeHandler, true);
            }
            translationState.observedShadowRoots.add(root);
        }
    };

    const pruneDisconnectedShadowRoots = (): void => {
        const disconnected = Array.from(translationState.shadowRoots).filter(root => !root.host.isConnected);
        if (disconnected.length === 0) return;
        disconnected.forEach(root => {
            root.removeEventListener('slotchange', translationState.slotChangeHandler!, true);
            Array.from(translationState.translatedHosts)
                .filter(host => !host.isConnected && host.getRootNode() === root)
                .forEach(host => {
                    restoreTranslationOnly(host);
                    host.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}, ${ACTIVE_TRANSLATION_STATUS_SELECTOR}`)
                        .forEach(element => element.remove());
                    clearTranslationHostMarkers(host);
                });
            removeShadowTranslationStyle(root);
            translationState.shadowRoots.delete(root);
            translationState.observedShadowRoots.delete(root);
        });
        translationState.mutationObserver?.disconnect();
        translationState.mutationObserver?.observe(document.body, mutationOptions);
        translationState.observedShadowRoots.clear();
        observeRegisteredShadowRoots();
    };

    // 真正昂贵的作用域判定（invalidateScanCache / getDynamicTranslationScanRoot / 作用域回溯）全部推迟到防抖
    // flush 中执行，并对处理数量封顶。否则会在 MutationObserver 回调里逐条同步执行 querySelectorAll('*') 与
    // closest() 选择器链——在高频 DOM 变更的页面上这会让主线程持续 100% 卡死。
    async function flushDynamicScans(): Promise<void> {
        translationState.dynamicScanTimer = null;
        if (!translationState.isAutoTranslating) return;
        dynamicScanRunning = true;
        const roots = Array.from(pendingMutationRoots).slice(0, MAX_MUTATION_ROOTS_PER_FLUSH);
        roots.forEach(root => pendingMutationRoots.delete(root));

        const scanRoots = new Set<Element>();
        let sliceStarted = performance.now();
        for (const root of roots) {
            invalidateScanCache(activeGrabOptions.scanContext, root);
            if (isManagedTranslationNode(root)) continue;
            const scanRoot = getDynamicTranslationScanRoot(root, contentRoot, scope, activeGrabOptions);
            if (!scanRoot) continue;
            if (!isDynamicInTranslationScope(scanRoot, contentRoot, scope, activeGrabOptions)) continue;
            scanRoots.add(scanRoot);
            if (performance.now() - sliceStarted >= 4) {
                await new Promise<void>(resolve => setTimeout(resolve, 0));
                if (!translationState.isAutoTranslating) {
                    dynamicScanRunning = false;
                    return;
                }
                sliceStarted = performance.now();
            }
        }

        for (const scanRoot of scanRoots) {
            observeTranslationNodes(
                collectDynamicTranslationNodes(scanRoot, contentRoot, scope, activeGrabOptions)
            );
            if (performance.now() - sliceStarted >= 4) {
                await new Promise<void>(resolve => setTimeout(resolve, 0));
                if (!translationState.isAutoTranslating) {
                    dynamicScanRunning = false;
                    return;
                }
                sliceStarted = performance.now();
            }
        }
        discoverScanShadowRoots(activeGrabOptions.scanContext, document.body);
        observeRegisteredShadowRoots();
        pruneDisconnectedShadowRoots();
        dynamicScanRunning = false;
        if (pendingMutationRoots.size > 0) scheduleDynamicScan(0);
    }

    // 回调里只做最廉价的过滤与收集：跳过自身注入的受管节点，其余加入待处理集合并触发防抖。
    const enqueueMutationRoot = (root: Element): void => {
        if (isManagedTranslationNode(root)) return;
        if (Array.from(pendingMutationRoots).some(existing => composedContains(existing, root))) return;
        for (const existing of pendingMutationRoots) {
            if (composedContains(root, existing)) pendingMutationRoots.delete(existing);
        }
        pendingMutationRoots.add(root);
        scheduleDynamicScan();
    };

    // 创建 MutationObserver 监听 DOM 变化
    translationState.mutationObserver = new MutationObserver((mutations) => {
        if (!translationState.isAutoTranslating) return;
        if (document.body !== observedBody || document.location.href !== initialPageUrl || !contentRoot.isConnected) {
            scheduleNavigationRestart();
            return;
        }

        for (const mutation of mutations) {
            if (handleTranslatedHostMutation(mutation)) continue;

            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        enqueueMutationRoot(node);
                    } else {
                        const parent = getComposedParentElement(node) ?? getComposedParentElement(mutation.target);
                        if (parent) enqueueMutationRoot(parent);
                    }
                });
                if ((mutation.removedNodes?.length ?? 0) > 0) {
                    const parent = mutation.target instanceof Element
                        ? mutation.target
                        : getComposedParentElement(mutation.target);
                    if (parent) enqueueMutationRoot(parent);
                }
                continue;
            }

            if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                if (mutation.attributeName === 'style') {
                    const visible = isElementVisible(mutation.target);
                    const previous = styleVisibilityState.get(mutation.target);
                    styleVisibilityState.set(mutation.target, visible);
                    if (previous !== undefined && previous === visible) continue;
                }
                enqueueMutationRoot(mutation.target);
                continue;
            }

            if (mutation.type === 'characterData') {
                const parent = getComposedParentElement(mutation.target);
                if (parent) enqueueMutationRoot(parent);
            }
        }
    });

    // 监听整个 body 的变化
    translationState.mutationObserver.observe(document.body, mutationOptions);
    translationState.slotChangeHandler = event => {
        const slot = event.target;
        if (!(slot instanceof HTMLSlotElement)) return;
        const root = slot.getRootNode();
        enqueueMutationRoot(root instanceof ShadowRoot ? root.host : slot);
    };
    observeRegisteredShadowRoots();

    // body 自身被 SPA 替换后，绑定在旧 body 上的高频观察器不会再收到事件；
    // 单独用一个低成本根观察器只负责发现这类结构边界，不扫描 html/head 子树。
    translationState.rootMutationObserver = new MutationObserver(() => {
        if (!translationState.isAutoTranslating) return;
        if (document.body !== observedBody || document.location.href !== initialPageUrl || !contentRoot.isConnected) {
            scheduleNavigationRestart();
        }
    });
    translationState.rootMutationObserver.observe(document.documentElement, { childList: true });
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
    const attempt = captureTranslationAttempt(node, originText);
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
            if (!isTranslationAttemptCurrent(node, attempt)) {
                discardStaleTranslationAttempt(node, nodeOuterHTML, attempt);
                resolve();
                return;
            }
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
    const attempt = captureTranslationAttempt(node, getTranslatableText(node));
    let outerHTMLCache = cache.localGet(node.outerHTML, config.to, getWebpagePromptContext(node));


    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        return new Promise(resolve => setTimeout(() => {
            spinner.remove();
            translationState.htmlSet.delete(nodeOuterHTML);
            if (!isTranslationAttemptCurrent(node, attempt)) {
                discardStaleTranslationAttempt(node, nodeOuterHTML, attempt);
                resolve();
                return;
            }

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            if (fn) fn(node, outerHTMLCache);
            else node.outerHTML = outerHTMLCache;

            if (attempt.nodeId) {
                const appliedNode = node.isConnected
                    ? node
                    : document.querySelector<HTMLElement>(`[${TRANSLATED_ID_ATTR}="${attempt.nodeId}"]`);
                if (appliedNode) appliedSingleTranslationContents.set(attempt.nodeId, appliedNode.innerHTML);
            }

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
    const attempt = captureTranslationAttempt(node, plainOrigin);
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
            if (!isTranslationAttemptCurrent(node, attempt)) {
                discardStaleTranslationAttempt(node, nodeOuterHTML, attempt);
                return;
            }
            const content = renderTextWithProtectedInline(text, protectedInlineOrigin.protectedInlines);
            if (content) {
                if (bilingualAppendChild(node, content)) notifyDiagnosticVisible(options);
                return;
            }

            if (protectedInlineOrigin.protectedInlines.length) {
                text = await translateText(plainOrigin, promptContext, options);
                if (!isTranslationAttemptCurrent(node, attempt)) {
                    discardStaleTranslationAttempt(node, nodeOuterHTML, attempt);
                    return;
                }
            }
            if (bilingualAppendChild(node, text)) notifyDiagnosticVisible(options);
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
    const nodeOuterHTML = node.outerHTML;
    const translatableText = getTranslatableText(node);
    const attempt = captureTranslationAttempt(node, translatableText);
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
            if (!isTranslationAttemptCurrent(node, attempt)) {
                discardStaleTranslationAttempt(node, nodeOuterHTML, attempt);
                return;
            }
            
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
            const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
            if (nodeId) appliedSingleTranslationContents.set(nodeId, node.innerHTML);
            
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
    // 只折叠空白用于比较，保留大小写和标点差异；行内占位符已在调用前还原。
    const source = getTranslatableText(node).replace(/\s+/g, ' ').trim();
    const translation = (typeof text === 'string' ? text : getTranslatableText(text)).replace(/\s+/g, ' ').trim();
    // 自动目标保留本轮已处理标记，避免没有插入译文时被动态扫描反复请求。
    if (translation === source) return false;
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
