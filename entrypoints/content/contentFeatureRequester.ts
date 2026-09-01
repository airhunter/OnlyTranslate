import type {
  ContentFeature,
  ContentFeatureLoadResult,
  LoadContentFeatureMessage,
} from '@/entrypoints/utils/contentFeatureProtocol'

interface RuntimeLike {
  sendMessage(message: LoadContentFeatureMessage): Promise<ContentFeatureLoadResult>
}

export function createContentFeatureRequester(runtime: RuntimeLike) {
  const initialized = new Set<ContentFeature>()
  const pending = new Map<ContentFeature, Promise<void>>()

  const request = async (feature: ContentFeature, action?: unknown): Promise<void> => {
    if (action === undefined && initialized.has(feature)) return

    const existing = pending.get(feature)
    if (existing) {
      await existing
      if (action === undefined && initialized.has(feature)) return
    }

    const load = runtime.sendMessage({ type: 'LOAD_CONTENT_FEATURE', feature, action })
      .then(result => {
        if (!result?.success) throw new Error(result?.error || `Failed to load ${feature}`)
        initialized.add(feature)
      })

    pending.set(feature, load)
    try {
      await load
    } finally {
      if (pending.get(feature) === load) pending.delete(feature)
    }
  }

  return { request }
}
