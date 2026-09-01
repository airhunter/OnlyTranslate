export const contentFeatures = ['page', 'floating', 'selection', 'input', 'video', 'onboarding'] as const

export type ContentFeature = typeof contentFeatures[number]

export interface LoadContentFeatureMessage {
  type: 'LOAD_CONTENT_FEATURE'
  feature: ContentFeature
  action?: unknown
}

export interface ContentFeatureActionMessage {
  type: 'CONTENT_FEATURE_ACTION'
  feature: ContentFeature
  action: unknown
}

export interface ContentFeatureLoadResult {
  success: boolean
  error?: string
}

export function isLoadContentFeatureMessage(message: unknown): message is LoadContentFeatureMessage {
  if (!message || typeof message !== 'object') return false
  const candidate = message as Partial<LoadContentFeatureMessage>
  return candidate.type === 'LOAD_CONTENT_FEATURE'
    && contentFeatures.includes(candidate.feature as ContentFeature)
}
