import { expect, test } from 'claude-code/testing'

import { buildFlow, fmtMs, fmtTokens, parseChart, planText } from './register'

const chart = `
    [*] --> INIT
    INIT --> VALIDATE_URL: RUNTIME_READY [runtime_compatible]
    INIT --> ERROR: FAILED / CANCEL
    VALIDATE_URL --> COMPLETE: URL_VALID
    COMPLETE --> [*]
`

const ev = (type: string, state: string, t: string, payload: object) =>
  JSON.stringify({ type, state, timestamp: `2026-10-06T00:00:${t}Z`, run_id: 'abcdef12-0', skill_id: 's', payload })

test('formats numbers', () => {
  expect(fmtTokens(84_200)).toBe('84k')
  expect(fmtTokens(1_000_000)).toBe('1.0M')
  expect(fmtMs(3200)).toBe('3.2s')
  expect(fmtMs(130_000)).toBe('2m10s')
})

test('parses chart edges and signals', () => {
  const edges = parseChart(chart)
  expect(edges).toHaveLength(3)
  expect(edges[1].signals).toEqual(['FAILED', 'CANCEL'])
})

test('builds the path with dwell time and roads not taken', () => {
  const lines = [
    ev('SKILL_INITIALIZED', 'INIT', '00.000', {}),
    ev('SIGNAL_EMITTED', 'INIT', '02.000', { signal: 'RUNTIME_READY' }),
    ev('GUARD_EVALUATED', 'INIT', '02.001', { passed: true, fallbackTriggered: false }),
    ev('STATE_TRANSITION', 'VALIDATE_URL', '02.002', { from: 'INIT', to: 'VALIDATE_URL', signal: 'RUNTIME_READY' }),
  ]
  const flow = buildFlow(lines, parseChart(chart), Date.parse('2026-10-06T00:00:05Z'))
  expect(flow?.current).toBe('VALIDATE_URL')
  expect(flow?.steps[0].dwellMs).toBe(2000)
  expect(flow?.steps[0].notTaken).toEqual(['FAILED', 'CANCEL'])
  expect(flow?.liveMs).toBe(2998)
  expect(planText(flow!)).toContain('INIT ─RUNTIME_READY→ VALIDATE_URL')
})
