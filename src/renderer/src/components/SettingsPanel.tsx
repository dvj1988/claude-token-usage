import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import type { AppSettings, ModelRate, PriceTable } from '../../../shared/types'

interface Props {
  settings: AppSettings
  effectiveClaudeDir: string
  prices: PriceTable
  models: string[]
  onSaveSettings: (next: AppSettings) => Promise<{ warning: string | null }>
  onSavePrices: (next: PriceTable) => Promise<void>
}

export interface SettingsPanelHandle {
  savePricesDraft: () => Promise<void>
  saveFolderDraft: () => Promise<void>
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

export const SettingsPanel = forwardRef<SettingsPanelHandle, Props>(function SettingsPanel(
  { settings, effectiveClaudeDir, prices, models, onSaveSettings, onSavePrices },
  ref
) {
  const allModels = useMemo(() => {
    const set = new Set<string>([...models, ...Object.keys(prices)])
    return Array.from(set).sort()
  }, [models, prices])

  const [draft, setDraft] = useState<PriceTable>({})
  const [saved, setSaved] = useState(false)
  const [folderDraft, setFolderDraft] = useState(settings.claudeDataDir ?? '')
  const [folderWarning, setFolderWarning] = useState<string | null>(null)
  const [folderSaving, setFolderSaving] = useState(false)

  useEffect(() => {
    const next: PriceTable = {}
    for (const m of allModels) next[m] = { ...(prices[m] ?? emptyRate()) }
    setDraft(next)
  }, [allModels, prices])

  useEffect(() => {
    setFolderDraft(settings.claudeDataDir ?? '')
  }, [settings.claudeDataDir])

  const update = (model: string, key: keyof ModelRate, value: string): void => {
    setSaved(false)
    const n = Number(value)
    setDraft((prev) => ({
      ...prev,
      [model]: { ...(prev[model] ?? emptyRate()), [key]: Number.isFinite(n) && n >= 0 ? n : 0 }
    }))
  }

  const handleSavePrices = async (): Promise<void> => {
    try {
      await onSavePrices(draft)
      setSaved(true)
    } catch {
      // App-level error banner already surfaces this; nothing else to do here.
    }
  }

  useImperativeHandle(ref, () => ({
    savePricesDraft: handleSavePrices,
    saveFolderDraft: handleSaveFolder
  }))

  const handleBrowse = async (): Promise<void> => {
    const picked = await window.api.pickFolder()
    if (picked) setFolderDraft(picked)
  }

  const handleSaveFolder = async (): Promise<void> => {
    setFolderSaving(true)
    setFolderWarning(null)
    try {
      const result = await onSaveSettings({ ...settings, claudeDataDir: folderDraft.trim() || null })
      setFolderWarning(result.warning)
    } catch (e) {
      setFolderWarning(String(e))
    } finally {
      setFolderSaving(false)
    }
  }

  return (
    <div className="settings-panel">
      <section className="panel wide">
        <div className="panel-head">
          <div>
            <h2>Claude data folder</h2>
            <p className="muted">
              Where session transcripts are read from. Leave blank to use the default.
            </p>
          </div>
        </div>
        <div className="field folder-field">
          <input
            type="text"
            placeholder={effectiveClaudeDir}
            value={folderDraft}
            onChange={(e) => setFolderDraft(e.target.value)}
          />
          <button onClick={handleBrowse}>Browse</button>
          <button className="primary" onClick={handleSaveFolder} disabled={folderSaving}>
            {folderSaving ? 'Saving.' : 'Save & Rescan'}
          </button>
        </div>
        {folderWarning && <div className="banner error">{folderWarning}</div>}
      </section>

      <section className="panel wide">
        <div className="panel-head">
          <div>
            <h2>Model pricing</h2>
            <p className="muted">
              Rates are USD per million tokens. Edits are saved to disk and reused on next launch.
              Cache pricing matters: 1-hour cache writes are more expensive than 5-minute writes.
            </p>
          </div>
          <button className="primary" onClick={handleSavePrices}>
            {saved ? 'Saved' : 'Save prices'}
          </button>
        </div>
        <div className="panel-table-scroll">
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
        </div>
      </section>
    </div>
  )
})
