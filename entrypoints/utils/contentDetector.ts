// 自底向上打分找主内容区，思路借鉴 Readability.js

// class/id 正向关键词（乘以加分系数）
const POSITIVE_PATTERN = /\b(content|article|post|body|entry|text|story|blog|prose|readme|markdown|main)\b/i;
// class/id 负向关键词（乘以惩罚系数）
const NEGATIVE_PATTERN = /\b(nav|sidebar|footer|widget|menu|comment|banner|ad|promo|related|share|social|toc)\b/i;

// 参与向上传播的叶子内容节点（不含 li，li 在导航中太常见，是主要噪音）
const CONTENT_LEAF_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, pre, td';

// 候选容器最少要有这么多字才有意义
const MIN_TEXT_LENGTH = 100;
const MAX_PROMOTION_DEPTH = 4;

export function findMainContent(): Element {
    // 第一步：语义标签快速命中（只认非常明确的单个 article，不认 main）
    const semantic = findSemanticRoot();
    if (semantic) return semantic;

    // 第二步：可信的唯一 main。很多新闻 live page 没有唯一 article，
    // 但有明确 main，先命中它能避免在大型页面上做昂贵的全页打分。
    const main = findMainRoot();
    if (main) return main;

    // 第三步：自底向上文本密度评分
    const scored = findByBottomUpScore();
    if (scored) {
        const promoted = promoteToContentShell(scored);

        // 兜底校验：选中的区域文字量需达到 body 的 15%，否则说明没找对，回落到 body
        const bodyLen = document.body.textContent?.trim().length ?? 0;
        const promotedLen = getTextLength(promoted);
        if (bodyLen === 0 || promotedLen / bodyLen >= 0.15) return promoted;
    }

    return document.body;
}

// 只接受高置信度的语义根节点，避免把过宽的 <main> 当成内容区
function findSemanticRoot(): Element | null {
    const articles = Array.from(
        document.querySelectorAll<Element>('article, [role="article"]')
    );

    // 唯一的 article 才有意义；多个说明是列表页，不单独取
    if (articles.length !== 1) return null;

    const art = articles[0];
    if (
        getTextLength(art) >= MIN_TEXT_LENGTH
        && getLinkDensity(art) <= 0.45
        && !isLikelyNoise(art)
    ) {
        return art;
    }
    return null;
}

function findMainRoot(): Element | null {
    const mains = Array.from(
        document.querySelectorAll<Element>('main, [role="main"]')
    );

    if (mains.length !== 1) return null;

    const main = mains[0];
    if (
        getTextLength(main) >= MIN_TEXT_LENGTH * 2
        && getLinkDensity(main) <= 0.5
        && hasPrimaryHeading(main)
        && !isLikelyNoise(main)
    ) {
        return main;
    }

    return null;
}

function findByBottomUpScore(): Element | null {
    // 用 Map 累积每个候选容器的原始分
    const scores = new Map<Element, number>();

    const leaves = document.querySelectorAll<Element>(CONTENT_LEAF_SELECTOR);

    for (const leaf of leaves) {
        const text = leaf.textContent?.trim() ?? '';
        if (text.length < 10) continue;

        // 叶子节点的内容分：文本量 + 逗号数（逗号多 → 自然语言散文）
        const commas = (text.match(/[,，、]/g)?.length ?? 0);
        const leafScore = Math.min(1 + text.length / 100 + commas * 0.5, 5);

        // 传播给 parent（×1.0）和 grandparent（×0.5）
        const parent = leaf.parentElement;
        if (!parent || parent === document.body) continue;
        scores.set(parent, (scores.get(parent) ?? 0) + leafScore);

        const grandparent = parent.parentElement;
        if (!grandparent || grandparent === document.body) continue;
        scores.set(grandparent, (scores.get(grandparent) ?? 0) + leafScore * 0.5);

        const greatGrandparent = grandparent.parentElement;
        if (!greatGrandparent || greatGrandparent === document.body) continue;
        scores.set(greatGrandparent, (scores.get(greatGrandparent) ?? 0) + leafScore * 0.25);
    }

    if (scores.size === 0) return null;

    // 对每个候选者做链接密度修正 + class/id 加减分
    let best: Element | null = null;
    let bestScore = 0;

    for (const [el, raw] of scores) {
        if (getTextLength(el) < MIN_TEXT_LENGTH || isLikelyNoise(el)) continue;

        const linkDensity = getLinkDensity(el);

        // 链接密度越高，得分衰减越狠（导航区链接密度往往 > 0.5）
        let score = raw * Math.max(0.05, 1 - linkDensity * 2);

        score *= getClassWeight(el);
        score *= getTagWeight(el);

        if (score > bestScore) {
            bestScore = score;
            best = el;
        }
    }

    // 得分过低说明没有找到有说服力的内容区，回落到 body
    return bestScore > 2 ? best : null;
}

