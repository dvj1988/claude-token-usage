import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppSettings, PriceTable, UsageQuery } from '../shared/types'

const api: Api = {
  getMeta: () => ipcRenderer.invoke('data:getMeta'),
  refresh: () => ipcRenderer.invoke('data:refresh'),
  getUsage: (query: UsageQuery) => ipcRenderer.invoke('usage:get', query),
  getPrices: () => ipcRenderer.invoke('prices:get'),
  savePrices: (prices: PriceTable) => ipcRenderer.invoke('prices:save', prices),
  getDefaultPrices: (models: string[]) => ipcRenderer.invoke('prices:getDefaults', models),
  getSessionDetail: (sessionId: string) => ipcRenderer.invoke('session:getDetail', sessionId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  relaunchApp: () => ipcRenderer.invoke('app:relaunch')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback when context isolation is disabled)
  window.api = api
}
