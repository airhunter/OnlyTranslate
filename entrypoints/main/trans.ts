import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner } from "../utils/icon";
import { styles } from "@/entrypoints/utils/constant";
import {
    beautyHTML,
    getTranslatableHTML,
    getTranslatableText,
    grabNode,
    grabAllNode,
    type GrabAllNodeOptions,
    LLMStandardHTML,
    smashTruncationStyle
} from "@/entrypoints/main/dom";
import { throttle } from "@/entrypoints/utils/common";
import { getMainDomain, replaceCompatFn } from "@/entrypoints/main/compat";
import { config } from "@/entrypoints/utils/config";
import { translateText, cancelAllTranslations } from '@/entrypoints/utils/translateApi';
import { findMainContent } from '@/entrypoints/utils/contentDetector';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier';
import { shouldTranslateText } from "@/entrypoints/utils/translationDirection";

let hoverTimer: any; // 鼠标悬停计时器
let htmlSet = new Set(); // 防抖
export let originalContents = new Map(); // 保存原始内容
let isAutoTranslating = false; // 控制是否继续翻译新内容
let observer: IntersectionObserver | null = null; // 保存观察器实例
let mutationObserver: MutationObserver | null = null; // 保存 DOM 变化观察器实例

// 使用自定义属性标记已翻译的节点
const TRANSLATED_ATTR = 'data-fr-translated';
const TRANSLATED_ID_ATTR = 'data-fr-node-id'; // 添加节点ID属性
const BILINGUAL_CONTENT_CLASS = 'only-translate-bilingual-content';
const DYNAMIC_MUTATION_ATTRIBUTES = ['class', 'style', 'hidden', 'aria-hidden', 'aria-expanded'];
const SUPPLEMENTAL_READING_CONFIDENCE = 0.72;

let nodeIdCounter = 0; // 节点ID计数器

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
    if (isManagedTranslationNode(root)) return [];
    if (!isInTranslationScope(root, contentRoot, scope)) return [];
    if (isOpenExpandableReadingContainer(root) && isVisibleForTranslation(root) && !root.hasAttribute(TRANSLATED_ATTR)) {
        return [root];
    }

    return grabAllNode(root, grabOptions).filter(
        node => !node.hasAttribute(TRANSLATED_ATTR) && !isManagedTranslationNode(node) && isVisibleForTranslation(node)
    );
}

export function resolveAutoTranslateTarget(scope: string): AutoTranslateTarget {
    if (scope === 'full') {
        const grabOptions: GrabAllNodeOptions = { siteCompatMode: 'full' };
        return {
            contentRoot: document.body,
            nodes: grabAllNode(document.body, grabOptions),
            grabOptions
        };
    }

    const contentRoot = findMainContent();
    const grabOptions: GrabAllNodeOptions = {
        contentFilter: getContentFilterDecision,
        contentUnitClassifier: classifyContentUnit,
        siteCompatMode: 'smart'
    };
    const filteredNodes = mergeTranslationNodes(normalizeTranslationTargets([
        ...grabAllNode(contentRoot, grabOptions),
        ...collectSupplementalReadingTargets(document.body)
    ]));

    if (filteredNodes.length > 0) {
        return {
            contentRoot,
            nodes: filteredNodes,
            grabOptions
        };
    }

    // 智能过滤没有结果时，兜底路径放松站点兼容层，只保留 full 模式下的安全跳过。
    // 否则部分站点的历史 smart 强规则仍会把正文挡掉，看起来像兜底没有生效。
    const fallbackOptions: GrabAllNodeOptions = { siteCompatMode: 'full' };
    const unfilteredRootNodes = grabAllNode(contentRoot, fallbackOptions);
    if (unfilteredRootNodes.length > 0) {
        return {
            contentRoot,
            nodes: unfilteredRootNodes,
            grabOptions: fallbackOptions
        };
    }

    return {
        contentRoot: document.body,
        nodes: contentRoot === document.body ? unfilteredRootNodes : grabAllNode(document.body, fallbackOptions),
        grabOptions: fallbackOptions
    };
}

function mergeTranslationNodes(nodes: Element[]): Element[] {
    const uniqueNodes = Array.from(new Set(nodes));
    return uniqueNodes.filter(node => {
        if (uniqueNodes.some(other => node !== other && isGitHubMarkdownListContainer(node) && isGitHubMarkdownListItemOf(other, node))) {
            return false;
        }

        return !uniqueNodes.some(other => {
            if (node === other || !other.contains(node)) return false;
            return !(isGitHubMarkdownListContainer(other) && isGitHubMarkdownListItemOf(node, other));
        });
    });
}

function normalizeTranslationTargets(nodes: Element[]): Element[] {
    return nodes.flatMap(node => {
        const githubMarkdownListItems = getGitHubMarkdownListItems(node, false);
        return githubMarkdownListItems.length > 0 ? githubMarkdownListItems : [node];
    });
}