// 评分最高的节点常常只是正文段落容器。这里保守地向上提升到包含标题的文章外壳，
// 让标题、导语和正文一起被翻译，同时避免把导航、侧栏、推荐区带进来。
function promoteToContentShell(base: Element): Element {
    const baseLen = getTextLength(base);
    let best = base;
    let bestScore = 0;
    let current = base.parentElement;
    let depth = 0;

    while (current && current !== document.body && depth < MAX_PROMOTION_DEPTH) {
        depth += 1;

        const score = getPromotionScore(current, base, baseLen, depth);
        if (score > bestScore) {
            best = current;
            bestScore = score;
        }

        current = current.parentElement;
    }

    return best;
}

function getPromotionScore(candidate: Element, base: Element, baseLen: number, depth: number): number {
    if (!candidate.contains(base)) return 0;
    if (isLikelyNoise(candidate)) return 0;

    const candidateLen = getTextLength(candidate);
    if (candidateLen < baseLen) return 0;

    const extraText = candidateLen - baseLen;
    const textRatio = baseLen > 0 ? candidateLen / baseLen : Infinity;
    const linkDensity = getLinkDensity(candidate);

    // 候选外壳只允许比正文容器略宽。超出的文字太多，通常意味着带进了侧栏/推荐/评论。
    if (textRatio > 2.4 && extraText > 600) return 0;
    if (linkDensity > 0.35) return 0;
    if (candidate.querySelectorAll('article, [role="article"]').length > 1) return 0;

    const hasHeading = hasPrimaryHeading(candidate);
    const hasHeadingOutsideBase = hasPrimaryHeadingOutsideBase(candidate, base);
    const isSemanticShell = isSemanticContentShell(candidate);
    const hasPositiveHint = POSITIVE_PATTERN.test(getNodeHint(candidate));

    if (!hasHeading && !isSemanticShell && !hasPositiveHint) return 0;
    if (!hasHeadingOutsideBase && !isSemanticShell) return 0;

    let score = 1;
    if (hasHeadingOutsideBase) score += 4;
    if (isSemanticShell) score += 3;
    if (hasPositiveHint) score += 1.5;
    if (candidate.tagName.toLowerCase() === 'main') score += 1;

    score -= linkDensity * 6;
    score -= Math.max(0, textRatio - 1) * 0.8;
    score -= depth * 0.35;

    return score;
}

function isSemanticContentShell(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'article'
        || tag === 'main'
        || tag === 'section'
        || el.getAttribute('role') === 'article'
        || el.getAttribute('role') === 'main';
}

function hasPrimaryHeading(el: Element): boolean {
    return el.querySelector('h1, h2') !== null;
}

function hasPrimaryHeadingOutsideBase(candidate: Element, base: Element): boolean {
    return Array.from(candidate.querySelectorAll('h1, h2')).some((heading) => {
        if (base.contains(heading)) return false;
        if (isLikelyNoise(heading)) return false;

        const relation = heading.compareDocumentPosition(base);
        return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    });
}

function getTextLength(el: Element): number {
    return el.textContent?.replace(/\s+/g, ' ').trim().length ?? 0;
}

function getLinkDensity(el: Element): number {
    const textLen = getTextLength(el);
    if (textLen === 0) return 0;

    const linkLen = Array.from(el.querySelectorAll('a'))
        .reduce((sum, a) => sum + getTextLength(a), 0);
    return linkLen / textLen;
}

function getClassWeight(el: Element): number {
    const hint = getNodeHint(el);
    let weight = 1;
    if (POSITIVE_PATTERN.test(hint)) weight *= 1.5;
    if (NEGATIVE_PATTERN.test(hint)) weight *= 0.2;
    return weight;
}

function getTagWeight(el: Element): number {
    const tag = el.tagName.toLowerCase();
    if (tag === 'article') return 1.4;
    if (tag === 'main') return 1.25;
    if (tag === 'section') return 1.1;
    return 1;
}

function isLikelyNoise(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'nav' || tag === 'aside' || tag === 'footer') return true;
    if (el.getAttribute('role') === 'navigation' || el.getAttribute('aria-hidden') === 'true') return true;
    return NEGATIVE_PATTERN.test(getNodeHint(el));
}

function getNodeHint(el: Element): string {
    const className = typeof el.className === 'string' ? el.className : '';
    return `${className} ${el.id}`;
}
