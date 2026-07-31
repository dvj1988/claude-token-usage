import type { ModelRate } from '../shared/types'

// Anthropic public list prices (USD per million tokens).
// These are seeded once and then fully editable by the user; edits persist.
const FAMILY_RATES: Array<{ test: RegExp; rate: ModelRate }> = [
  {
    test: /opus/i,
    rate: {
      inputPerM: 5,
      outputPerM: 25,
      cacheWritePerM: 6.25,
      cacheWrite1hPerM: 6.25,
      cacheReadPerM: 0.5
    }
  },
  {
    test: /sonnet/i,
    rate: {
      inputPerM: 3,
      outputPerM: 15,
      cacheWritePerM: 3.75,
      cacheWrite1hPerM: 3.75,
      cacheReadPerM: 0.3
    }
  },
  {
    test: /haiku/i,
    rate: {
      inputPerM: 1,
      outputPerM: 5,
      cacheWritePerM: 1.25,
      cacheWrite1hPerM: 1.25,
      cacheReadPerM: 0.1
    }
  }
]

const ZERO_RATE: ModelRate = {
  inputPerM: 0,
  outputPerM: 0,
  cacheWritePerM: 0,
  cacheWrite1hPerM: 0,
  cacheReadPerM: 0
}

// Sonnet 5 launched at introductory pricing, through Aug 31, 2026; after that
// it reverts to standard Sonnet-family pricing (the /sonnet/i rate above).
const SONNET_5_INTRO_CUTOFF = Date.UTC(2026, 8, 1) // 2026-09-01T00:00:00Z
const SONNET_5_INTRO_RATE: ModelRate = {
  inputPerM: 2,
  outputPerM: 10,
  cacheWritePerM: 2.5,
  cacheWrite1hPerM: 2.5,
  cacheReadPerM: 0.2
}

export function defaultRateForModel(model: string): ModelRate {
  if (/sonnet-5(?:-|$)/i.test(model) && Date.now() < SONNET_5_INTRO_CUTOFF) {
    return { ...SONNET_5_INTRO_RATE }
  }
  for (const { test, rate } of FAMILY_RATES) {
    if (test.test(model)) return { ...rate }
  }
  // Local/unknown models (e.g. qwen3.6) start at zero for the user to fill in.
  return { ...ZERO_RATE }
}
