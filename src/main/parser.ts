import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join, basename, dirname, sep } from 'path'
import type { Entrypoint } from '../shared/types'

export interface UsageRecord {
  messageId: string | null
  projectPath: string
  sessionId: string
  title: string | null
  parentSessionId: string | null
  isSubagent: boolean
  model: string
  entrypoint: Entrypoint
  ts: number
  day: string
  input: number
  output: number
  cacheWrite: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  isEstimatedCompaction?: boolean
}

export interface ParseResult {
  records: UsageRecord[]
  models: string[]
  minDay: string | null
  maxDay: string | null
  fileCount: number
  claudeDir: string
}

export function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects')
}

function toLocalDay(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function decodeProjectPath(encoded: string): string {
  // Best-effort: "-Users-dvj-work-tm-repo" -> "/Users/dvj/work/tm-repo".
  // Lossy when real path segments contain dashes; the per-message `cwd`
  // field is preferred when available and overrides this.
  if (!encoded.startsWith('-')) return encoded
  return '/' + encoded.slice(1).split('-').join('/')
}

export async function walkJsonl(dir: string): Promise<string[]> {
  const out: string[] = []
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'memory') continue
      out.push(...(await walkJsonl(full)))
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      out.push(full)
    }
  }
  return out
}

interface FileContext {
  isSubagent: boolean
  parentSessionId: string | null
  encodedProject: string
}

function fileContext(filePath: string, root: string): FileContext {
  const rel = filePath.startsWith(root) ? filePath.slice(root.length + 1) : filePath
  const parts = rel.split(sep)
  const encodedProject = parts[0] ?? ''
  const isSubagent = parts.includes('subagents')
  let parentSessionId: string | null = null
  if (isSubagent) {
    // .../<encodedProject>/<sessionId>/subagents/agent-xxx.jsonl
    const idx = parts.indexOf('subagents')
    if (idx >= 1) parentSessionId = parts[idx - 1]
  }
  return { isSubagent, parentSessionId, encodedProject }
}

