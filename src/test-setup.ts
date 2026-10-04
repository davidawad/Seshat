import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// findBy*/waitFor default to 1s. The suite runs ~100 files in parallel with
// coverage instrumentation, and lazily imported chunks (the command palette's
// cmdk) can take longer than that to arrive under load — a flake, not a bug.
// Generous, because a passing wait returns immediately; only a real failure
// pays the full timeout.
configure({ asyncUtilTimeout: 10_000 })
