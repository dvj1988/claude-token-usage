import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ModelRate, PriceTable } from '../shared/types'
import { defaultRateForModel } from './defaults'

function pricesPath(): string {
  return join(app.getPath('userData'), 'prices.json')
}

function sanitizeRate(model: string, raw: any): ModelRate {
  const num = (v: any): number => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const defaults = defaultRateForModel(model)
  return {
    inputPerM: raw?.inputPerM == null ? defaults.inputPerM : num(raw.inputPerM),
    outputPerM: raw?.outputPerM == null ? defaults.outputPerM : num(raw.outputPerM),
    cacheWritePerM:
      raw?.cacheWritePerM == null ? defaults.cacheWritePerM : num(raw.cacheWritePerM),
    cacheWrite1hPerM:
      raw?.cacheWrite1hPerM == null ? defaults.cacheWrite1hPerM : num(raw.cacheWrite1hPerM),
    cacheReadPerM: raw?.cacheReadPerM == null ? defaults.cacheReadPerM : num(raw.cacheReadPerM)
  }
}

export async function loadPrices(): Promise<PriceTable> {
  try {
    const content = await fs.readFile(pricesPath(), 'utf8')
    const parsed = JSON.parse(content)
    const table: PriceTable = {}
    for (const [model, rate] of Object.entries(parsed ?? {})) {
      table[model] = sanitizeRate(model, rate)
    }
    return table
  } catch {
    return {}
  }
}

export async function savePrices(prices: PriceTable): Promise<PriceTable> {
  const table: PriceTable = {}
  for (const [model, rate] of Object.entries(prices ?? {})) {
    table[model] = sanitizeRate(model, rate)
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(pricesPath(), JSON.stringify(table, null, 2), 'utf8')
  return table
}

// Merge stored prices with defaults for any models we just discovered that
// are not yet present. Stored (user-edited) values always win.
export async function ensurePricesForModels(models: string[]): Promise<PriceTable> {
  const stored = await loadPrices()
  let changed = false
  for (const model of models) {
    if (!stored[model]) {
      stored[model] = defaultRateForModel(model)
      changed = true
    } else if ((stored[model] as any).cacheWrite1hPerM == null) {
      stored[model] = sanitizeRate(model, stored[model])
      changed = true
    }
  }
  if (changed) await savePrices(stored)
  return stored
}
