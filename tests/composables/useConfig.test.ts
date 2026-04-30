import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    service = 'microsoft'
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
    count = 0
    theme = 'auto'
    useCache = true
    disableFloatingBall = false
    floatingBallPosition = 'right'
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
    expect(config.value.service).toBe('microsoft')
    expect(config.value.theme).toBe('auto')
    expect(config.value.display).toBe(1)
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
})
