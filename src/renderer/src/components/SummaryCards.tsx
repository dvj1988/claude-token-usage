import type { UsageTotals } from '../../../shared/types'
import { formatCompact, formatNumber, formatUSD } from '../format'

interface Props {
  totals: UsageTotals
}

export function SummaryCards({ totals }: Props) {
  const cards = [
    { label: 'Total cost', value: formatUSD(totals.cost), accent: 'cost' },
    { label: 'Total tokens', value: formatCompact(totals.totalTokens), sub: formatNumber(totals.totalTokens) },
    { label: 'Sessions', value: formatNumber(totals.sessions) },
    { label: 'Assistant messages', value: formatNumber(totals.messages) }
  ]
  return (
    <section className="cards">
      {cards.map((c) => (
        <div key={c.label} className={`card ${c.accent ?? ''}`}>
          <div className="card-label">{c.label}</div>
          <div className="card-value">{c.value}</div>
          {c.sub && <div className="card-sub">{c.sub}</div>}
        </div>
      ))}
      <div className="card breakdown">
        <div className="card-label">Token mix</div>
        <div className="mix">
          <span>In {formatCompact(totals.tokens.input)}</span>
          <span>Out {formatCompact(totals.tokens.output)}</span>
          <span>Cache W {formatCompact(totals.tokens.cacheWrite)}</span>
          <span>5m {formatCompact(totals.tokens.cacheWrite5m)}</span>
          <span>1h {formatCompact(totals.tokens.cacheWrite1h)}</span>
          <span>Cache R {formatCompact(totals.tokens.cacheRead)}</span>
        </div>
      </div>
    </section>
  )
}
