import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { DayAggregate, ModelAggregate } from '../../../shared/types'
import { formatCompact, formatNumber, formatUSD } from '../format'

interface Props {
  byModel: ModelAggregate[]
  byDay: DayAggregate[]
}

const MODEL_COLORS = ['#7c8cff', '#5ad1b3', '#f0a35e', '#e06b8b', '#8a7cff', '#5ab0d1', '#c5d15a']

export function Aggregates({ byModel, byDay }: Props) {
  const modelData = byModel.map((m) => ({ name: m.model, cost: Number(m.cost.toFixed(2)) }))
  const dayData = byDay.map((d) => ({ day: d.day, cost: Number(d.cost.toFixed(2)) }))

  return (
    <section className="aggregates">
      <div className="panel">
        <h2>Cost by model</h2>
        {modelData.length === 0 ? (
          <div className="empty">No data in range</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={modelData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222838" />
              <XAxis dataKey="name" tick={{ fill: '#9aa3b8', fontSize: 11 }} interval={0} angle={-12} height={50} textAnchor="end" />
              <YAxis tick={{ fill: '#9aa3b8', fontSize: 11 }} tickFormatter={(v) => '$' + v} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatUSD(v), 'Cost']}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {modelData.map((_, i) => (
                  <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel">
        <h2>Cost over time</h2>
        {dayData.length === 0 ? (
          <div className="empty">No data in range</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dayData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222838" />
              <XAxis dataKey="day" tick={{ fill: '#9aa3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9aa3b8', fontSize: 11 }} tickFormatter={(v) => '$' + v} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatUSD(v), 'Cost']} />
              <Line type="monotone" dataKey="cost" stroke="#7c8cff" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel wide">
        <h2>Per-model breakdown</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th className="num">Msgs</th>
              <th className="num">Input</th>
              <th className="num">Output</th>
              <th className="num">Cache write</th>
              <th className="num">Cache read</th>
              <th className="num">Total tokens</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byModel.map((m, i) => (
              <tr key={m.model}>
                <td>
                  <span className="dot" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                  {m.model}
                </td>
                <td className="num">{formatNumber(m.messages)}</td>
                <td className="num">{formatCompact(m.tokens.input)}</td>
                <td className="num">{formatCompact(m.tokens.output)}</td>
                <td className="num">{formatCompact(m.tokens.cacheWrite)}</td>
                <td className="num">{formatCompact(m.tokens.cacheRead)}</td>
                <td className="num">{formatCompact(m.totalTokens)}</td>
                <td className="num strong">{formatUSD(m.cost)}</td>
              </tr>
            ))}
            {byModel.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No data in range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const tooltipStyle = {
  background: '#151a26',
  border: '1px solid #2a3142',
  borderRadius: 8,
  color: '#e6e9f0'
}
