import { fileURLToPath } from 'node:url'

// This adapter is the tool's integration point with the extension source tree.
export const extensionRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const collectorEntry = new URL('./onlytranslate.ts', import.meta.url)
