# Claude Token Usage

A local desktop app (Electron + React + TypeScript) that reads your Claude Code
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

## Install

There are no prebuilt releases yet, so install by building from source (see
[Build from source](#build-from-source) below), then follow the steps for your OS.

> **Platform status:** macOS is the primary target and has been built and manually
> verified. Windows and Linux packaging is configured (via electron-builder) but has
> not been built or tested on those platforms yet — if you try it, please report any
> issues.

### macOS

1. Build with `npm run build:mac` (see below).
2. In `dist/`, open the `.dmg` and drag **Claude Token Usage.app** into `Applications`,
   or unzip the `.zip` and move the `.app` there yourself.
3. Since the app isn't signed/notarized with an Apple Developer certificate, the first
   launch will be blocked by Gatekeeper. Right-click the app → **Open** → **Open** in
   the dialog (only needed once), or allow it via **System Settings → Privacy &
   Security**.

### Windows

1. Build with `npm run build:win` (see below).
2. In `dist/`, run the generated `.exe` installer and follow the prompts.
3. The installer isn't code-signed, so SmartScreen will likely warn about an unknown
   publisher. Click **More info → Run anyway** to proceed.

### Linux

1. Build with `npm run build:linux` (see below).
2. In `dist/`, mark the generated `.AppImage` executable and run it directly:
   ```bash
   chmod +x "Claude Token Usage-<version>-<arch>.AppImage"
   ./"Claude Token Usage-<version>-<arch>.AppImage"
   ```
   No installation step is required; the AppImage runs in place.

## Requirements

- Node.js 18+ (developed against Node 22)

## Develop

```bash
npm install
npm run dev
```

## Build from source

```bash
npm install
npm run build:mac    # macOS: .dmg and .zip
npm run build:win    # Windows: NSIS installer .exe
npm run build:linux  # Linux: .AppImage
```

Each command writes its packaged artifact(s) to `dist/`. You must run the build on
(or cross-compile from) the target OS you're packaging for — electron-builder does
not reliably cross-build native platform installers from a different host OS.

## Data source

- Main sessions: `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`
- Sub-agents: `~/.claude/projects/<encoded-cwd>/<sessionId>/subagents/agent-*.jsonl`

Token data comes from each assistant message's `message.usage`, attributed to
`message.model`. Messages with model `<synthetic>` are ignored (no real cost).
