import { collectDomTextUnits } from '@/entrypoints/main/translationTarget/unitizer';
import type { SiteProfile } from './types';

const EXERCISE_INSTRUCTIONS_SELECTOR = '#page-exercise-show section.instructions';
const SOURCE_SELECTOR = '.source';

export const exercismProfile: SiteProfile = {
    id: 'exercism',
    domains: ['exercism.org'],
    targetStrategy: 'profile-first',
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(EXERCISE_INSTRUCTIONS_SELECTOR))
            .flatMap(collectExerciseInstructionTargets);
    },
    preserveSupplementalTargets: true
};

function collectExerciseInstructionTargets(section: Element): Element[] {
    const children = Array.from(section.children);
    let instructionHeadingIndex = -1;
    for (let index = children.length - 1; index >= 0; index -= 1) {
        if (!children[index].matches('h2')) continue;
        instructionHeadingIndex = index;
        break;
    }
    if (instructionHeadingIndex < 0) return [];

    const instructionBlocks = children.slice(instructionHeadingIndex);
    const sourceIndex = instructionBlocks.findIndex(child => child.matches(SOURCE_SELECTOR));
    const boundedBlocks = sourceIndex >= 0
        ? instructionBlocks.slice(0, sourceIndex)
        : instructionBlocks;

    return boundedBlocks.flatMap(block => collectDomTextUnits(block));
}
