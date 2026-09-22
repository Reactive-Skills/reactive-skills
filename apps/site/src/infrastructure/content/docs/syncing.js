/** @type {import('@/contracts/types').DocPage} */
export const syncing = {
  slug: 'syncing',
  title: 'Syncing & Distributing Skills',
  summary: 'How to synchronize skills across authoring workspaces and consumer agent satellites with zero-drift directory junctions and physical mirroring.',
  category: 'Get started',
  href: '/docs/syncing',
  sections: [
    {
      id: 'the-drift-problem',
      heading: 'The drift problem in multi-agent environments',
      blocks: [
        { type: 'text', text: 'Modern developers rarely use a single AI agent tool in isolation. Different workflows leverage Claude Code, Gemini Antigravity, Codex CLI, Cursor, Devin, and GitHub Copilot. Each host harness maintains its own isolated skills configuration directory.' },
        { type: 'text', text: 'When skills are manually copied between these directories, synchronization breaks down immediately. Enhancements authored in your primary project do not propagate to agent harnesses, bug fixes made during an agent session remain trapped in local caches, and multiple versions of the same skill diverge.' },
        { type: 'callout', variant: 'info', title: 'Why synchronization matters', text: 'Reactive skills must stay identical across all agent harnesses. When you optimize a state prompt, refine a guard condition, or update projection templates, every agent environment should receive that change instantly without manual re-copying.' },
      ],
    },
    {
      id: 'zero-drift-junctions',
      heading: 'Zero-drift directory junctions',
      blocks: [
        { type: 'text', text: 'Reactive Skills solves drift at the operating system level using NTFS Directory Junctions on Windows and POSIX symbolic links on macOS and Linux.' },
        { type: 'text', text: 'Instead of duplicating files, consumer satellites point directly to the authoritative authoring repository. This delivers three concrete benefits:' },
        { type: 'list', items: [
          'Instant bidirectional updates: Edits in your authoring repository are instantly active across all agent runtimes with zero latency.',
          'In-session learning captured: When an agent refines a skill during a pairing session, the changes are made directly in the git-tracked authoring repo.',
          'Zero disk overhead: Avoids duplicating large multi-state skill trees across ten different harness directories.',
        ] },
        { type: 'callout', variant: 'signal', title: 'Junction vs copy mode', text: 'Directory junctions are the default and recommended mode across all interfaces. Physical copy mode is available as a fallback when symlinks are restricted by filesystem or security policies.' },
      ],
    },
    {
      id: 'axi-sync-cli',
      heading: '1. Synchronizing via AXI CLI',
      blocks: [
        { type: 'text', text: 'The AXI CLI provides a synchronization entrypoint via axi sync (or npx -y @reactive-skills/axi sync). It can sync an entire workspace or a single target skill.' },
        { type: 'code', example: {
          language: 'bash',
          command: 'npx -y @reactive-skills/axi sync tdd-flow',
          explanation: 'Discovers tdd-flow in registered sources and links it into all satellite directories via directory junctions.',
          expectedOutput: `sync: tdd-flow
mode: link (junction)
source: C:\\Users\\user\\Desktop\\skills\\tdd-flow
targets:
  ~/.agents/skills/tdd-flow → linked
  ~/.claude/skills/tdd-flow → linked
  ~/.gemini/config/skills/tdd-flow → linked
  ~/.devin/skills/tdd-flow → linked
status: 4 linked, 0 errors`,
        } },
        { type: 'text', text: 'Common synchronization commands and flags:' },
        { type: 'list', items: [
          'axi sync — syncs all skills found in registered authoring sources across all satellites.',
          'axi sync <skill-name> — syncs only the specified skill.',
          'axi sync <skill-name> --dry-run — previews changes and validation results without writing to disk.',
          'axi sync <skill-name> --copy — forces physical file copying instead of junctions.',
          'axi sync <skill-name> --source <dir> --target <dir> — overrides default source discovery and target paths.',
        ] },
      ],
    },
    {
      id: 'mcp-sync-tool',
      heading: '2. Synchronizing via MCP Server',
      blocks: [
        { type: 'text', text: 'When operating inside GUI editors or host environments like Cursor, Claude Desktop, or VS Code, agents invoke the native reactive_sync tool.' },
        { type: 'code', example: {
          language: 'json',
          command: '{\n  "skill": "tdd-flow",\n  "link": true,\n  "dryRun": false\n}',
          explanation: 'MCP tool invocation for reactive_sync. The server performs discovery, junction creation, and structured result reporting.',
        } },
        { type: 'text', text: 'The tool returns a structured JSON payload detailing each target operation, whether existing folders were backed up, and any errors encountered.' },
      ],
    },
    {
      id: 'discovery-and-satellites',
      heading: '3. Source discovery & known satellites',
      blocks: [
        { type: 'text', text: 'The sync engine discovers authoring sources automatically from ~/.agents/sources.json and the active working directory. It knows about all standard agent harness skill locations out of the box.' },
        { type: 'table', caption: 'Recognized consumer satellites', columns: ['Satellite Path', 'Harness / Environment', 'Sync Strategy'], rows: [
          ['~/.agents/skills/', 'Canonical Agent Registry', 'Junction / Mirror'],
          ['~/.claude/skills/', 'Claude Code & Anthropic Harness', 'Junction / Mirror'],
          ['~/.gemini/config/skills/', 'Google Gemini & Antigravity IDE', 'Junction / Mirror'],
          ['~/.codex/skills/', 'Codex CLI', 'Junction / Mirror'],
          ['~/.devin/skills/', 'Devin Agent Harness', 'Junction / Mirror'],
          ['~/.cline/skills/', 'Cline & Roo-Cline', 'Junction / Mirror'],
          ['~/.copilot/skills/', 'GitHub Copilot', 'Junction / Mirror'],
          ['~/.kilocode/skills/', 'Kilocode Harness', 'Junction / Mirror'],
          ['~/.pi/skills/', 'Pi Agent Runtime', 'Junction / Mirror'],
          ['~/.hermes/skills/', 'Hermes Agent Framework', 'Junction / Mirror'],
          ['~/.crew/skills/', 'CrewAI & Formicary Agents', 'Junction / Mirror'],
        ] },
      ],
    },
    {
      id: 'backup-and-safety',
      heading: '4. Automatic safety backups',
      blocks: [
        { type: 'text', text: 'Before replacing an existing physical folder with a directory junction, the synchronizer automatically moves the prior directory to a timestamped backup folder under .sync-backups/.' },
        { type: 'callout', variant: 'warn', title: 'Non-destructive operations', text: 'Your previous files are never deleted unrecoverably. If an existing directory was previously copied manually, the sync engine moves it to .sync-backups/<skill>-<timestamp> before establishing the zero-drift link.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Authoring & customizing skills', href: '/docs/authoring' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Model Context Protocol (MCP)', href: '/docs/mcp' },
    { title: 'Quickstart walkthrough', href: '/docs/quickstart' },
  ],
};
