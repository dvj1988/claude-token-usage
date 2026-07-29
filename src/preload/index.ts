import { contextBridge, ipcRenderer } from 'electron'
import type { Api, PriceTable, UsageQuery } from '../shared/types'

const api: Api = {
  getMeta: () => ipcRenderer.invoke('data:getMeta'),
  refresh: () => ipcRenderer.invoke('data:refresh'),
  getUsage: (query: UsageQuery) => ipcRenderer.invoke('usage:get', query),
  getPrices: () => ipcRenderer.invoke('prices:get'),
  savePrices: (prices: PriceTable) => ipcRenderer.invoke('prices:save', prices),
  getSessionDetail: (sessionId: string) => ipcRenderer.invoke('session:getDetail', sessionId)
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
