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
      cacheWrite1hPerM: 10,
      cacheReadPerM: 0.5
    }
  },
  {
    test: /sonnet/i,
    rate: {
      inputPerM: 3,
      outputPerM: 15,
      cacheWritePerM: 3.75,
      cacheWrite1hPerM: 6,
      cacheReadPerM: 0.3
    }
  },
  {
    test: /haiku/i,
    rate: {
      inputPerM: 1,
      outputPerM: 5,
      cacheWritePerM: 1.25,
      cacheWrite1hPerM: 2,
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

export function defaultRateForModel(model: string): ModelRate {
  for (const { test, rate } of FAMILY_RATES) {
    if (test.test(model)) return { ...rate }
  }
  // Local/unknown models (e.g. qwen3.6) start at zero for the user to fill in.
  return { ...ZERO_RATE }
}
