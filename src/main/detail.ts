import { promises as fs } from 'fs'
import { basename, dirname, join, sep } from 'path'
import type {
  Entrypoint,
  ModelAggregate,
  PriceTable,
  SessionDetail,
  SubagentDetail,
  TimelineItem,
  TokenTotals,
  ToolResultInfo,
  ToolUseInfo
} from '../shared/types'
import { getClaudeProjectsDir, walkJsonl } from './parser'
import { costFor } from './usage'

const MAX_TEXT = 8000

function clip(s: string): string {
  if (s.length <= MAX_TEXT) return s
  return s.slice(0, MAX_TEXT) + `\n... [truncated ${s.length - MAX_TEXT} chars]`
}

function emptyTokens(): TokenTotals {
  return { input: 0, output: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 }
}

function sumTokens(t: TokenTotals): number {
  return t.input + t.output + t.cacheWrite + t.cacheRead
}

function stringifyInput(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return clip(input)
  try {
    return clip(JSON.stringify(input, null, 2))
  } catch {
    return ''
  }
}

function resultToString(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return clip(content)
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const b of content) {
      if (typeof b === 'string') parts.push(b)
      else if (b && typeof b === 'object' && (b as any).type === 'text') parts.push((b as any).text ?? '')
      else parts.push(JSON.stringify(b))
    }
    return clip(parts.join('\n'))
  }
  try {
    return clip(JSON.stringify(content))
  } catch {
    return ''
  }
}

const FILE_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'EditNotebook',
  'StrReplace',
  'Delete'
])

interface FileParse {
  aiTitle: string | null
  customTitle: string | null
  projectPath: string
  gitBranch: string | null
  entrypoint: Entrypoint
  version: string | null
  permissionMode: string | null
  startTs: number
  endTs: number
  models: Set<string>
  tokens: TokenTotals
  byModel: Map<string, { messages: number; tokens: TokenTotals }>
  toolCounts: Map<string, number>
  filesTouched: Set<string>
  skills: Set<string>
  hookErrors: number
  userPromptCount: number
  assistantCount: number
  compactionCount: number
  messages: number
  timeline: TimelineItem[]
}

function addModelTokens(p: FileParse, model: string, tokens: TokenTotals, messages: number): void {
  p.models.add(model)
  p.tokens.input += tokens.input
  p.tokens.output += tokens.output
  p.tokens.cacheWrite += tokens.cacheWrite
  p.tokens.cacheWrite5m += tokens.cacheWrite5m
  p.tokens.cacheWrite1h += tokens.cacheWrite1h
  p.tokens.cacheRead += tokens.cacheRead
  let bm = p.byModel.get(model)
  if (!bm) {
    bm = { messages: 0, tokens: emptyTokens() }
    p.byModel.set(model, bm)
  }
  bm.messages += messages
  bm.tokens.input += tokens.input
  bm.tokens.output += tokens.output
  bm.tokens.cacheWrite += tokens.cacheWrite
  bm.tokens.cacheWrite5m += tokens.cacheWrite5m
  bm.tokens.cacheWrite1h += tokens.cacheWrite1h
  bm.tokens.cacheRead += tokens.cacheRead
}

