// Entry bundled into the inline pre-paint script by theme-boot.ts. Kept in
// its own file so the bundle contains exactly one side effect: this call.
import { bootTheme } from '../src/features/settings/theme-boot.ts'

bootTheme(window)
