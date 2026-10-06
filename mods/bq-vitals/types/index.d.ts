export type Edge = { from: string; to: string; signals: string[] }

// One hop through the state machine, read from the run's event log.
export type Step = {
  from: string
  to: string
  signal: string
  // pass: the guard allowed it; fallback: the guard failed and a fallback ran.
  guard: 'pass' | 'fallback' | 'none'
  denied: number
  dwellMs: number
  notTaken: string[]
}

export type Flow = {
  skill: string
  runId: string
  current: string
  isTerminal: boolean
  startedAt: number
  updatedAt: number
  liveMs: number
  order: string[]
  edges: Edge[]
  steps: Step[]
}

declare module 'claude-code' {
  interface PluginState {
    'bq-vitals': { flow: Flow | null }
  }
}
