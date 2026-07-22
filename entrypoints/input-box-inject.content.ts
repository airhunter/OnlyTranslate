import { installInputBoxMainWorldBridge } from '@/entrypoints/content/inputBoxMainWorldBridge'

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installInputBoxMainWorldBridge(window, document)
  }
})
