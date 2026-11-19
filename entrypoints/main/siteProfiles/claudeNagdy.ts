import type { SiteProfile } from './types';
import { getProseEvidence } from '@/entrypoints/utils/proseSignals';

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
    skipTarget: (node, context) => {
        const metadata = context.scope === 'smart' ? getCourseHeaderMetadata(node.ownerDocument) : null;
        if (metadata && (node === metadata || metadata.contains(node))) {
            return { policy: 'hard-skip', role: 'metadata', reason: 'claude-course-header-metadata' };
        }
        if (metadata && node.contains(metadata)) {
            return { policy: 'hard-skip', role: 'layout', reason: 'claude-course-header-layout' };
        }
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

// Explicit course-template adaptation; do not extend this to the entire nagdy.me domain.
function getCourseHeaderMetadata(document: Document): Element | null {
    if (location.hostname !== 'claude.nagdy.me' || !location.pathname.startsWith('/learn/')) return null;
    const heading = document.querySelector('main#main-content h1');
    const intro = heading?.nextElementSibling;
    const row = intro?.nextElementSibling;
    if (!intro?.matches('p') || !row?.matches('div') || row.parentElement !== heading?.parentElement) return null;
    const labels = Array.from(row.children);
    if (labels.length < 2 || labels.length > 3
        || labels.some(label => !label.matches('span') || (label.textContent?.trim().length ?? 0) > 40)) return null;
    if (row.querySelector('p, div, ul, ol, a, button, input, textarea, select')) return null;
    if (getProseEvidence(row).strength === 'strong') return null;
    if (!labels.some(label => label.classList.contains('rounded-full'))) return null;
    const duration = /^\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:min(?:ute)?s?|h(?:our)?s?)$/i;
    return labels.some(label => duration.test(label.textContent?.trim() ?? '')) ? row : null;
}

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