function collectSupplementalReadingTargets(root: ParentNode): Element[] {
    return collectHighConfidenceReadingUnits(root)
        .flatMap(expandSupplementalReadingUnit)
        .filter(unit => isVisibleForTranslation(unit));
}

function expandSupplementalReadingUnit(unit: Element): Element[] {
    const githubMarkdownListItems = getGitHubMarkdownListItems(unit);
    if (githubMarkdownListItems.length > 0) return githubMarkdownListItems;

    if (isExpandableReadingContainer(unit) && !isOpenExpandableReadingContainer(unit)) return [];

    return [unit];
}

function getGitHubMarkdownListItems(unit: Element, includeDescendantLists = true): Element[] {
    if (getMainDomain(location.href) !== 'github.com') return [];
    if (!unit.closest('.markdown-body')) return [];
    if (unit.closest('pre, code, table.highlight, table.diff-table')) return [];

    const lists = unit.matches('ul, ol')
        ? [unit]
        : includeDescendantLists
            ? Array.from(unit.querySelectorAll<Element>('ul, ol'))
            : [];

    return lists.flatMap(list => Array.from(list.children))
        .filter(child => child.tagName.toLowerCase() === 'li')
        .filter(item => (item.textContent?.replace(/\s+/g, ' ').trim().length ?? 0) >= 20);
}

function isGitHubMarkdownListContainer(element: Element): boolean {
    return getMainDomain(location.href) === 'github.com'
        && element.matches('ul, ol')
        && Boolean(element.closest('.markdown-body'));
}

function isGitHubMarkdownListItemOf(item: Element, list: Element): boolean {
    return item.tagName.toLowerCase() === 'li'
        && item.parentElement === list
        && Boolean(item.closest('.markdown-body'));
}

function isExpandableReadingContainer(element: Element): boolean {
    return element.hasAttribute('aria-expanded')
        && element.getAttribute('role')?.toLowerCase() === 'button';
}

function isOpenExpandableReadingContainer(element: Element): boolean {
    return isExpandableReadingContainer(element) && element.getAttribute('aria-expanded') === 'true';
}

function isVisibleForTranslation(element: Element): boolean {
    let current: Element | null = element;

    while (current) {
        if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        try {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
                return false;
            }
        } catch (_) {}

        current = current.parentElement;
    }

    return true;
}

function isInTranslationScope(root: Element, contentRoot: Element, scope: string): boolean {
    if (scope === 'full' || contentRoot.contains(root)) return true;

    let current: Element | null = root;
    while (current && current !== document.body) {
        const decision = classifyContentUnit(current);
        if (decision.action === 'allow' && decision.confidence >= SUPPLEMENTAL_READING_CONFIDENCE) {
            return true;
        }
        current = current.parentElement;
    }

    return false;
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
            node.innerHTML = originalContent;
            node.removeAttribute(TRANSLATED_ATTR);
            node.removeAttribute(TRANSLATED_ID_ATTR);
            
            // 移除可能添加的翻译相关类
            node.classList.remove('only-translate-bilingual');
        }
    });
    
    // 2. 移除所有翻译内容元素
    document.querySelectorAll('.only-translate-bilingual-content').forEach(element => {
        element.remove();
    });
    
    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    document.querySelectorAll('.only-translate-loading, .only-translate-retry-wrapper').forEach(element => {
        element.remove();
    });
    
    // 4. 清空存储的原始内容
    originalContents.clear();
    
    // 5. 停止所有观察器
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    
    // 6. 重置所有翻译相关的状态
    isAutoTranslating = false;
    htmlSet.clear(); // 清空防抖集合
    nodeIdCounter = 0; // 重置节点ID计数器
    
    // 7. 消除可能存在的全局样式污染
    const tempStyleElements = document.querySelectorAll('style[data-fr-temp-style]');
    tempStyleElements.forEach(el => el.remove());
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage(scopeOverride?: string) {
    // 如果已经在翻译中，则返回
    if (isAutoTranslating) return;
    
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

    if (!nodes.length) return;

    isAutoTranslating = true;

    // 创建观察器
    observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && isAutoTranslating) {
                const node = entry.target as Element;

                // 去重
                if (node.hasAttribute(TRANSLATED_ATTR)) return;
                
                // 为节点分配唯一ID
                const nodeId = `fr-node-${nodeIdCounter++}`;
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
                observer.unobserve(node);
            }
        });
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1 // 只要出现10%就开始翻译
    });

    // 开始观察所有节点
    nodes.forEach(node => {
        observer?.observe(node);
    });

    const observeTranslationNodes = (nodes: Element[]) => {
        nodes.forEach(node => observer?.observe(node));
    };

    const pendingDynamicRoots = new Set<Element>();
    let dynamicScanTimer: number | null = null;

    const scheduleDynamicScan = (root: Element) => {
        if (isManagedTranslationNode(root)) return;
        if (!isInTranslationScope(root, contentRoot, scope)) return;

        pendingDynamicRoots.add(root);
        if (dynamicScanTimer !== null) return;

        dynamicScanTimer = window.setTimeout(() => {
            dynamicScanTimer = null;
            const roots = Array.from(pendingDynamicRoots);
            pendingDynamicRoots.clear();

            roots.forEach(scanRoot => {
                observeTranslationNodes(
                    collectDynamicTranslationNodes(scanRoot, contentRoot, scope, grabOptions)
                );
            });
        }, 80);
    };

    // 创建 MutationObserver 监听 DOM 变化
    mutationObserver = new MutationObserver((mutations) => {
        if (!isAutoTranslating) return;

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
    mutationObserver.observe(document.body, {
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

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {

        let node = grabNode(document.elementFromPoint(mouseX, mouseY));

        // 判断是否跳过节点
        if (skipNode(node)) return;

        // 防抖
        let nodeOuterHTML = node.outerHTML;
        if (htmlSet.has(nodeOuterHTML)) return;
        htmlSet.add(nodeOuterHTML);

        // 根据翻译模式进行翻译
        if (config.display === styles.bilingualTranslation) {
            handleBilingualTranslation(node, delayTime > 0);  // 根据 delayTime 可判断是否为滑动翻译
        } else {
            handleSingleTranslation(node, delayTime > 0);
        }
    }, delayTime);
}

// 双语翻译
export function handleBilingualTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    const originText = getTranslatableText(node);
    // 如果已经翻译过，250ms 后删除翻译结果
    let bilingualNode = searchClassName(node, 'only-translate-bilingual');
    if (bilingualNode) {
        if (slide) {
            htmlSet.delete(nodeOuterHTML);
            return;
        }
        let spinner = insertLoadingSpinner(bilingualNode as HTMLElement, true);
        setTimeout(() => {
            spinner.remove();
            const content = searchClassName(bilingualNode as HTMLElement, 'only-translate-bilingual-content');
            if (content && content instanceof HTMLElement) content.remove();
            (bilingualNode as HTMLElement).classList.remove('only-translate-bilingual');
            htmlSet.delete(nodeOuterHTML);
        }, 250);
        return;
    }

    // 检查是否有缓存
    let cached = cache.localGet(originText);
    if (cached) {
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, cached);
        }, 250);
        return;
    }

    // 翻译
    bilingualTranslate(node, nodeOuterHTML);
}

