import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Edge, Flow, Step } from '../types'

const PANE = 'bq-flow'
const TERMINAL = new Set(['COMPLETE', 'ERROR'])
const flowAtom = atom({ plugin: 'bq-vitals', key: 'flow' } as const, null)

type Ev = {
  type: string
  state: string
  timestamp: string
  run_id: string
  skill_id: string
  payload: Record<string, unknown>
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`
}

// `A --> B: SIG [guards]` or `A --> B: SIG1 / SIG2` lines of a STATECHART.md.
export function parseChart(text: string): Edge[] {
  const edges: Edge[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z_]*)\s*-->\s*([A-Z][A-Z_]*)(?:\s*:\s*(.*))?$/)
    if (!m) continue
    const signals = (m[3] ?? '')
      .replace(/\[.*$/, '')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
    edges.push({ from: m[1], to: m[2], signals })
  }
  return edges
}

function stateOrder(edges: Edge[], steps: Step[], current: string): string[] {
  const order: string[] = []
  const add = (s: string) => {
    if (!order.includes(s)) order.push(s)
  }
  for (const e of edges) {
    add(e.from)
    add(e.to)
  }
  for (const s of steps) {
    add(s.from)
    add(s.to)
  }
  add(current)
  return order
}

// Turns one run's event log into the path it took, like an EXPLAIN of the run.
export function buildFlow(lines: string[], edges: Edge[], now: number): Flow | null {
  const all: Ev[] = []
  for (const line of lines) {
    try {
      all.push(JSON.parse(line) as Ev)
    } catch {
      // a half-written last line
    }
  }
  const last = all[all.length - 1]
  if (!last) return null
  const evs = all.filter(e => e.run_id === last.run_id)
  const steps: Step[] = []
  let current = 'INIT'
  let enteredAt = Date.parse(evs[0].timestamp)
  const startedAt = enteredAt
  let signalAt = enteredAt
  let denied = 0
  let guard: Step['guard'] = 'none'
  for (const e of evs) {
    const t = Date.parse(e.timestamp)
    if (e.type === 'SIGNAL_EMITTED') {
      signalAt = t
      denied = 0
      guard = 'none'
    } else if (e.type === 'GUARD_EVALUATED') {
      if (e.payload.passed === false) denied += 1
      else guard = e.payload.fallbackTriggered === true ? 'fallback' : 'pass'
    } else if (e.type === 'STATE_TRANSITION') {
      const from = String(e.payload.from)
      const to = String(e.payload.to)
      const signal = String(e.payload.signal)
      const taken = edges.filter(x => x.from === from).flatMap(x => x.signals)
      steps.push({
        from,
        to,
        signal,
        guard,
        denied,
        dwellMs: Math.max(0, signalAt - enteredAt),
        notTaken: [...new Set(taken.filter(s => s !== signal))],
      })
      current = to
      enteredAt = t
    }
  }
  const updatedAt = Date.parse(last.timestamp)
  const isTerminal = TERMINAL.has(current)
  return {
    skill: last.skill_id,
    runId: last.run_id,
    current,
    isTerminal,
    startedAt,
    updatedAt,
    liveMs: isTerminal ? 0 : Math.max(0, now - enteredAt),
    order: stateOrder(edges, steps, current),
    edges,
    steps,
  }
}

// Plain-text plan: the path taken, per hop the signal, guard, time and roads not taken.
export function planText(f: Flow): string {
  const total = f.steps.reduce((a, s) => a + s.dwellMs, 0) + f.liveMs
  const slowest = Math.max(1, ...f.steps.map(s => s.dwellMs), f.liveMs)
  const bar = (ms: number) => '█'.repeat(Math.max(1, Math.round((ms / slowest) * 10)))
  const out = [
    `${f.skill}  run ${f.runId.slice(0, 8)}  ${f.isTerminal ? `finished at ${f.current}` : `running at ${f.current}`}  work ${fmtMs(total)}`,
  ]
  f.steps.forEach((s, i) => {
    const mark = s.guard === 'fallback' ? '↯' : '✔'
    const denied = s.denied > 0 ? `  guard denied ${s.denied}x first` : ''
    out.push(`${String(i + 1).padStart(2)}. ${s.from} ─${s.signal}→ ${s.to}  ${mark} ${bar(s.dwellMs)} ${fmtMs(s.dwellMs)}${denied}`)
    if (s.notTaken.length > 0) out.push(`      not taken: ${s.notTaken.join(', ')}`)
  })
  if (!f.isTerminal) out.push(`    ▶ ${f.current}  ${bar(f.liveMs)} ${fmtMs(f.liveMs)} so far`)
  return out.join('\n')
}

function statusLine(f: Flow | null, now: number): string | undefined {
  if (f === null) return undefined
  const idle = now - f.updatedAt
  if (idle > 15 * 60_000 || (f.isTerminal && idle > 2 * 60_000)) return undefined
  return `${f.skill} ▸ ${f.current}`
}

const FIND = [
  'files=$(stat -c "%Y %n" "$PWD"/.reactive/skills/*/events.jsonl',
  '"$HOME"/.claude/skills/*/.reactive/skills/*/events.jsonl',
  '"$HOME"/.agents/skills/*/.reactive/skills/*/events.jsonl',
  '/tmp/.reactive/skills/*/events.jsonl 2>/dev/null | sort -rn | head -1 | cut -d" " -f2-);',
  '[ -n "$files" ] && printf "%s" "$files"',
].join(' ')

type Engine = EngineInterface
type Mem = { home: string | null; isPaneOpen: boolean; usageText: string; edgeCache: Map<string, Edge[]> }

async function loadFlow($: Engine, mem: Mem): Promise<Flow | null> {
  try {
    const found = await $.process.run(['sh', '-c', FIND], { timeoutMs: 5000 })
    const path = found.stdout.trim()
    if (path === '') return null
    const skill = path.split('/').slice(-2)[0]
    if (!mem.edgeCache.has(skill)) {
      mem.home ??= (await $.process.run(['sh', '-c', 'printf %s "$HOME"'])).stdout
      let edges: Edge[] = []
      for (const root of [`${mem.home}/.claude/skills`, `${mem.home}/.agents/skills`]) {
        try {
          edges = parseChart(await $.fs.read(`${root}/${skill}/STATECHART.md`))
          break
        } catch {
          // try the next root
        }
      }
      mem.edgeCache.set(skill, edges)
    }
    const text = await $.fs.read(path)
    return buildFlow(text.split('\n').filter(Boolean), mem.edgeCache.get(skill) ?? [], await $.clock.now())
  } catch {
    return null
  }
}

async function refresh($: Engine, mem: Mem) {
  try {
    const u = await $.session.usage()
    const ctx = u.context
    const parts = [
      ctx.tokens === undefined
        ? `ctx ${fmtTokens(ctx.window)}`
        : `ctx ${fmtTokens(ctx.tokens)}/${fmtTokens(ctx.window)} ${Math.round(ctx.percent ?? 0)}%`,
    ]
    if (u.cost) parts.push(`$${u.cost.usd.toFixed(2)}`)
    for (const r of u.rateLimits) {
      parts.push(`${r.kind === 'five_hour' ? '5h' : r.kind === 'seven_day' ? '7d' : r.kind} ${Math.round(r.percentUsed)}%`)
    }
    mem.usageText = parts.join(' · ')
  } catch {
    // keep the last reading
  }
  const flow = await loadFlow($, mem)
  const flowText = statusLine(flow, await $.clock.now())
  $.ui.status([mem.usageText, flowText].filter(Boolean).join('  |  ') || undefined)
  if (mem.isPaneOpen) await update($, flowAtom, () => flow)
}

export const register: Register = on => {
  const mem: Mem = { home: null, isPaneOpen: false, usageText: '', edgeCache: new Map() }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'flow', description: 'Live map and query-plan style trace of the latest reactive skill run' })
    await $.command.register({ name: 'flow-plan', description: 'Print the path the latest reactive skill run took, as text' })
    $.clock.every(3000, () => void refresh($, mem))
    void refresh($, mem)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($, mem)
    return next(e)
  })

  on('command.run', { command: 'flow' }, async $ => {
    mem.isPaneOpen = true
    await update($, flowAtom, () => null)
    await $.ui.open({ id: PANE, title: 'Reactive run' })
    void refresh($, mem)
    return { text: 'Reactive run pane opened.' }
  })

  on('command.run', { command: 'flow-plan' }, async $ => {
    const flow = await loadFlow($, mem)
    return { text: flow === null ? 'No reactive skill run found.' : planText(flow) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const flow = await read($, flowAtom)
    if (flow === null) return <Text dimColor>No reactive skill run found yet.</Text>

    const visited = new Set(flow.steps.flatMap(s => [s.from, s.to]))
    const path = flow.steps.map(s => s.from)
    return (
      <Box flexDirection="column">
        <Text bold>{flow.skill} · run {flow.runId.slice(0, 8)}</Text>
        <Text dimColor>{' '}</Text>
        {flow.order.map(state => {
          const isNow = state === flow.current
          const isDone = path.includes(state) && !isNow
          const mark = isNow ? '▶' : isDone ? '✔' : visited.has(state) ? '·' : '○'
          return (
            <Text bold={isNow} dimColor={!isNow && !isDone}>
              {mark} {state}
            </Text>
          )
        })}
        <Text dimColor>{' '}</Text>
        <Text bold>Plan</Text>
        {planText(flow)
          .split('\n')
          .slice(1)
          .map(line => (
            <Text dimColor={line.includes('not taken')}>{line}</Text>
          ))}
      </Box>
    )
  })
}