async function parseFile(file: string, prices: PriceTable): Promise<FileParse | null> {
  let content: string
  try {
    content = await fs.readFile(file, 'utf8')
  } catch {
    return null
  }

  const p: FileParse = {
    aiTitle: null,
    customTitle: null,
    projectPath: '',
    gitBranch: null,
    entrypoint: 'unknown',
    version: null,
    permissionMode: null,
    startTs: 0,
    endTs: 0,
    models: new Set(),
    tokens: emptyTokens(),
    byModel: new Map(),
    toolCounts: new Map(),
    filesTouched: new Set(),
    skills: new Set(),
    hookErrors: 0,
    userPromptCount: 0,
    assistantCount: 0,
    compactionCount: 0,
    messages: 0,
    timeline: []
  }

  // One assistant response is split across multiple JSONL lines (thinking /
  // text / tool_use), each repeating the same message.id and full usage.
  // Count usage once per id, and merge those lines into a single timeline item.
  const seenUsageIds = new Set<string>()
  const itemIndexByMsgId = new Map<string, number>()
  const seenCompactionIds = new Set<string>()
  let latestModel: string | null = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let obj: any
    try {
      obj = JSON.parse(trimmed)
    } catch {
      continue
    }

    if (typeof obj.aiTitle === 'string' && obj.aiTitle) p.aiTitle = obj.aiTitle
    if (typeof obj.customTitle === 'string' && obj.customTitle) p.customTitle = obj.customTitle
    if (obj.gitBranch) p.gitBranch = obj.gitBranch
    if (obj.cwd) p.projectPath = obj.cwd
    if (obj.version) p.version = obj.version
    if (obj.permissionMode) p.permissionMode = obj.permissionMode
    if (typeof obj.entrypoint === 'string') p.entrypoint = obj.entrypoint
    if (typeof obj.attributionSkill === 'string' && obj.attributionSkill) p.skills.add(obj.attributionSkill)
    if (Array.isArray(obj.hookErrors)) p.hookErrors += obj.hookErrors.length

    const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN
    if (!Number.isNaN(ts)) {
      if (p.startTs === 0 || ts < p.startTs) p.startTs = ts
      if (ts > p.endTs) p.endTs = ts
    }

    const type = obj.type
    const m = obj.message
    if (obj.subtype === 'compact_boundary' && obj.compactMetadata && typeof obj.compactMetadata === 'object') {
      const compactionId = typeof obj.uuid === 'string' ? obj.uuid : `compact-${p.timeline.length}`
      if (seenCompactionIds.has(compactionId)) continue
      seenCompactionIds.add(compactionId)
      const input = Number(obj.compactMetadata.preTokens) || 0
      const output = Number(obj.compactMetadata.postTokens) || 0
      if (latestModel && (input > 0 || output > 0)) {
        const tokens = {
          input,
          output,
          cacheWrite: 0,
          cacheWrite5m: 0,
          cacheWrite1h: 0,
          cacheRead: 0
        }
        const cost = costFor(tokens, prices[latestModel]).total
        p.compactionCount += 1
        addModelTokens(p, latestModel, tokens, 0)
        p.timeline.push({
          uuid: compactionId,
          ts: Number.isNaN(ts) ? 0 : ts,
          type: 'compaction',
          role: 'compaction',
          text: `Estimated compaction (${obj.compactMetadata.trigger ?? 'unknown'}): preTokens treated as input, postTokens treated as output.`,
          thinking: null,
          model: latestModel,
          tools: [],
          toolResults: [],
          tokens,
          cost,
          isEstimatedCompaction: true
        })
      }
      continue
    }
    if ((type === 'user' || type === 'assistant') && m && typeof m === 'object') {
      const rawContent = m.content
      const blocks = Array.isArray(rawContent)
        ? rawContent
        : typeof rawContent === 'string'
          ? [{ type: 'text', text: rawContent }]
          : []

      let text = ''
      let thinking = ''
      const tools: ToolUseInfo[] = []
      const toolResults: ToolResultInfo[] = []

      for (const b of blocks) {
        if (!b || typeof b !== 'object') continue
        if (b.type === 'text') {
          text += (text ? '\n' : '') + (b.text ?? '')
        } else if (b.type === 'thinking') {
          thinking += (thinking ? '\n' : '') + (b.thinking ?? '')
        } else if (b.type === 'tool_use') {
          tools.push({ id: b.id ?? null, name: b.name ?? 'tool', input: stringifyInput(b.input) })
          p.toolCounts.set(b.name, (p.toolCounts.get(b.name) ?? 0) + 1)
          if (FILE_TOOLS.has(b.name) && b.input && typeof b.input === 'object') {
            const fp = b.input.file_path || b.input.path || b.input.target_notebook || b.input.notebook_path
            if (typeof fp === 'string') p.filesTouched.add(fp)
          }
        } else if (b.type === 'tool_result') {
          toolResults.push({
            toolUseId: b.tool_use_id ?? null,
            output: resultToString(b.content),
            isError: Boolean(b.is_error)
          })
        }
      }

      const model: string | null =
        typeof m.model === 'string' && m.model !== '<synthetic>' ? m.model : null
      if (model) latestModel = model
      const msgId: string | null = typeof m.id === 'string' ? m.id : null
      const firstForId = !msgId || !seenUsageIds.has(msgId)
      if (msgId) seenUsageIds.add(msgId)

      let tokens: TokenTotals | null = null
      let cost: number | null = null
      if (m.usage && typeof m.usage === 'object' && model && firstForId) {
        const cacheCreation = m.usage.cache_creation ?? {}
        const cacheWriteTotal = Number(m.usage.cache_creation_input_tokens) || 0
        let cacheWrite5m = Number(cacheCreation.ephemeral_5m_input_tokens) || 0
        let cacheWrite1h = Number(cacheCreation.ephemeral_1h_input_tokens) || 0
        const missingCacheWrite = cacheWriteTotal - cacheWrite5m - cacheWrite1h
        if (missingCacheWrite > 0) cacheWrite5m += missingCacheWrite
        tokens = {
          input: Number(m.usage.input_tokens) || 0,
          output: Number(m.usage.output_tokens) || 0,
          cacheWrite: cacheWrite5m + cacheWrite1h,
          cacheWrite5m,
          cacheWrite1h,
          cacheRead: Number(m.usage.cache_read_input_tokens) || 0
        }
        cost = costFor(tokens, prices[model]).total
        addModelTokens(p, model, tokens, 1)
      }

      // Skip empty filler entries (no text, tools, results, or thinking).
      if (!text && !thinking && tools.length === 0 && toolResults.length === 0) continue

      // Merge content blocks that belong to the same assistant response.
      if (msgId && itemIndexByMsgId.has(msgId)) {
        const existing = p.timeline[itemIndexByMsgId.get(msgId)!]
        if (text) existing.text = existing.text ? `${existing.text}\n${clip(text)}` : clip(text)
        if (thinking)
          existing.thinking = existing.thinking ? `${existing.thinking}\n${clip(thinking)}` : clip(thinking)
        existing.tools.push(...tools)
        existing.toolResults.push(...toolResults)
        continue
      }

      if (type === 'user' && text && !text.startsWith('<')) p.userPromptCount += 1
      if (type === 'assistant') p.assistantCount += 1
      p.messages += 1

      const item = {
        uuid: obj.uuid ?? String(p.timeline.length),
        ts: Number.isNaN(ts) ? 0 : ts,
        type,
        role: m.role ?? type,
        text: clip(text),
        thinking: thinking ? clip(thinking) : null,
        model,
        tools,
        toolResults,
        tokens,
        cost
      }
      p.timeline.push(item)
      if (msgId) itemIndexByMsgId.set(msgId, p.timeline.length - 1)
    }
  }

  return p
}

