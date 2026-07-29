import { useCallback, useEffect, useState } from 'react'
import type { SessionDetail as Detail, TimelineItem } from '../../../shared/types'
import { formatCompact, formatDuration, formatNumber, formatTime, formatUSD, projectName } from '../format'

interface Props {
  sessionId: string
  onClose: () => void
}

export function SessionDetail({ sessionId, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(120)

  const loadDetail = useCallback((opts?: { clearExisting?: boolean }) => {
    let cancelled = false
    const clearExisting = opts?.clearExisting ?? false
    if (clearExisting) {
      setLoading(true)
      setDetail(null)
      setVisible(120)
    } else {
      setRefreshing(true)
    }
    setError(null)
    window.api
      .getSessionDetail(sessionId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => {
    return loadDetail({ clearExisting: true })
  }, [loadDetail])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>{detail?.title || 'Session detail'}</h2>
            <div className="mono muted">{sessionId}</div>
          </div>
          <div className="drawer-actions">
            <button className="refresh-detail" onClick={() => loadDetail()} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing.' : 'Refresh'}
            </button>
            <button className="close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {loading && <div className="loading">Loading session.</div>}
        {error && <div className="banner error">{error}</div>}

        {detail && (
          <div className="drawer-body">
            <div className="chips">
              <Chip label="Project" value={projectName(detail.projectPath)} title={detail.projectPath} />
              {detail.gitBranch && <Chip label="Branch" value={detail.gitBranch} />}
              <Chip label="Source" value={detail.entrypoint} />
              {detail.version && <Chip label="CC version" value={detail.version} />}
              <Chip label="Duration" value={formatDuration(detail.durationMs)} />
              <Chip label="Started" value={formatTime(detail.startTs)} />
              <Chip label="Prompts" value={String(detail.userPromptCount)} />
              <Chip label="Assistant msgs" value={String(detail.assistantCount)} />
              {detail.compactionCount > 0 && <Chip label="Compactions" value={String(detail.compactionCount)} />}
            </div>

            <div className="detail-cards">
              <div className="card cost">
                <div className="card-label">Session cost</div>
                <div className="card-value">{formatUSD(detail.cost.total)}</div>
                <div className="card-sub">
                  in {formatUSD(detail.cost.input)} / out {formatUSD(detail.cost.output)} / cache{' '}
                  {formatUSD(detail.cost.cacheWrite + detail.cost.cacheRead)} (write 5m{' '}
                  {formatUSD(detail.cost.cacheWrite5m)}, write 1h {formatUSD(detail.cost.cacheWrite1h)})
                </div>
              </div>
              <div className="card">
                <div className="card-label">Total tokens</div>
                <div className="card-value">{formatCompact(detail.totalTokens)}</div>
                <div className="card-sub">
                  In {formatCompact(detail.tokens.input)} / Out {formatCompact(detail.tokens.output)} / CW{' '}
                  {formatCompact(detail.tokens.cacheWrite)} (5m {formatCompact(detail.tokens.cacheWrite5m)}, 1h{' '}
                  {formatCompact(detail.tokens.cacheWrite1h)}) / CR {formatCompact(detail.tokens.cacheRead)}
                </div>
              </div>
            </div>

            {detail.byModel.length > 0 && (
              <Section title="Cost by model">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th className="num">Msgs</th>
                      <th className="num">Total tokens</th>
                      <th className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.byModel.map((m) => (
                      <tr key={m.model}>
                        <td>{m.model}</td>
                        <td className="num">{m.messages.toLocaleString()}</td>
                        <td className="num">{formatCompact(m.totalTokens)}</td>
                        <td className="num strong">{formatUSD(m.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            <Section title={`Tool usage (${detail.toolCounts.reduce((a, t) => a + t.count, 0)} calls)`}>
              {detail.toolCounts.length === 0 ? (
                <div className="muted">No tool calls</div>
              ) : (
                <div className="chips">
                  {detail.toolCounts.map((t) => (
                    <span key={t.name} className="pill tool">
                      {t.name} <b>{t.count}</b>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {detail.skills.length > 0 && (
              <Section title="Skills used">
                <div className="chips">
                  {detail.skills.map((s) => (
                    <span key={s} className="pill skill">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {detail.filesTouched.length > 0 && (
              <Section title={`Files touched (${detail.filesTouched.length})`}>
                <ul className="file-list">
                  {detail.filesTouched.map((f) => (
                    <li key={f} className="mono">
                      {f}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {detail.subagents.length > 0 && (
              <Section title={`Sub-agents (${detail.subagents.length})`}>
                <div className="subagents">
                  {detail.subagents.map((s, i) => (
                    <div key={i} className="subagent">
                      <div className="subagent-head">
                        <span className="pill sub">{s.agentType}</span>
                        <span className="subagent-desc">{s.description || '(no description)'}</span>
                        <span className="subagent-cost">{formatUSD(s.cost)}</span>
                      </div>
                      <div className="muted small">
                        {s.model ?? 'unknown model'} · {s.messages} msgs ·{' '}
                        {formatCompact(s.totalTokens)} tokens
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title={`Timeline (${detail.timeline.length} events)`}>
              <div className="timeline">
                {detail.timeline.slice(0, visible).map((item) => (
                  <TimelineRow key={item.uuid} item={item} />
                ))}
              </div>
              {visible < detail.timeline.length && (
                <button className="load-more" onClick={() => setVisible((v) => v + 200)}>
                  Show more ({detail.timeline.length - visible} remaining)
                </button>
              )}
            </Section>
          </div>
        )}
      </aside>
    </div>
  )
}

function Chip({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="chip" title={title}>
      <span className="chip-label">{label}</span>
      <span className="chip-value">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const [showThinking, setShowThinking] = useState(false)
  const isUser = item.type === 'user'
  const isCompaction = item.isEstimatedCompaction
  return (
    <div className={`tl-item ${isUser ? 'user' : isCompaction ? 'compaction' : 'assistant'}`}>
      <div className="tl-meta">
        <span className={`tl-role ${isCompaction ? 'compaction' : item.type}`}>
          {isUser ? 'User' : isCompaction ? 'Compaction' : item.model || 'Assistant'}
        </span>
        <span className="muted small">{formatTime(item.ts)}</span>
        {isCompaction && item.model && <span className="muted small">{item.model}</span>}
        {isCompaction && item.tokens && (
          <span className="muted small">
            est. in {formatNumber(item.tokens.input)} / out {formatNumber(item.tokens.output)}
          </span>
        )}
        {item.cost != null && item.cost > 0 && (
          <span className="muted small">{formatUSD(item.cost)}</span>
        )}
      </div>

      {item.text && <div className="tl-text">{item.text}</div>}

      {item.thinking && (
        <div className="tl-thinking">
          <button className="link" onClick={() => setShowThinking((v) => !v)}>
            {showThinking ? 'Hide thinking' : 'Show thinking'}
          </button>
          {showThinking && <pre className="code">{item.thinking}</pre>}
        </div>
      )}

      {item.tools.map((t, i) => (
        <div key={i} className="tl-tool">
          <div className="tl-tool-head">
            <span className="pill tool">{t.name}</span>
          </div>
          {t.input && <pre className="code">{t.input}</pre>}
        </div>
      ))}

      {item.toolResults.map((r, i) => (
        <div key={i} className={`tl-result ${r.isError ? 'err' : ''}`}>
          <div className="tl-result-head">{r.isError ? 'Tool error' : 'Tool result'}</div>
          {r.output && <pre className="code">{r.output}</pre>}
        </div>
      ))}
    </div>
  )
}
