# Claude Token Usage

A local macOS desktop app (Electron + React + TypeScript) that reads your Claude Code
session transcripts and reports token usage and cost per model per session, with date
filtering, aggregates, and editable pricing.

It is fully offline and read-only: it only reads files under `~/.claude/projects` and
never modifies them.

## What it shows

- Per session token usage (input, output, cache write, cache read), with all models used listed
- Cost per session based on editable per-model rates
- Aggregates: totals, cost by model, cost over time
- Date range filtering (applied at message-timestamp granularity)
- CLI vs Desktop source, and a toggle to fold or separate sub-agent activity

## Pricing

Open the Pricing tab to set rates (USD per million tokens) for each model:

- Input, Output, Cache write, Cache read

Known model families (Opus / Sonnet / Haiku) are seeded with approximate Anthropic list
prices on first run; everything is editable and your edits are saved to
`<userData>/prices.json` and reused on the next launch. Local/unknown models start at 0.

> Cache tokens usually dominate real usage, so cache read/write rates matter a lot for an
> accurate cost figure.

## Requirements

- Node.js 18+ (developed against Node 22)

## Develop

```bash
npm install
npm run dev
```

## Build a macOS app

```bash
npm run build:mac
```

The packaged `.app` / `.dmg` is written to `dist/`.

## Data source

- Main sessions: `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`
- Sub-agents: `~/.claude/projects/<encoded-cwd>/<sessionId>/subagents/agent-*.jsonl`

Token data comes from each assistant message's `message.usage`, attributed to
`message.model`. Messages with model `<synthetic>` are ignored (no real cost).