export async function parseAll(): Promise<ParseResult> {
  const root = getClaudeProjectsDir()
  const files = await walkJsonl(root)
  const records: UsageRecord[] = []
  const models = new Set<string>()
  // entrypoint per session id, learned from whichever file declares it
  const entrypointBySession = new Map<string, Entrypoint>()
  for (const file of files) {
    const ctx = fileContext(file, root)
    let content: string
    try {
      content = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    const lines = content.split('\n')
    let fileEntrypoint: Entrypoint | null = null
    let fileCwd: string | null = null
    let fileSessionId: string | null = basename(file).replace(/\.jsonl$/, '')
    let fileAiTitle: string | null = null
    let fileCustomTitle: string | null = null
    let latestModel: string | null = null

    const pending: UsageRecord[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let obj: any
      try {
        obj = JSON.parse(trimmed)
      } catch {
        continue
      }
      if (typeof obj.entrypoint === 'string') {
        fileEntrypoint = obj.entrypoint as Entrypoint
      }
      if (typeof obj.cwd === 'string' && obj.cwd) {
        fileCwd = obj.cwd
      }
      if (typeof obj.sessionId === 'string' && obj.sessionId) {
        fileSessionId = obj.sessionId
      }
      if (typeof obj.aiTitle === 'string' && obj.aiTitle) {
        fileAiTitle = obj.aiTitle
      }
      if (typeof obj.customTitle === 'string' && obj.customTitle) {
        fileCustomTitle = obj.customTitle
      }

      const tsRaw = obj.timestamp
      const ts = tsRaw ? Date.parse(tsRaw) : NaN
      const sessionId =
        typeof obj.sessionId === 'string' && obj.sessionId ? obj.sessionId : fileSessionId || 'unknown'

      if (obj.subtype === 'compact_boundary' && obj.compactMetadata && typeof obj.compactMetadata === 'object') {
        const input = Number(obj.compactMetadata.preTokens) || 0
        const output = Number(obj.compactMetadata.postTokens) || 0
        if (!Number.isNaN(ts) && latestModel && (input > 0 || output > 0)) {
          models.add(latestModel)
          pending.push({
            messageId: typeof obj.uuid === 'string' ? `compact:${obj.uuid}` : null,
            projectPath: '',
            sessionId,
            title: null,
            parentSessionId: ctx.parentSessionId,
            isSubagent: ctx.isSubagent,
            model: latestModel,
            entrypoint: 'unknown',
            ts,
            day: toLocalDay(ts),
            input,
            output,
            cacheWrite: 0,
            cacheWrite5m: 0,
            cacheWrite1h: 0,
            cacheRead: 0,
            isEstimatedCompaction: true
          })
        }
        continue
      }

      const message = obj.message
      const usage = message && typeof message === 'object' ? message.usage : undefined
      const model = message && typeof message === 'object' ? message.model : undefined
      if (!usage || typeof usage !== 'object') continue
      if (!model || typeof model !== 'string' || model === '<synthetic>') continue
      latestModel = model

      const messageId = typeof message.id === 'string' ? message.id : null
      if (Number.isNaN(ts)) continue

      const cacheCreation = usage.cache_creation ?? {}
      const cacheWriteTotal = Number(usage.cache_creation_input_tokens) || 0
      let cacheWrite5m = Number(cacheCreation.ephemeral_5m_input_tokens) || 0
      let cacheWrite1h = Number(cacheCreation.ephemeral_1h_input_tokens) || 0
      const missingCacheWrite = cacheWriteTotal - cacheWrite5m - cacheWrite1h
      if (missingCacheWrite > 0) cacheWrite5m += missingCacheWrite

      models.add(model)
      pending.push({
        messageId,
        projectPath: '',
        sessionId,
        title: null,
        parentSessionId: ctx.parentSessionId,
        isSubagent: ctx.isSubagent,
        model,
        entrypoint: 'unknown',
        ts,
        day: toLocalDay(ts),
        input: Number(usage.input_tokens) || 0,
        output: Number(usage.output_tokens) || 0,
        cacheWrite: cacheWrite5m + cacheWrite1h,
        cacheWrite5m,
        cacheWrite1h,
        cacheRead: Number(usage.cache_read_input_tokens) || 0
      })
    }

    const projectPath = fileCwd || decodeProjectPath(ctx.encodedProject)
    const entrypoint: Entrypoint = fileEntrypoint || 'unknown'
    const title = fileCustomTitle ?? fileAiTitle
    for (const rec of pending) {
      rec.projectPath = projectPath
      rec.entrypoint = entrypoint
      rec.title = title
    }
    // Remember entrypoint for the owning session so subagents can inherit it.
    if (fileEntrypoint) {
      if (!ctx.isSubagent) entrypointBySession.set(fileSessionId || '', fileEntrypoint)
    }
    records.push(...pending)
  }

  // Deduplicate split/streaming assistant responses after all file metadata is
  // attached. Keep the fullest usage row for each message.id because early
  // streaming rows can have output_tokens=0 while later rows contain the final
  // billable output.
  const dedupedRecords: UsageRecord[] = []
  const indexByMessageId = new Map<string, number>()
  for (const rec of records) {
    if (!rec.messageId) {
      dedupedRecords.push(rec)
      continue
    }
    const existingIndex = indexByMessageId.get(rec.messageId)
    if (existingIndex == null) {
      indexByMessageId.set(rec.messageId, dedupedRecords.length)
      dedupedRecords.push(rec)
      continue
    }
    const existing = dedupedRecords[existingIndex]
    const recScore = rec.input + rec.output + rec.cacheWrite + rec.cacheRead
    const existingScore = existing.input + existing.output + existing.cacheWrite + existing.cacheRead
    if (rec.output > existing.output || (rec.output === existing.output && recScore > existingScore)) {
      dedupedRecords[existingIndex] = rec
    }
  }

  // Resolve unknown entrypoints (mostly subagents) from their parent session.
  for (const rec of dedupedRecords) {
    if (rec.entrypoint !== 'unknown') continue
    const key = rec.parentSessionId || rec.sessionId
    const inherited = entrypointBySession.get(key)
    if (inherited) rec.entrypoint = inherited
  }

  let minDay: string | null = null
  let maxDay: string | null = null
  for (const rec of records) {
    if (minDay === null || rec.day < minDay) minDay = rec.day
    if (maxDay === null || rec.day > maxDay) maxDay = rec.day
  }

  return {
    records: dedupedRecords,
    models: Array.from(models).sort(),
    minDay,
    maxDay,
    fileCount: files.length,
    claudeDir: root
  }
}
