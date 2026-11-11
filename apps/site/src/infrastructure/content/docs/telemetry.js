/** @type {import('@/contracts/types').DocPage} */
export const telemetry = {
  slug: 'telemetry',
  title: 'Multi-Job Telemetry',
  summary: 'Run one local read-only broker and monitor multiple skill jobs through one browser connection.',
  category: 'Integrate',
  href: '/telemetry',
  sections: [
    {
      id: 'start-broker',
      heading: 'Start the broker',
      blocks: [
        { type: 'text', text: 'Run the AXI dashboard command from any directory. It lists jobs from every workspace the CLI knows about (a workspace is known once a skill-targeted command or `workspaces register` has recorded it, or when it is an ancestor of the current directory), or only from one store when you pass `--workspace`, which records nothing.' },
        { type: 'text', text: 'Workspaces created before the CLI recorded them can be registered in one step. Preview with `--dry-run`, then register; the command only reads folder names and writes the catalog, never the stores.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi workspaces register --scan ~/projects --dry-run\nnpx -y @reactive-skills/axi workspaces register --scan ~/projects', explanation: 'Finds .reactive/skills stores up to three levels below the parent, skipping dependency and build folders, and lists what it added, already knew and skipped.' } },
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
        { type: 'text', text: '`GET /catalog` returns skill IDs, skill names, job IDs, each job\'s workspace root, status, current HSM state, latest local sequence, update time, and active-job metadata. A job held by several workspaces appears once per workspace, and the dashboard labels each with the shortest folder path that tells its workspace apart from the others, keeping the full path in the tooltip.' },
        { type: 'text', text: '`GET /state?skillId=<skill-id>&jobId=<job-id>` returns only the validated target state, snapshot, event count, and latest signal. When several workspaces hold the same skill and job, add `workspaceRoot=<workspace-root>`; otherwise the first workspace in order is used.' },
        { type: 'text', text: '`GET /events` streams all discovered targets unless repeated `target=<skill-id>/<job-id>` or `target=<workspace-root>/<skill-id>/<job-id>` parameters restrict the subscription.' },
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
        { type: 'text', text: 'Every card checks skill ID, job ID and workspace root before accepting an event, so local sequence numbers are never treated as global ordering.' },
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
        { type: 'text', text: 'SQLite is the authoritative source and the broker polls the store of each job a connected client subscribes to so separate CLI, MCP, and worker writers become visible.' },
        { type: 'text', text: 'The broker defaults to loopback binding. It sends CORS and Local Network Access headers only to `https://reactive-skills.com` and to `http://localhost` or `http://127.0.0.1` on any port; other origins receive no CORS headers. It also refuses, with 403, every request whose `Host` header is not `localhost`, `127.0.0.1` or `[::1]` (any port), so a page that rebinds its own hostname to loopback cannot read it. Because only loopback names are answered, `--host 0.0.0.0` listens on every interface but is reachable only as `localhost` or `127.0.0.1`, and neither rule stops a non-browser client on a network the broker is bound to.' },
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
