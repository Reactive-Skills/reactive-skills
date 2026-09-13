export interface SuggestionContext {
  domain?: 'home' | 'init' | 'upgrade' | 'inspect' | 'events' | 'invoke' | 'state' | 'emit' | 'setup' | 'reset';
  action?: 'list' | 'create' | 'convert' | 'view' | 'tail' | 'call' | 'get' | 'signal' | 'configure';
  skillName?: string;
  isEmpty?: boolean;
  id?: string;
}

export type ErrorCode = 'NOT_FOUND' | 'ALREADY_EXISTS' | 'INVALID_SKILL' | 'VALIDATION_ERROR' | 'NO_EVENT_STORE' | 'RUNTIME_ERROR' | 'UNKNOWN';

export function getSuggestions(ctx: SuggestionContext): string[] {
  const { domain, action, skillName } = ctx;

  switch (domain) {
    case 'home':
      if (action === 'list') {
        return [
          'Run `reactive-skills-axi init <name>` to scaffold a new reactive skill',
          'Run `reactive-skills-axi inspect <path>` to inspect a skill statechart',
          'Run `reactive-skills-axi events` to tail recent events',
          'Run `reactive-skills-axi reset <skill>` to clear a prior skill run',
        ];
      }
      return [
        'Run `reactive-skills-axi init <name>` to create a new reactive skill',
        'Run `reactive-skills-axi upgrade <path>` to convert a legacy SKILL.md',
        'Run `reactive-skills-axi inspect <path>` to view a skill statechart',
        'Run `reactive-skills-axi events [limit]` to tail event ledger',
        'Run `reactive-skills-axi reset <skill>` to clear a prior skill run',
      ];

    case 'init':
      if (action === 'create' && skillName) {
        return [
          'Run `reactive-skills-axi inspect skills/' + skillName + '` to see the statechart',
          'Run `reactive-skills-axi events` to watch the event ledger',
          'Edit skills/' + skillName + '/skill.yaml to customize the state machine',
        ];
      }
      return [
        'Run `reactive-skills-axi init <name>` to scaffold a new reactive skill',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'upgrade':
      if (action === 'convert' && skillName) {
        return [
          'Run `reactive-skills-axi inspect skills/' + skillName + '` to see the new statechart',
          'Run `reactive-skills-axi events` to watch the event ledger',
          'Edit the generated skill.yaml to customize transitions',
        ];
      }
      return [
        'Run `reactive-skills-axi upgrade <path>` to convert a legacy SKILL.md',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'inspect':
      if (action === 'view' && skillName) {
        return [
          'Run `reactive-skills-axi events` to tail the event ledger for this skill',
          'Run `reactive-skills-axi inspect skills/' + skillName + '` to re-view the statechart',
          'Edit skill.yaml to add states or modify transitions',
        ];
      }
      return [
        'Run `reactive-skills-axi events` to tail the event ledger',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'events':
      if (action === 'tail') {
        return [
          'Run `reactive-skills-axi inspect` to see the skill statechart',
          'Run `reactive-skills-axi events 50` to show more events',
          'Run `reactive-skills-axi` to return to the dashboard',
        ];
      }
      return [
        'Run `reactive-skills-axi inspect` to see the statechart',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'invoke':
      if (action === 'call' && skillName) {
        return [
          'Read the state prompt above and execute the instructed tasks',
          'Run `reactive-skills-axi emit ' + skillName + ' <signal>` to advance to the next state',
          'Run `reactive-skills-axi state ' + skillName + '` to re-read the active state prompt',
          'Run `reactive-skills-axi reset ' + skillName + '` to clear this run and start fresh',
        ];
      }
      return [
        'Run `reactive-skills-axi invoke <skill>` to start a skill session',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'state':
      if (skillName) {
        return [
          'Read the state prompt above and execute the instructed tasks',
          'Run `reactive-skills-axi emit ' + skillName + ' <signal>` to advance the state machine',
          'Run `reactive-skills-axi reset ' + skillName + '` to clear this run and start fresh',
        ];
      }
      return [
        'Run `reactive-skills-axi state <skill>` to check active state and instructions',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'emit':
      if (action === 'signal' && skillName) {
        return [
          'Read the new state prompt above and execute the next phase tasks',
          'Run `reactive-skills-axi emit ' + skillName + ' <signal>` to continue advancing',
          'Run `reactive-skills-axi state ' + skillName + '` to re-read the active state prompt',
          'Run `reactive-skills-axi events` to view the event history',
        ];
      }
      return [
        'Run `reactive-skills-axi emit <skill> <signal> [--payload JSON]` to advance a state machine',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    case 'setup':
      return [
        'Restart your agent harness (Claude Desktop, Cursor, Antigravity) to load the new MCP server',
        'Run `reactive-skills-axi invoke <skill>` to start a reactive skill session',
        'Run `reactive-skills-axi` to view discovered skills',
      ];

    case 'reset':
      if (action === 'call' && skillName) {
        return [
          `Run \`reactive-skills-axi invoke ${skillName}\` to start a fresh run`,
          'Run `reactive-skills-axi events` to verify the event log was cleared',
          'Run `reactive-skills-axi` to return to the dashboard',
        ];
      }
      return [
        'Run `reactive-skills-axi reset <skill-name>` to clear a prior skill run',
        'Run `reactive-skills-axi` to return to the dashboard',
      ];

    default:
      return [
        'Run `reactive-skills-axi init <name>` to create a new reactive skill',
        'Run `reactive-skills-axi upgrade <path>` to convert a legacy SKILL.md',
        'Run `reactive-skills-axi inspect <path>` to view a skill statechart',
        'Run `reactive-skills-axi events [limit]` to tail event ledger',
        'Run `reactive-skills-axi reset <skill>` to clear a prior skill run',
      ];
  }
}
