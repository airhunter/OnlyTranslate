/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_UNINSTALL_FEEDBACK_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