// 单语翻译
export function handleSingleTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    let outerHTMLCache = cache.localGet(node.outerHTML);


    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            if (fn) fn(node, outerHTMLCache);
            else node.outerHTML = outerHTMLCache;

        }, 250);
        return;
    }

    singleTranslate(node);
}


function bilingualTranslate(node: any, nodeOuterHTML: any) {
    const origin = getTranslatableText(node);
    if (!shouldTranslateText(origin)) return;

    if (!origin?.trim()) return;
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then((text: string) => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, text);
        })
        .catch((error: Error) => {
            spinner.remove();
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}


export function singleTranslate(node: any) {
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
            
            text = beautyHTML(text);
            
            if (!text || origin === text) return;
            
            let oldOuterHtml = node.outerHTML;
            node.innerHTML = text;
            let newOuterHtml = node.outerHTML;
            
            // 缓存翻译结果
            cache.localSetDual(oldOuterHtml, newOuterHtml);
            cache.set(htmlSet, newOuterHtml, 250);
            htmlSet.delete(oldOuterHtml);
        })
        .catch((error: Error) => {
            spinner.remove();
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
        });
}

export const handleBtnTranslation = throttle((node: any) => {
    let origin = node.innerText;
    let rs = cache.localGet(origin);
    if (rs) {
        node.innerText = rs;
        return;
    }

    config.count++ && storage.setItem('local:config', JSON.stringify(config));

    browser.runtime.sendMessage({ context: document.title, origin: origin })
        .then((text: string) => {
            cache.localSetDual(origin, text);
            node.innerText = text;
        }).catch((error: any) => console.error('调用失败:', error))
}, 250)


function bilingualAppendChild(node: any, text: string) {
    if (searchClassName(node, BILINGUAL_CONTENT_CLASS)) return;

    node.classList.add("only-translate-bilingual");
    let newNode = document.createElement("span");
    newNode.classList.add(BILINGUAL_CONTENT_CLASS);
    // find the style
    const style = options.styles.find(s => s.value === config.style && !s.disabled);
    if (style?.class) {
        newNode.classList.add(style.class);
    }
    newNode.append(text);
    smashTruncationStyle(node);
    getBilingualAppendTarget(node).appendChild(newNode);
}

function getBilingualAppendTarget(node: HTMLElement): HTMLElement {
    if (!isOpenExpandableReadingContainer(node)) return node;

    const candidates = Array.from(node.querySelectorAll<HTMLElement>(
        ':scope > *, :scope [class*="detail"], :scope [class*="content"], :scope [class*="body"], :scope p'
    ));
    const target = candidates
        .filter(candidate => isVisibleForTranslation(candidate))
        .find(candidate => {
            const text = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            return text.length >= 40 && /[.!?。！？]/.test(text);
        });

    return target ?? node;
}
