import { useMemo, useState } from 'react'
import type { SessionModelRow } from '../../../shared/types'
import { formatCompact, formatDate, formatNumber, formatUSD, projectName } from '../format'

interface Props {
  rows: SessionModelRow[]
  foldSubagents: boolean
  onSelect?: (sessionId: string) => void
}

type SortKey =
  | 'entrypoint'
  | 'input'
  | 'output'
  | 'cacheWrite'
  | 'cacheRead'
  | 'totalTokens'
  | 'cost'
  | 'date'

export function SessionTable({ rows, foldSubagents, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [asc, setAsc] = useState(false)
  const [filter, setFilter] = useState('')

  const sorted = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const filtered = f
      ? rows.filter(
          (r) =>
            r.models.some((model) => model.toLowerCase().includes(f)) ||
            (r.title?.toLowerCase().includes(f) ?? false) ||
            r.projectPath.toLowerCase().includes(f) ||
            r.sessionId.toLowerCase().includes(f) ||
            r.entrypoint.toLowerCase().includes(f)
        )
      : rows
    const get = (r: SessionModelRow): number | string => {
      switch (sortKey) {
        case 'entrypoint':
          return r.entrypoint
        case 'input':
          return r.tokens.input
        case 'output':
          return r.tokens.output
        case 'cacheWrite':
          return r.tokens.cacheWrite
        case 'cacheRead':
          return r.tokens.cacheRead
        case 'totalTokens':
          return r.totalTokens
        case 'cost':
          return r.cost.total
        case 'date':
          return r.lastTs
      }
    }
    return [...filtered].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      let cmp: number
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv)
      else cmp = (av as number) - (bv as number)
      return asc ? cmp : -cmp
    })
  }, [rows, sortKey, asc, filter])

  const onSort = (key: SortKey): void => {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  const arrow = (key: SortKey): string => (key === sortKey ? (asc ? ' ▲' : ' ▼') : '')

  return (
    <section className="panel wide session-panel">
      <div className="panel-head">
        <h2>
          Sessions{' '}
          <span className="muted">
            ({sorted.length} {foldSubagents ? 'sessions' : 'rows incl. sub-agents'})
          </span>
        </h2>
        <input
          className="search"
          placeholder="Filter by project, model, session."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Session</th>
              <th onClick={() => onSort('entrypoint')} className="sortable">
                Source{arrow('entrypoint')}
              </th>
              <th>Models</th>
              <th onClick={() => onSort('input')} className="sortable num">
                Input{arrow('input')}
              </th>
              <th onClick={() => onSort('output')} className="sortable num">
                Output{arrow('output')}
              </th>
              <th onClick={() => onSort('cacheWrite')} className="sortable num">
                Cache W{arrow('cacheWrite')}
              </th>
              <th onClick={() => onSort('cacheRead')} className="sortable num">
                Cache R{arrow('cacheRead')}
              </th>
              <th onClick={() => onSort('totalTokens')} className="sortable num">
                Total{arrow('totalTokens')}
              </th>
              <th onClick={() => onSort('date')} className="sortable num">
                Last active{arrow('date')}
              </th>
              <th onClick={() => onSort('cost')} className="sortable num">
                Cost{arrow('cost')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.sessionId + (r.isSubagent ? 's' : 'm') + i}
                className={onSelect ? 'clickable' : ''}
                onClick={() => onSelect?.(r.sessionId)}
              >
                <td className="session-title-cell" title={`${r.title || 'Session detail'}\n${r.projectPath}\n${r.sessionId}`}>
                  <div className="session-title">{r.title || 'Session detail'}</div>
                  <div className="session-subtitle">
                    {projectName(r.projectPath)} <span className="mono">{r.shortSessionId}</span>
                  </div>
                </td>
                <td>
                  <span className={`pill ${r.entrypoint}`}>{r.entrypoint}</span>
                  {r.isSubagent && <span className="pill sub">sub-agent</span>}
                </td>
                <td>
                  <div className="model-list">
                    {r.models.map((model) => (
                      <span key={model} className="pill model">
                        {model}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="num">{formatCompact(r.tokens.input)}</td>
                <td className="num">{formatCompact(r.tokens.output)}</td>
                <td className="num">{formatCompact(r.tokens.cacheWrite)}</td>
                <td className="num">{formatCompact(r.tokens.cacheRead)}</td>
                <td className="num" title={formatNumber(r.totalTokens)}>
                  {formatCompact(r.totalTokens)}
                </td>
                <td className="num">{formatDate(r.lastTs)}</td>
                <td className="num strong">{formatUSD(r.cost.total)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  No sessions in range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
