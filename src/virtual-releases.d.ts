declare module 'virtual:seshat-releases' {
  import type { ReleaseData } from './lib/releases'
  /** Generated from git history at build time by vite-plugins/release-notes.ts. */
  const data: ReleaseData
  export default data
}

interface ImportMetaEnv {
  /** package.json `version`, injected by vite.config.ts. */
  readonly VITE_APP_VERSION: string
}