function buildByModel(byModel: Map<string, { messages: number; tokens: TokenTotals }>, prices: PriceTable): ModelAggregate[] {
  return Array.from(byModel.entries())
    .map(([model, v]) => ({
      model,
      messages: v.messages,
      tokens: v.tokens,
      totalTokens: sumTokens(v.tokens),
      cost: costFor(v.tokens, prices[model]).total
    }))
    .sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens)
}

async function locate(sessionId: string): Promise<{ mainFile: string | null; subagentFiles: string[] }> {
  const root = getClaudeProjectsDir()
  const files = await walkJsonl(root)
  let mainFile: string | null = null
  const subagentFiles: string[] = []
  const target = `${sessionId}.jsonl`
  for (const f of files) {
    const parts = f.split(sep)
    if (parts.includes('subagents')) {
      const idx = parts.indexOf('subagents')
      if (idx >= 1 && parts[idx - 1] === sessionId) subagentFiles.push(f)
    } else if (basename(f) === target) {
      mainFile = f
    }
  }
  return { mainFile, subagentFiles }
}

async function readSubagentMeta(file: string): Promise<{ agentType: string; description: string }> {
  const metaPath = join(dirname(file), basename(file).replace(/\.jsonl$/, '') + '.meta.json')
  try {
    const raw = await fs.readFile(metaPath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      agentType: parsed.agentType ?? 'Agent',
      description: parsed.description ?? ''
    }
  } catch {
    return { agentType: 'Agent', description: '' }
  }
}

