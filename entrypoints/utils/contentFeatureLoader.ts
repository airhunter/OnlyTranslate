import {
  isLoadContentFeatureMessage,
  type ContentFeature,
  type ContentFeatureActionMessage,
  type ContentFeatureLoadResult,
} from './contentFeatureProtocol'

interface ContentFeatureAssets {
  js: string
  css?: string
}

const featureScripts: Record<ContentFeature, ContentFeatureAssets> = {
  page: {
    js: 'content-scripts/page-runtime.js',
    css: 'content-scripts/page-runtime.css',
  },
  floating: {
    js: 'content-scripts/floating-runtime.js',
    css: 'content-scripts/floating-runtime.css',
  },
  selection: { js: 'content-scripts/selection-runtime.js' },
  input: { js: 'content-scripts/input-runtime.js' },
  video: { js: 'content-scripts/video-runtime.js' },
  onboarding: { js: 'content-scripts/onboarding-runtime.js' },
}

interface FeatureSender {
  tab?: { id?: number }
  frameId?: number
}

interface ScriptingLike {
  executeScript(options: any): Promise<unknown>
  insertCSS(options: any): Promise<void>
}

interface TabsLike {
  sendMessage(
    tabId: number,
    message: ContentFeatureActionMessage,
    options: { frameId: number }
  ): Promise<unknown>
}

export async function loadContentFeatureForSender(
  message: unknown,
  sender: FeatureSender,
  scripting: ScriptingLike,
  tabs: TabsLike,
  loadedTargets: Map<string, Promise<void>> = new Map(),
): Promise<ContentFeatureLoadResult | undefined> {
  if (!isLoadContentFeatureMessage(message)) return undefined

  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') {
    return { success: false, error: 'Content feature requests require a sender tab' }
  }

  const frameId = typeof sender.frameId === 'number' ? sender.frameId : 0
  const targetKey = `${tabId}:${frameId}:${message.feature}`
  try {
    let load = loadedTargets.get(targetKey)
    if (!load) {
      const assets = featureScripts[message.feature]
      load = (async () => {
        if (assets.css) {
          await scripting.insertCSS({
            target: { tabId, frameIds: [frameId] },
            files: [assets.css],
          })
        }

        await scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          files: [assets.js],
        })
      })()
      loadedTargets.set(targetKey, load)
    }

    try {
      await load
    } catch (error) {
      if (loadedTargets.get(targetKey) === load) loadedTargets.delete(targetKey)
      throw error
    }

    if (message.action !== undefined) {
      await tabs.sendMessage(tabId, {
        type: 'CONTENT_FEATURE_ACTION',
        feature: message.feature,
        action: message.action
      }, { frameId })
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function forgetLoadedContentFeatures(
  loadedTargets: Map<string, Promise<void>>,
  tabId: number,
): void {
  const prefix = `${tabId}:`
  for (const target of loadedTargets.keys()) {
    if (target.startsWith(prefix)) loadedTargets.delete(target)
  }
}

export const contentFeatureScriptPaths = featureScripts
