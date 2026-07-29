import { useRef, useState } from 'react'
import type { AppSettings, PriceTable } from '../../../shared/types'
import { SettingsPanel, type SettingsPanelHandle } from './SettingsPanel'

interface Props {
  settings: AppSettings
  effectiveClaudeDir: string
  prices: PriceTable
  models: string[]
  onSaveSettings: (next: AppSettings) => Promise<{ warning: string | null }>
  onSavePrices: (next: PriceTable) => Promise<void>
  onComplete: () => Promise<void>
}

export function Onboarding({
  settings,
  effectiveClaudeDir,
  prices,
  models,
  onSaveSettings,
  onSavePrices,
  onComplete
}: Props) {
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const panelRef = useRef<SettingsPanelHandle>(null)

  const handleGetStarted = async (): Promise<void> => {
    setStarting(true)
    setStartError(null)
    try {
      await panelRef.current?.savePricesDraft()
      await panelRef.current?.saveFolderDraft()
      await onComplete()
    } catch (e) {
      setStartError(String(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div>
          <h1>Welcome to Claude Token Usage</h1>
          <p className="onboarding-intro">
            Confirm your model pricing and Claude data folder below, then get started. You can
            change these anytime from the Settings tab.
          </p>
        </div>
        <SettingsPanel
          ref={panelRef}
          settings={settings}
          effectiveClaudeDir={effectiveClaudeDir}
          prices={prices}
          models={models}
          onSaveSettings={onSaveSettings}
          onSavePrices={onSavePrices}
        />
        <div className="onboarding-actions">
          {startError && <div className="banner error">{startError}</div>}
          <button className="primary" onClick={handleGetStarted} disabled={starting}>
            {starting ? 'Starting.' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  )
}
