import { initVideoSubtitle } from '@/entrypoints/video/manager';

export function setupVideoSubtitle(init: () => void = initVideoSubtitle): void {
    init();
}
