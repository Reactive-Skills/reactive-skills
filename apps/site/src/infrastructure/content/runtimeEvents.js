/** @type {import('@/contracts/types').RuntimeEvent[]} */
export const runtimeEvents = [
  { eventType: 'SkillStarted', state: 'EXPLORE', source: 'runtime', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:02.113Z' },
  { eventType: 'SignalReceived', state: 'EXPLORE', source: 'mcp', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:02.480Z' },
  { eventType: 'GuardEvaluated', state: 'PLAN', source: 'runtime', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:03.902Z' },
  { eventType: 'StateEntered', state: 'EXECUTE', source: 'runtime', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:05.219Z' },
  { eventType: 'DeliverableWritten', state: 'VERIFY', source: 'runtime', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:08.744Z' },
  { eventType: 'SkillCompleted', state: 'DONE', source: 'runtime', traceId: 'trc_7f3a9c', timestamp: '2025-06-12T09:14:09.101Z' },
];
