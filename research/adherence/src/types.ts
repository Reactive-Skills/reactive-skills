export type Arm = 'flat' | 'reactive';
export type TaskId = 'tdd' | 'workflow';
export type Pressure = 'immediate' | 'filler50k' | 'filler150k' | 'compaction';

export interface Cell {
  id: string;
  question: 1 | 2;
  task: TaskId;
  arm: Arm;
  pressure: Pressure;
}

/** One normalized observation from a run, in the order it happened. Holds no tool output text. */
export type TraceEvent =
  | { t: number; kind: 'user_message'; role: 'skill_load' | 'filler' | 'filler_during' | 'task' | 'nudge' | 'compact'; bytes: number }
  | { t: number; kind: 'assistant_turn'; message_id: string; context_tokens: number; output_tokens: number }
  | { t: number; kind: 'tool'; tool: string; target?: string; command?: string; is_error: boolean; result_bytes: number; tool_use_id: string; test_summary?: { pass: number; fail: number }; writes?: string[] }
  | { t: number; kind: 'check'; check: string; exit_code: number; source: 'agent' | 'guard'; hashes: Record<string, string | null> }
  | { t: number; kind: 'compact_boundary'; pre_tokens: number; post_tokens: number; summary_bytes?: number; summary_names_phases?: boolean }
  | { t: number; kind: 'runtime'; type: 'transition' | 'refused' | 'unhandled'; signal: string; from: string; to?: string; reason?: string; payload_exit_code?: number };

export interface RunUsage {
  model_usage_keys: string[];
  cost_usd: number;
  input_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  output_tokens: number;
  model_turns: number;
  wall_clock_ms: number;
}

export interface RunTrace {
  cell: Cell;
  rep: number;
  model: string;
  claude_code_version: string;
  filler_seed: number;
  status: 'completed' | 'timeout' | 'budget' | 'error';
  error?: string;
  context_tokens_at_task: number;
  events: TraceEvent[];
  usage: RunUsage;
  baseline_hashes: Record<string, string | null>;
  final_files: Record<string, string | null>;
  /** Workflow task only: content checks on the final workspace. */
  final_checks?: { triage_sections: number; changelog_fixed_entry: boolean; distractor_artifacts: string[] };
  acceptance: { passed: number; failed: number };
  end_checks: { test: number; lint: number; typecheck: number };
  summary_present: boolean;
  runtime_final_state: string | null;
}
