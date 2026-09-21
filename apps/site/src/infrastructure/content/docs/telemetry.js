/** @type {import('@/contracts/types').DocPage} */
export const telemetry = {
  slug: 'telemetry',
  title: 'Multi-Job Telemetry',
  summary: 'Run one local read-only broker and monitor multiple skill jobs through one browser connection.',
  category: 'Integrate',
  href: '/docs/telemetry',
  sections: [
    {
      id: 'start-broker',
      heading: 'Start the broker',
      blocks: [
        { type: 'text', text: 'Run the AXI dashboard command from the workspace that owns the `.reactive/skills` event stores.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi dashboard', explanation: 'Starts a loopback broker on the default port and prints its actual listener URL.' } },
        { type: 'text', text: 'When `--port` is omitted, the broker starts at `127.0.0.1:4242` and falls back through a bounded range if that port is occupied. Use `--port 0` to request an OS-assigned port or provide an explicit port for a stable local URL.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi dashboard --port 0\nnpx -y @reactive-skills/axi dashboard --host 0.0.0.0 --port 4500', explanation: 'The command reports the bound port after the listener starts.' } },
        { type: 'callout', variant: 'info', title: 'Browser discovery', text: 'The browser never scans arbitrary localhost ports. Copy the URL printed by AXI into the dashboard connection field.' },
      ],
    },
    {
      id: 'connect-site',
      heading: 'Connect the site dashboard',
      blocks: [
        { type: 'text', text: 'Open the site `/telemetry` route and enter the broker URL supplied by the CLI.' },
        { type: 'text', text: 'The site fetches the broker catalog and displays skills and jobs without reading local workspace files.' },
        { type: 'text', text: 'Select a skill, select a job, and choose Track job to add an isolated live card.' },
        { type: 'text', text: 'The dashboard opens one multiplexed SSE connection for the complete tracked target set.' },
        { type: 'text', text: 'Changing the tracked set closes and reconnects that one stream with the updated target filters.' },
      ],
    },
    {
      id: 'discovery-api',
      heading: 'Discovery and API',
      blocks: [
        { type: 'text', text: 'The broker discovers skill directories under `.reactive/skills` and job metadata through the runtime `JobManager`.' },
        { type: 'text', text: 'Skill names come from a workspace skill manifest when available and otherwise fall back to the skill ID.' },
        { type: 'text', text: '`GET /catalog` returns skill IDs, skill names, job IDs, status, current HSM state, latest local sequence, update time, and active-job metadata.' },
        { type: 'text', text: '`GET /state?skillId=<skill-id>&jobId=<job-id>` returns only the validated target state, snapshot, event count, and latest signal.' },
        { type: 'text', text: '`GET /events` streams all discovered targets unless repeated `target=<skill-id>/<job-id>` parameters restrict the subscription.' },
        { type: 'text', text: 'The `sinceSeq` value applies independently to each target because sequence numbers are local to each job.' },
      ],
    },
    {
      id: 'two-jobs',
      heading: 'Monitor two jobs at once',
      blocks: [
        { type: 'list', items: [
          'Start `reactive-skills-axi dashboard` and copy the reported URL.',
          'Open the site `/telemetry` route and connect to that URL.',
          'Select a skill and job such as `jsm-workflow/review-slice`, then choose Track job.',
          'Select a second job such as `jsm-workflow/test-slice`, then choose Track job again.',
          'Confirm that both cards show their own job IDs and event ledgers.',
          'Append an event to one SQLite job store and confirm only that matching card updates.',
        ] },
        { type: 'text', text: 'Every card checks both skill ID and job ID before accepting an event, so local sequence numbers are never treated as global ordering.' },
      ],
    },
    {
      id: 'compatibility',
      heading: 'Single-job compatibility',
      blocks: [
        { type: 'text', text: '`reactive-skills-axi view <skill> [--job <job-id>]` remains single-job scoped.' },
        { type: 'text', text: 'The single-job viewer keeps its existing `/health`, `/state`, `/events/history`, `/events`, CORS, and signal bridge behavior.' },
        { type: 'text', text: 'Use the viewer when one job needs an explicit bridge URL and use the broker when one browser session needs several read-only cards.' },
      ],
    },
    {
      id: 'limits',
      heading: 'Read-only and network limits',
      blocks: [
        { type: 'callout', variant: 'warn', title: 'Read-only broker', text: 'The broker does not dispatch signals, append events, change the active-job pointer, or accept filesystem paths from HTTP parameters.' },
        { type: 'text', text: 'SQLite is the authoritative source and the broker polls each job store so separate CLI, MCP, and worker writers become visible.' },
        { type: 'text', text: 'The broker defaults to loopback binding and retains CORS and Local Network Access headers for a site served from another origin.' },
        { type: 'text', text: 'If the browser reports a Local Network access error, grant the site permission to reach the supplied broker URL and reconnect.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI', href: '/docs/axi' },
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
