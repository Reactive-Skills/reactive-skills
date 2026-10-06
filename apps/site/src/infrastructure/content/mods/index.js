/** @type {import('@/contracts/ModsContentSource').Mod[]} */
export const mods = [
  {
    slug: 'bq-vitals',
    name: 'bq-vitals',
    summary:
      'Shows what a reactive skill run is doing from inside Claude Code: a status line with context, cost and rate limits, a live map of the state machine, and a query-plan style trace of the path the run took.',
    installCmd: '/plugin install bq-vitals --marketplace Reactive-Skills/reactive-skills',
    sourceUrl: 'https://github.com/Reactive-Skills/reactive-skills/tree/main/mods/bq-vitals',
    features: [
      {
        name: 'Status line',
        description:
          'Context used, session cost and rate-limit windows, with the active skill and state appended while a run is in progress.',
      },
      {
        name: '/flow',
        description:
          'Opens a pane with a live map of the state machine (done, current, not reached) above the plan trace. It refreshes every few seconds.',
      },
      {
        name: '/flow-plan',
        description:
          'Prints the path the latest run took, one line per hop: the signal, whether the guard passed, time spent in the state, and the exits that were not taken.',
      },
    ],
    reads: [
      '.reactive/skills/<skill>/events.jsonl, the append-only event ledger of the run',
      "STATECHART.md in the skill's directory, for the edges a state could have taken",
    ],
  },
];
