import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useConfig } from '../../composables/useConfig'

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: vi.fn(),
    watch: vi.fn(),
    setItem: vi.fn()
  }
}))

vi.mock('../../entrypoints/utils/model', () => ({
  Config: class Config {
    on = true
    autoTranslate = false
    from = 'en'
    to = 'zh'
    hotkey = 'Alt+W'
    style = 1
    display = 1
    service = 'google'
    token = {}
    ak = ''
    sk = ''
    appid = ''
    key = ''
    model = {}
    customModel = {}
    proxy = {}
    custom = ''
    extra = {}
    robot_id = {}
    system_role = {}
    user_role = {}
    thinking = {}
    count = 0
    theme = 'auto'
    useCache = true
    disableFloatingBall = false
    floatingBallPosition = 'right'
    floatingBallOffsetY = null
    floatingBallHotkey = 'Alt+T'
    customFloatingBallHotkey = ''
    customHotkey = ''
    disableSelectionTranslator = false
    deeplx = ''
    selectionTranslatorMode = 'bilingual'
    newApiUrl = 'http://localhost:3000'
    maxConcurrentTranslations = 6
    youdaoAppKey = ''
    youdaoAppSecret = ''
    tencentSecretId = ''
    tencentSecretKey = ''
    azureOpenaiEndpoint = ''
    animations = true
    bidirectionalTranslation = false
    bidirectionalTarget = 'en'
    inputBoxTranslationTrigger = 'disabled'
    inputBoxTranslationTarget = 'en'
    enableVideoSubtitle = true
  }
}))

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a config ref with default Config values', () => {
    const { config } = useConfig()
    expect(config.value.on).toBe(true)
    expect(config.value.service).toBe('google')
    expect(config.value.theme).toBe('auto')
    expect(config.value.display).toBe(1)
    expect(config.value.thinking).toEqual({})
  })

  it('loadConfig parses and applies stored config', async () => {
    const { config, loadConfig } = useConfig()
    const { storage } = await import('@wxt-dev/storage')
    
    const storedConfig = {
      on: false,
      service: 'openai',
      theme: 'dark',
      to: 'fr'
    }
    
    vi.mocked(storage.getItem).mockResolvedValue(JSON.stringify(storedConfig))
    
    await loadConfig()
    
    expect(config.value.on).toBe(false)
    expect(config.value.service).toBe('openai')
    expect(config.value.theme).toBe('dark')
    expect(config.value.to).toBe('fr')
  })

  it('serializes rapid edits so an explicit save persists the latest prompt', async () => {
    const { config, saveConfig } = useConfig()
    const { storage } = await import('@wxt-dev/storage')
    const snapshots: string[] = []
    let releaseFirstWrite!: () => void
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve
    })

    vi.mocked(storage.setItem).mockImplementation(async (_key, value) => {
      snapshots.push(String(value))
      if (snapshots.length === 1) await firstWriteBlocked
    })

    config.value.system_role.openai = 'first edit'
    await nextTick()
    config.value.system_role.openai = 'latest edit'
    await nextTick()

    const savePromise = saveConfig()
    await Promise.resolve()
    expect(snapshots).toHaveLength(1)

    releaseFirstWrite()
    await savePromise

    expect(JSON.parse(snapshots.at(-1)!).system_role.openai).toBe('latest edit')
  })
})
