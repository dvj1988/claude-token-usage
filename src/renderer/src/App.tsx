import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings, DataMeta, PriceTable, UsageQuery, UsageResult } from '../../shared/types'
import { SummaryCards } from './components/SummaryCards'
import { Aggregates } from './components/Aggregates'
import { SessionTable } from './components/SessionTable'
import { SettingsPanel } from './components/SettingsPanel'
import { Onboarding } from './components/Onboarding'
import { Toolbar } from './components/Toolbar'
import { SessionDetail } from './components/SessionDetail'

type Tab = 'dashboard' | 'settings'

export default function App() {
  const [meta, setMeta] = useState<DataMeta | null>(null)
  const [usage, setUsage] = useState<UsageResult | null>(null)
  const [prices, setPrices] = useState<PriceTable>({})
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [foldSubagents, setFoldSubagents] = useState(true)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  const query: UsageQuery = useMemo(
    () => ({
      startDate: startDate || null,
      endDate: endDate || null,
      foldSubagents
    }),
    [startDate, endDate, foldSubagents]
  )

  const loadUsage = useCallback(async (q: UsageQuery) => {
    try {
      const result = await window.api.getUsage(q)
      setUsage(result)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [m, p, s] = await Promise.all([
          window.api.getMeta(),
          window.api.getPrices(),
          window.api.getSettings()
        ])
        if (cancelled) return
        setMeta(m)
        setPrices(p)
        setSettings(s)
        setStartDate(m.minDay ?? '')
        setEndDate(m.maxDay ?? '')
        await loadUsage({ startDate: m.minDay ?? null, endDate: m.maxDay ?? null, foldSubagents: true })
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadUsage])

  useEffect(() => {
    if (!meta) return
    loadUsage(query)
  }, [query, meta, loadUsage])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const m = await window.api.refresh()
      const p = await window.api.getPrices()
      setMeta(m)
      setPrices(p)
      await loadUsage(query)
    } catch (e) {
      setError(String(e))
    } finally {
      setRefreshing(false)
    }
  }, [query, loadUsage])

  const handleSavePrices = useCallback(
    async (next: PriceTable) => {
      const saved = await window.api.savePrices(next)
      setPrices(saved)
      await loadUsage(query)
    },
    [query, loadUsage]
  )

  const handleSaveSettings = useCallback(
    async (next: AppSettings): Promise<{ warning: string | null }> => {
      const { settings: saved, warning } = await window.api.saveSettings(next)
      setSettings(saved)
      const m = await window.api.refresh()
      const p = await window.api.getPrices()
      setMeta(m)
      setPrices(p)
      await loadUsage(query)
      return { warning }
    },
    [query, loadUsage]
  )

  const handleCompleteOnboarding = useCallback(async (): Promise<void> => {
    const current = await window.api.getSettings()
    const { settings: saved } = await window.api.saveSettings({ ...current, onboarded: true })
    setSettings(saved)
  }, [])

  if (!loading && settings && !settings.onboarded) {
    return (
      <Onboarding
        settings={settings}
        effectiveClaudeDir={meta?.claudeDir ?? ''}
        prices={prices}
        models={meta?.models ?? []}
        onSaveSettings={handleSaveSettings}
        onSavePrices={handleSavePrices}
        onComplete={handleCompleteOnboarding}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">CT</div>
          <div>
            <h1>Claude Token Usage</h1>
            <p className="subtitle">
              {meta
                ? `${meta.recordCount.toLocaleString()} messages across ${meta.fileCount} session files`
                : 'Scanning ~/.claude/projects'}
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
            Dashboard
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            Settings
          </button>
          <button className="refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing.' : 'Refresh'}
          </button>
        </nav>
      </header>

      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <div className="loading">Loading usage data.</div>
      ) : tab === 'dashboard' ? (
        <main className="content">
          <Toolbar
            startDate={startDate}
            endDate={endDate}
            minDay={meta?.minDay ?? ''}
            maxDay={meta?.maxDay ?? ''}
            foldSubagents={foldSubagents}
            onStartDate={setStartDate}
            onEndDate={setEndDate}
            onFoldSubagents={setFoldSubagents}
          />
          {usage && (
            <>
              <SummaryCards totals={usage.totals} />
              <Aggregates byModel={usage.byModel} byDay={usage.byDay} />
              <SessionTable
                rows={usage.sessionRows}
                foldSubagents={foldSubagents}
                onSelect={setSelectedSession}
              />
            </>
          )}
        </main>
      ) : settings ? (
        <main className="content">
          <SettingsPanel
            settings={settings}
            effectiveClaudeDir={meta?.claudeDir ?? ''}
            prices={prices}
            models={meta?.models ?? []}
            onSaveSettings={handleSaveSettings}
            onSavePrices={handleSavePrices}
          />
        </main>
      ) : null}

      {selectedSession && (
        <SessionDetail sessionId={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  )
}
