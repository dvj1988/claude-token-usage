import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { DataMeta, PriceTable, UsageQuery } from '../shared/types'
import { parseAll, type ParseResult } from './parser'
import { ensurePricesForModels, loadPrices, savePrices } from './prices'
import { computeUsage } from './usage'
import { getSessionDetail } from './detail'

let cache: ParseResult | null = null

async function ensureData(force = false): Promise<ParseResult> {
  if (!cache || force) {
    cache = await parseAll()
    // Seed any newly-discovered models with default prices.
    await ensurePricesForModels(cache.models)
  }
  return cache
}

function toMeta(result: ParseResult): DataMeta {
  return {
    models: result.models,
    minDay: result.minDay,
    maxDay: result.maxDay,
    fileCount: result.fileCount,
    recordCount: result.records.length,
    parsedAt: Date.now(),
    claudeDir: result.claudeDir
  }
}

function registerIpc(): void {
  ipcMain.handle('data:getMeta', async (): Promise<DataMeta> => {
    return toMeta(await ensureData())
  })

  ipcMain.handle('data:refresh', async (): Promise<DataMeta> => {
    return toMeta(await ensureData(true))
  })

  ipcMain.handle('usage:get', async (_e, query: UsageQuery) => {
    const data = await ensureData()
    const prices = await loadPrices()
    return computeUsage(data.records, prices, query)
  })

  ipcMain.handle('prices:get', async (): Promise<PriceTable> => {
    return loadPrices()
  })

  ipcMain.handle('prices:save', async (_e, prices: PriceTable): Promise<PriceTable> => {
    return savePrices(prices)
  })

  ipcMain.handle('session:getDetail', async (_e, sessionId: string) => {
    const prices = await loadPrices()
    return getSessionDetail(sessionId, prices)
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Claude Token Usage',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
