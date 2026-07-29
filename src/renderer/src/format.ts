export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function formatUSD(n: number): string {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return '$' + n.toFixed(4)
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0m'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m}m`
}

export function formatTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function projectName(path: string): string {
  if (!path) return 'unknown'
  const parts = path.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || path
}
