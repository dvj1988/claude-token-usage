import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AppSettings, SaveSettingsResult } from '../shared/types'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

const DEFAULT_SETTINGS: AppSettings = { onboarded: false, claudeDataDir: null }

export async function loadSettings(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(content)
    return {
      onboarded: Boolean(parsed?.onboarded),
      claudeDataDir:
        typeof parsed?.claudeDataDir === 'string' && parsed.claudeDataDir ? parsed.claudeDataDir : null
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<SaveSettingsResult> {
  const next: AppSettings = {
    onboarded: Boolean(settings?.onboarded),
    claudeDataDir:
      typeof settings?.claudeDataDir === 'string' && settings.claudeDataDir ? settings.claudeDataDir : null
  }

  let warning: string | null = null
  if (next.claudeDataDir) {
    try {
      const stat = await fs.stat(next.claudeDataDir)
      if (!stat.isDirectory()) warning = `Not a folder: ${next.claudeDataDir}`
    } catch {
      warning = `Folder not found: ${next.claudeDataDir}`
    }
  }

  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return { settings: next, warning }
}
