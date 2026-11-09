import { AsyncLocalStorage } from 'node:async_hooks';

/** One CLI operation's resolved root, without mutating process environment or cwd. */
export const workspaceContext = new AsyncLocalStorage<{ root: string }>();

export const WORKSPACE_COMMANDS = new Set(['invoke', 'state', 'emit', 'events', 'jobs', 'reset', 'evidence', 'approve', 'rebuild-sqlite', 'view', 'watch', 'dashboard']);

export const WORKSPACE_HELP = '\n--workspace <directory> selects the run workspace and takes precedence over WORKSPACE_DIR.\nLater commands discover recorded roots; competing workspaces require an explicit choice.\ncontext.workspace_root is descriptive and does not move runtime storage.';
