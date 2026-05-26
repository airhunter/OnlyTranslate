import type { SiteProfile } from './types';

const LEARNING_ASIDE_SELECTOR = 'main#main-content aside';
const LEARNING_ASIDE_TARGET_SELECTOR = [
    'section > h2',
    'section > h3',
    'section > h4',
    'section li',
    'section p',
    '.rounded-lg > div > h3'
].join(', ');

export const claudeNagdyProfile: SiteProfile = {
    id: 'claude-nagdy',
    domains: ['nagdy.me'],
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(LEARNING_ASIDE_SELECTOR))
            .flatMap(aside => Array.from(aside.querySelectorAll<Element>(LEARNING_ASIDE_TARGET_SELECTOR)))
            .filter(isReadableLearningAsideTarget)
            .filter((node, index, list) => list.indexOf(node) === index);
    },
    allowTarget: (node) => {
        if (!isReadableLearningAsideTarget(node)) return false;

        return {
            target: node,
            role: inferLearningAsideRole(node),
            reason: 'claude-nagdy-learning-aside'
        };
    },
    skipTarget: (node) => {
        if (isLearningPageLayoutContainer(node)) {
            return {
                policy: 'hard-skip',
                role: 'ui',
                reason: 'claude-nagdy-learning-layout-container'
            };
        }

        if (!node.closest(LEARNING_ASIDE_SELECTOR)) return false;
        if (isReadableLearningAsideTarget(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'claude-nagdy-learning-aside-container'
        };
    }
};

function isLearningPageLayoutContainer(node: Element): boolean {
    if (!node.matches('main#main-content, main#main-content *')) return false;
    return Boolean(node.querySelector(LEARNING_ASIDE_SELECTOR));
}

function isReadableLearningAsideTarget(node: Element): boolean {
    if (!node.closest(LEARNING_ASIDE_SELECTOR)) return false;
    if (node.closest('[role="application"], [role="tablist"], [role="radiogroup"], button')) return false;

    const tag = node.tagName.toLowerCase();
    if (!['h2', 'h3', 'h4', 'li', 'p'].includes(tag)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text.length < 3) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (/^(showing\b|question \d+\b|\d+%$)/i.test(text)) return false;

    return true;
}

function inferLearningAsideRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    return 'paragraph';
}
