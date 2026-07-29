export type Entrypoint = 'cli' | 'claude-desktop' | 'unknown'

export interface ModelRate {
  inputPerM: number
  outputPerM: number
  cacheWritePerM: number
  cacheWrite1hPerM: number
  cacheReadPerM: number
}

export type PriceTable = Record<string, ModelRate>

export interface TokenTotals {
  input: number
  output: number
  cacheWrite: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
}

export interface CostBreakdown {
  input: number
  output: number
  cacheWrite: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  total: number
}

export interface SessionModelRow {
  sessionId: string
  shortSessionId: string
  title: string | null
  projectPath: string
  entrypoint: Entrypoint
  models: string[]
  isSubagent: boolean
  messages: number
  tokens: TokenTotals
  totalTokens: number
  cost: CostBreakdown
  firstTs: number
  lastTs: number
}

export interface ModelAggregate {
  model: string
  messages: number
  tokens: TokenTotals
  totalTokens: number
  cost: number
}

export interface DayAggregate {
  day: string
  totalTokens: number
  cost: number
  tokens: TokenTotals
}

export interface UsageTotals {
  sessions: number
  messages: number
  tokens: TokenTotals
  totalTokens: number
  cost: number
}

export interface UsageResult {
  sessionRows: SessionModelRow[]
  byModel: ModelAggregate[]
  byDay: DayAggregate[]
  totals: UsageTotals
}

export interface DataMeta {
  models: string[]
  minDay: string | null
  maxDay: string | null
  fileCount: number
  recordCount: number
  parsedAt: number
  claudeDir: string
}

export interface UsageQuery {
  startDate?: string | null
  endDate?: string | null
  foldSubagents: boolean
}

export interface ToolUseInfo {
  id: string | null
  name: string
  input: string
}

export interface ToolResultInfo {
  toolUseId: string | null
  output: string
  isError: boolean
}

export interface TimelineItem {
  uuid: string
  ts: number
  type: string
  role: string
  text: string
  thinking: string | null
  model: string | null
  tools: ToolUseInfo[]
  toolResults: ToolResultInfo[]
  tokens: TokenTotals | null
  cost: number | null
  isEstimatedCompaction?: boolean
}

export interface SubagentDetail {
  agentType: string
  description: string
  model: string | null
  messages: number
  tokens: TokenTotals
  totalTokens: number
  cost: number
  timeline: TimelineItem[]
}

export interface SessionDetail {
  sessionId: string
  title: string | null
  projectPath: string
  gitBranch: string | null
  entrypoint: Entrypoint
  version: string | null
  permissionMode: string | null
  startTs: number
  endTs: number
  durationMs: number
  models: string[]
  tokens: TokenTotals
  totalTokens: number
  cost: CostBreakdown
  byModel: ModelAggregate[]
  toolCounts: { name: string; count: number }[]
  filesTouched: string[]
  skills: string[]
  hookErrors: number
  userPromptCount: number
  assistantCount: number
  compactionCount: number
  subagents: SubagentDetail[]
  timeline: TimelineItem[]
}

export interface Api {
  getMeta: () => Promise<DataMeta>
  refresh: () => Promise<DataMeta>
  getUsage: (query: UsageQuery) => Promise<UsageResult>
  getPrices: () => Promise<PriceTable>
  savePrices: (prices: PriceTable) => Promise<PriceTable>
  getSessionDetail: (sessionId: string) => Promise<SessionDetail | null>
}
