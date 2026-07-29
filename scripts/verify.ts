import { parseAll } from '../src/main/parser'
import { computeUsage } from '../src/main/usage'
import { defaultRateForModel } from '../src/main/defaults'
import { getSessionDetail } from '../src/main/detail'
import type { PriceTable } from '../src/shared/types'

async function main(): Promise<void> {
  const data = await parseAll()
  const prices: PriceTable = {}
  for (const m of data.models) prices[m] = defaultRateForModel(m)

  console.log('files:', data.fileCount, 'records:', data.records.length)
  console.log('models:', data.models.join(', '))
  console.log('date range:', data.minDay, '->', data.maxDay)

  const folded = computeUsage(data.records, prices, {
    startDate: data.minDay,
    endDate: data.maxDay,
    foldSubagents: true
  })
  console.log('\n[folded] sessions:', folded.totals.sessions, 'cost:', folded.totals.cost.toFixed(2))
  console.log('top 5 sessions:')
  for (const r of folded.sessionRows.slice(0, 5)) {
    console.log(
      `  ${r.shortSessionId} ${r.entrypoint.padEnd(14)} ${r.models.join(', ').padEnd(40)} tok=${r.totalTokens
        .toLocaleString()
        .padStart(12)} cost=$${r.cost.total.toFixed(2)}`
    )
  }

  const separate = computeUsage(data.records, prices, {
    startDate: data.minDay,
    endDate: data.maxDay,
    foldSubagents: false
  })
  console.log(
    '\n[separate] rows:',
    separate.sessionRows.length,
    'subagent rows:',
    separate.sessionRows.filter((r) => r.isSubagent).length
  )

  console.log('\nby model:')
  for (const m of folded.byModel) {
    console.log(`  ${m.model.padEnd(22)} cost=$${m.cost.toFixed(2)} tokens=${m.totalTokens.toLocaleString()}`)
  }

  console.log('\nentrypoint split:')
  const ep = new Map<string, number>()
  for (const r of folded.sessionRows) ep.set(r.entrypoint, (ep.get(r.entrypoint) ?? 0) + 1)
  for (const [k, v] of ep) console.log(`  ${k}: ${v} rows`)

  // Detail view check on the top session.
  const top = folded.sessionRows[0]
  const detail = await getSessionDetail(top.sessionId, prices)
  console.log('\n=== DETAIL for', top.sessionId, '===')
  if (detail) {
    console.log('title:', detail.title)
    console.log('project:', detail.projectPath, '| branch:', detail.gitBranch)
    console.log('source:', detail.entrypoint, '| version:', detail.version)
    console.log('duration(min):', (detail.durationMs / 60000).toFixed(1))
    console.log('models:', detail.models.join(', '))
    console.log('cost total: $' + detail.cost.total.toFixed(2))
    console.log('prompts:', detail.userPromptCount, 'assistant msgs:', detail.assistantCount)
    console.log('tools:', detail.toolCounts.map((t) => `${t.name}x${t.count}`).join(', '))
    console.log('files touched:', detail.filesTouched.length)
    console.log('skills:', detail.skills.join(', ') || '(none)')
    console.log('subagents:', detail.subagents.length)
    for (const s of detail.subagents.slice(0, 3))
      console.log(`   - ${s.agentType}: ${s.description} ($${s.cost.toFixed(2)}, ${s.totalTokens.toLocaleString()} tok)`)
    console.log('timeline items:', detail.timeline.length)
    const firstUser = detail.timeline.find((t) => t.type === 'user' && t.text)
    if (firstUser) console.log('first prompt:', JSON.stringify(firstUser.text.slice(0, 100)))
  } else {
    console.log('NO DETAIL FOUND')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
