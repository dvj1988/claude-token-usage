import type {
  CostBreakdown,
  DayAggregate,
  ModelAggregate,
  ModelRate,
  PriceTable,
  SessionModelRow,
  TokenTotals,
  UsageQuery,
  UsageResult,
  UsageTotals
} from '../shared/types'
import type { UsageRecord } from './parser'

function emptyTokens(): TokenTotals {
  return { input: 0, output: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 }
}

function addTokens(target: TokenTotals, rec: UsageRecord): void {
  target.input += rec.input
  target.output += rec.output
  target.cacheWrite += rec.cacheWrite
  target.cacheWrite5m += rec.cacheWrite5m
  target.cacheWrite1h += rec.cacheWrite1h
  target.cacheRead += rec.cacheRead
}

function sumTokens(t: TokenTotals): number {
  return t.input + t.output + t.cacheWrite + t.cacheRead
}

export function costFor(t: TokenTotals, rate: ModelRate | undefined): CostBreakdown {
  const r: ModelRate = rate ?? {
    inputPerM: 0,
    outputPerM: 0,
    cacheWritePerM: 0,
    cacheWrite1hPerM: 0,
    cacheReadPerM: 0
  }
  const input = (t.input * r.inputPerM) / 1_000_000
  const output = (t.output * r.outputPerM) / 1_000_000
  const splitCacheWrite = t.cacheWrite5m !== undefined || t.cacheWrite1h !== undefined
  const cacheWrite5mTokens = splitCacheWrite ? t.cacheWrite5m || 0 : t.cacheWrite
  const cacheWrite1hTokens = splitCacheWrite ? t.cacheWrite1h || 0 : 0
  const cacheWrite5m = (cacheWrite5mTokens * r.cacheWritePerM) / 1_000_000
  const cacheWrite1h = (cacheWrite1hTokens * r.cacheWrite1hPerM) / 1_000_000
  const cacheWrite = cacheWrite5m + cacheWrite1h
  const cacheRead = (t.cacheRead * r.cacheReadPerM) / 1_000_000
  return {
    input,
    output,
    cacheWrite,
    cacheWrite5m,
    cacheWrite1h,
    cacheRead,
    total: input + output + cacheWrite + cacheRead
  }
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

interface SessionAccumulator {
  sessionId: string
  title: string | null
  projectPath: string
  entrypoint: SessionModelRow['entrypoint']
  models: Set<string>
  isSubagent: boolean
  messages: number
  tokens: TokenTotals
  cost: CostBreakdown
  firstTs: number
  lastTs: number
}

function emptyCost(): CostBreakdown {
  return { input: 0, output: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, total: 0 }
}

function addCost(target: CostBreakdown, source: CostBreakdown): void {
  target.input += source.input
  target.output += source.output
  target.cacheWrite += source.cacheWrite
  target.cacheWrite5m += source.cacheWrite5m
  target.cacheWrite1h += source.cacheWrite1h
  target.cacheRead += source.cacheRead
  target.total += source.total
}

export function computeUsage(
  records: UsageRecord[],
  prices: PriceTable,
  query: UsageQuery
): UsageResult {
  const { startDate, endDate, foldSubagents } = query

  const sessionMap = new Map<string, SessionAccumulator>()
  const modelMap = new Map<string, { messages: number; tokens: TokenTotals }>()
  const dayMap = new Map<string, TokenTotals>()

  for (const rec of records) {
    if (startDate && rec.day < startDate) continue
    if (endDate && rec.day > endDate) continue

    const effectiveSessionId =
      foldSubagents && rec.isSubagent ? rec.parentSessionId || rec.sessionId : rec.sessionId
    const rowIsSubagent = foldSubagents ? false : rec.isSubagent

    const sessionKey = `${effectiveSessionId}__${rowIsSubagent ? 'sub' : 'main'}`
    let acc = sessionMap.get(sessionKey)
    if (!acc) {
      acc = {
        sessionId: effectiveSessionId,
        title: rec.title,
        projectPath: rec.projectPath,
        entrypoint: rec.entrypoint,
        models: new Set<string>(),
        isSubagent: rowIsSubagent,
        messages: 0,
        tokens: emptyTokens(),
        cost: emptyCost(),
        firstTs: rec.ts,
        lastTs: rec.ts
      }
      sessionMap.set(sessionKey, acc)
    }
    acc.models.add(rec.model)
    if (!rec.isEstimatedCompaction) acc.messages += 1
    addTokens(acc.tokens, rec)
    addCost(
      acc.cost,
      costFor(
        {
          input: rec.input,
          output: rec.output,
          cacheWrite: rec.cacheWrite,
          cacheWrite5m: rec.cacheWrite5m,
          cacheWrite1h: rec.cacheWrite1h,
          cacheRead: rec.cacheRead
        },
        prices[rec.model]
      )
    )
    if (rec.ts < acc.firstTs) acc.firstTs = rec.ts
    if (rec.ts > acc.lastTs) acc.lastTs = rec.ts
    if (!acc.title && rec.title) acc.title = rec.title
    if (acc.entrypoint === 'unknown' && rec.entrypoint !== 'unknown') acc.entrypoint = rec.entrypoint

    let m = modelMap.get(rec.model)
    if (!m) {
      m = { messages: 0, tokens: emptyTokens() }
      modelMap.set(rec.model, m)
    }
    if (!rec.isEstimatedCompaction) m.messages += 1
    addTokens(m.tokens, rec)

    let d = dayMap.get(rec.day)
    if (!d) {
      d = emptyTokens()
      dayMap.set(rec.day, d)
    }
    addTokens(d, rec)
  }

  const sessionRows: SessionModelRow[] = Array.from(sessionMap.values()).map((acc) => {
    return {
      sessionId: acc.sessionId,
      shortSessionId: shortId(acc.sessionId),
      title: acc.title,
      projectPath: acc.projectPath,
      entrypoint: acc.entrypoint,
      models: Array.from(acc.models).sort(),
      isSubagent: acc.isSubagent,
      messages: acc.messages,
      tokens: acc.tokens,
      totalTokens: sumTokens(acc.tokens),
      cost: acc.cost,
      firstTs: acc.firstTs,
      lastTs: acc.lastTs
    }
  })
  sessionRows.sort((a, b) => b.lastTs - a.lastTs)

  const byModel: ModelAggregate[] = Array.from(modelMap.entries())
    .map(([model, v]) => ({
      model,
      messages: v.messages,
      tokens: v.tokens,
      totalTokens: sumTokens(v.tokens),
      cost: costFor(v.tokens, prices[model]).total
    }))
    .sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens)

  const byDay: DayAggregate[] = Array.from(dayMap.entries())
    .map(([day, tokens]) => {
      // Day cost requires per-model split; recompute below instead.
      return { day, tokens, totalTokens: sumTokens(tokens), cost: 0 }
    })
    .sort((a, b) => a.day.localeCompare(b.day))

  // Per-day cost needs per-model rates, so recompute from records directly.
  const dayCost = new Map<string, number>()
  for (const rec of records) {
    if (startDate && rec.day < startDate) continue
    if (endDate && rec.day > endDate) continue
    const c = costFor(
      {
        input: rec.input,
        output: rec.output,
        cacheWrite: rec.cacheWrite,
            cacheWrite5m: rec.cacheWrite5m,
            cacheWrite1h: rec.cacheWrite1h,
        cacheRead: rec.cacheRead
      },
      prices[rec.model]
    ).total
    dayCost.set(rec.day, (dayCost.get(rec.day) ?? 0) + c)
  }
  for (const d of byDay) d.cost = dayCost.get(d.day) ?? 0

  const totalsTokens = emptyTokens()
  let totalCost = 0
  let totalMessages = 0
  for (const m of byModel) {
    totalsTokens.input += m.tokens.input
    totalsTokens.output += m.tokens.output
    totalsTokens.cacheWrite += m.tokens.cacheWrite
    totalsTokens.cacheWrite5m += m.tokens.cacheWrite5m
    totalsTokens.cacheWrite1h += m.tokens.cacheWrite1h
    totalsTokens.cacheRead += m.tokens.cacheRead
    totalCost += m.cost
    totalMessages += m.messages
  }

  const uniqueSessions = new Set(sessionRows.map((r) => r.sessionId)).size

  const totals: UsageTotals = {
    sessions: uniqueSessions,
    messages: totalMessages,
    tokens: totalsTokens,
    totalTokens: sumTokens(totalsTokens),
    cost: totalCost
  }

  return { sessionRows, byModel, byDay, totals }
}
