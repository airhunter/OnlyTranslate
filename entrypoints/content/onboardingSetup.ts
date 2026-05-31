import { mountNewApiComponent } from '@/entrypoints/utils/newApi';

export interface OnboardingWidgetOptions {
    mountNewApiComponent?: () => void;
}

export function setupOnboardingWidgets(options: OnboardingWidgetOptions = {}): void {
    const mountNewApi = options.mountNewApiComponent ?? mountNewApiComponent;
    mountNewApi();
}
