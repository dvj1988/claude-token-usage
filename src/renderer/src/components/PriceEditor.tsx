import { useEffect, useMemo, useState } from 'react'
import type { ModelRate, PriceTable } from '../../../shared/types'

interface Props {
  prices: PriceTable
  models: string[]
  onSave: (next: PriceTable) => Promise<void>
}

const FIELDS: Array<{ key: keyof ModelRate; label: string }> = [
  { key: 'inputPerM', label: 'Input $/M' },
  { key: 'outputPerM', label: 'Output $/M' },
  { key: 'cacheWritePerM', label: 'Cache write 5m $/M' },
  { key: 'cacheWrite1hPerM', label: 'Cache write 1h $/M' },
  { key: 'cacheReadPerM', label: 'Cache read $/M' }
]

function emptyRate(): ModelRate {
  return { inputPerM: 0, outputPerM: 0, cacheWritePerM: 0, cacheWrite1hPerM: 0, cacheReadPerM: 0 }
}

export function PriceEditor({ prices, models, onSave }: Props) {
  const allModels = useMemo(() => {
    const set = new Set<string>([...models, ...Object.keys(prices)])
    return Array.from(set).sort()
  }, [models, prices])

  const [draft, setDraft] = useState<PriceTable>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const next: PriceTable = {}
    for (const m of allModels) next[m] = { ...(prices[m] ?? emptyRate()) }
    setDraft(next)
  }, [allModels, prices])

  const update = (model: string, key: keyof ModelRate, value: string): void => {
    setSaved(false)
    const n = Number(value)
    setDraft((prev) => ({
      ...prev,
      [model]: { ...(prev[model] ?? emptyRate()), [key]: Number.isFinite(n) && n >= 0 ? n : 0 }
    }))
  }

  const handleSave = async (): Promise<void> => {
    await onSave(draft)
    setSaved(true)
  }

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <h2>Model pricing</h2>
          <p className="muted">
            Rates are USD per million tokens. Edits are saved to disk and reused on next launch.
            Cache pricing matters: 1-hour cache writes are more expensive than 5-minute writes.
          </p>
        </div>
        <button className="primary" onClick={handleSave}>
          {saved ? 'Saved' : 'Save prices'}
        </button>
      </div>
      <table className="data-table price-table">
        <thead>
          <tr>
            <th>Model</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="num">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allModels.map((model) => (
            <tr key={model}>
              <td>{model}</td>
              {FIELDS.map((f) => (
                <td key={f.key} className="num">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft[model]?.[f.key] ?? 0}
                    onChange={(e) => update(model, f.key, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
          {allModels.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">
                No models discovered yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
