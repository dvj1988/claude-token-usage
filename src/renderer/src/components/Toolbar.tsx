interface Props {
  startDate: string
  endDate: string
  minDay: string
  maxDay: string
  foldSubagents: boolean
  onStartDate: (v: string) => void
  onEndDate: (v: string) => void
  onFoldSubagents: (v: boolean) => void
}

export function Toolbar({
  startDate,
  endDate,
  minDay,
  maxDay,
  foldSubagents,
  onStartDate,
  onEndDate,
  onFoldSubagents
}: Props) {
  return (
    <div className="toolbar">
      <div className="field">
        <label>From</label>
        <input
          type="date"
          value={startDate}
          min={minDay || undefined}
          max={endDate || maxDay || undefined}
          onChange={(e) => onStartDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label>To</label>
        <input
          type="date"
          value={endDate}
          min={startDate || minDay || undefined}
          max={maxDay || undefined}
          onChange={(e) => onEndDate(e.target.value)}
        />
      </div>
      <div className="quick-ranges">
        <button onClick={() => { onStartDate(monthStart(maxDay)); onEndDate(maxDay) }}>This month</button>
        <button onClick={() => { onStartDate(last(7, maxDay)); onEndDate(maxDay) }}>Last 7d</button>
        <button onClick={() => { onStartDate(last(30, maxDay)); onEndDate(maxDay) }}>Last 30d</button>
        <button onClick={() => { onStartDate(minDay); onEndDate(maxDay) }}>All time</button>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={foldSubagents}
          onChange={(e) => onFoldSubagents(e.target.checked)}
        />
        <span>Fold sub-agents into parent session</span>
      </label>
    </div>
  )
}

function monthStart(maxDay: string): string {
  const base = maxDay ? new Date(maxDay + 'T00:00:00') : new Date()
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function last(days: number, maxDay: string): string {
  const base = maxDay ? new Date(maxDay + 'T00:00:00') : new Date()
  base.setDate(base.getDate() - (days - 1))
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