export async function getSessionDetail(
  sessionId: string,
  prices: PriceTable
): Promise<SessionDetail | null> {
  const { mainFile, subagentFiles } = await locate(sessionId)
  if (!mainFile && subagentFiles.length === 0) return null

  const base = mainFile ? await parseFile(mainFile, prices) : null

  const subagents: SubagentDetail[] = []
  for (const sf of subagentFiles) {
    const parsed = await parseFile(sf, prices)
    if (!parsed) continue
    const meta = await readSubagentMeta(sf)
    const model = parsed.models.size > 0 ? Array.from(parsed.models)[0] : null
    subagents.push({
      agentType: meta.agentType,
      description: meta.description,
      model,
      messages: parsed.messages,
      tokens: parsed.tokens,
      totalTokens: sumTokens(parsed.tokens),
      cost: costFor(parsed.tokens, model ? prices[model] : undefined).total,
      timeline: parsed.timeline
    })
  }

  if (!base) {
    // Subagent-only fallback (rare).
    const tokens = emptyTokens()
    for (const s of subagents) {
      tokens.input += s.tokens.input
      tokens.output += s.tokens.output
      tokens.cacheWrite += s.tokens.cacheWrite
      tokens.cacheWrite5m += s.tokens.cacheWrite5m
      tokens.cacheWrite1h += s.tokens.cacheWrite1h
      tokens.cacheRead += s.tokens.cacheRead
    }
    return {
      sessionId,
      title: null,
      projectPath: '',
      gitBranch: null,
      entrypoint: 'unknown',
      version: null,
      permissionMode: null,
      startTs: 0,
      endTs: 0,
      durationMs: 0,
      models: [],
      tokens,
      totalTokens: sumTokens(tokens),
      cost: costFor(tokens, undefined),
      byModel: [],
      toolCounts: [],
      filesTouched: [],
      skills: [],
      hookErrors: 0,
      userPromptCount: 0,
      assistantCount: 0,
      compactionCount: 0,
      subagents,
      timeline: []
    }
  }

  // Roll up the dominant model's rate for the session cost breakdown by summing per-model costs.
  const costBreakdown = {
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
    total: 0
  }
  for (const [model, v] of base.byModel.entries()) {
    const c = costFor(v.tokens, prices[model])
    costBreakdown.input += c.input
    costBreakdown.output += c.output
    costBreakdown.cacheWrite += c.cacheWrite
    costBreakdown.cacheWrite5m += c.cacheWrite5m
    costBreakdown.cacheWrite1h += c.cacheWrite1h
    costBreakdown.cacheRead += c.cacheRead
    costBreakdown.total += c.total
  }

  const toolCounts = Array.from(base.toolCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    sessionId,
    title: base.customTitle ?? base.aiTitle,
    projectPath: base.projectPath,
    gitBranch: base.gitBranch,
    entrypoint: base.entrypoint,
    version: base.version,
    permissionMode: base.permissionMode,
    startTs: base.startTs,
    endTs: base.endTs,
    durationMs: base.endTs > base.startTs ? base.endTs - base.startTs : 0,
    models: Array.from(base.models).sort(),
    tokens: base.tokens,
    totalTokens: sumTokens(base.tokens),
    cost: costBreakdown,
    byModel: buildByModel(base.byModel, prices),
    toolCounts,
    filesTouched: Array.from(base.filesTouched).sort(),
    skills: Array.from(base.skills).sort(),
    hookErrors: base.hookErrors,
    userPromptCount: base.userPromptCount,
    assistantCount: base.assistantCount,
    compactionCount: base.compactionCount,
    subagents,
    timeline: base.timeline
  }
}
