import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mountNewApiComponent: vi.fn()
}))

vi.mock('@/entrypoints/utils/newApi', () => ({
  mountNewApiComponent: mocks.mountNewApiComponent
}))

import { setupOnboardingWidgets } from '@/entrypoints/content/onboardingSetup'

describe('onboarding setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts the New API onboarding widget by default', () => {
    setupOnboardingWidgets()

    expect(mocks.mountNewApiComponent).toHaveBeenCalledTimes(1)
  })

  it('can mount onboarding widgets through a provided New API mount function', () => {
    const mountNewApiComponent = vi.fn()

    setupOnboardingWidgets({ mountNewApiComponent })

    expect(mountNewApiComponent).toHaveBeenCalledTimes(1)
    expect(mocks.mountNewApiComponent).not.toHaveBeenCalled()
  })
})
