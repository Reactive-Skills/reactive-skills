import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import Handlebars from 'handlebars';
import {
  SkillManifest,
  SkillManifestSchema,
  StateDefinition,
  TransitionDefinition,
  SignalEvent,
  PromptSlice,
  ExecutionMetrics,
  EventContext,
  ChildRunSummary,
  DecisionRecord,
  StateVisitRecord,
  ContextDelta,
  StateModelDefinition,
} from './types.js';
import { EventStore, createSortableId } from './event-store.js';
import { GuardEvaluator } from './guard-evaluator.js';
import { LegacySkillAdapter } from './legacy-adapter.js';
import { ProjectionEngine } from './projection-engine.js';
import { JobManager, isJobTerminal } from './job-manager.js';

export interface FSMEngineOptions {
  skillDir: string;
  workspaceDir?: string;
  eventStore?: EventStore;
  eventContext?: EventContext;
  jobId?: string;
  runId?: string;
  initialContext?: Record<string, any>;
  autoRehydrate?: boolean;
  autoRotateTerminal?: boolean;
  perfThresholds?: {
    maxSliceDurationMs?: number;
    maxTransitionDurationMs?: number;
  };
}

/** Maximum lifecycle-signal drain steps per top-level handleSignal call.
 *  Prevents cyclic on_enter/on_exit emissions from overflowing the call stack (REL-02). */
const MAX_QUEUE_DRAIN_DEPTH = 50;

export class FSMEngine {
  private skillDir: string;
  private workspaceDir: string;
  private manifest: SkillManifest;
  private activeStatePath: string[] = [];
  private context: Record<string, any>;
  private eventStore: EventStore;
  private projectionEngine: ProjectionEngine;
  private signalQueue: Array<{ signal: string; payload?: Record<string, any>; metadata?: any }> = [];
  private isProcessingQueue = false;
  private signalQueueDepth = 0;
  private turnsSinceLastSignal: number;
  private inBypassState: boolean;
  private readonly strictExecution: boolean;
  private jobId?: string;
  private isActiveJob: boolean;
  private jobManager: JobManager;
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private lastSliceMetrics?: ExecutionMetrics;
  private maxSliceDurationMs = 10;
  private maxTransitionDurationMs = 25;
  private stateVisits: Map<string, StateVisitRecord> = new Map();

  constructor(options: FSMEngineOptions) {
    this.skillDir = path.resolve(options.skillDir);
    this.workspaceDir = options.workspaceDir || process.cwd();
    this.manifest = this.loadManifest();
    this.strictExecution = this.manifest.strict_execution === true;
    this.turnsSinceLastSignal = 0;
    this.inBypassState = false;
    if (options.perfThresholds?.maxSliceDurationMs !== undefined) {
      this.maxSliceDurationMs = options.perfThresholds.maxSliceDurationMs;
    }
    if (options.perfThresholds?.maxTransitionDurationMs !== undefined) {
      this.maxTransitionDurationMs = options.perfThresholds.maxTransitionDurationMs;
    }

    const effectiveJobId = options.jobId || options.runId;
    this.jobManager = new JobManager(this.workspaceDir);
    let activeJobId = this.jobManager.getActiveJobId(this.manifest.name);

    if (!effectiveJobId && options.autoRotateTerminal !== false) {
      const rotation = this.jobManager.rotateIfTerminal(this.manifest.name);
      if (rotation.rotated) {
        activeJobId = rotation.activeJobId;
      }
    }

    const resolvedJobId = effectiveJobId || activeJobId;
    const isActiveJob = (resolvedJobId === activeJobId);

    this.jobId = resolvedJobId;
    this.isActiveJob = isActiveJob;

    if (this.jobId) {
      const existingJob = this.jobManager.getJob(this.manifest.name, this.jobId);
      if (!existingJob) {
        this.jobManager.createJob(this.manifest.name, {
          id: this.jobId,
          name: this.jobId,
          initialState: this.manifest.initial_state,
          setActive: this.isActiveJob,
        });
      }
    }

    this.eventStore = options.eventStore || new EventStore({
      skillId: this.manifest.name,
      workspaceDir: this.workspaceDir,
      jobId: this.jobId,
      runId: this.jobId,
      enableSqlite: true,
      ...options.eventContext,
    });
    this.context = {
      ...(this.manifest.default_context || {}),
      ...(options.initialContext || {}),
    };
    this.projectionEngine = new ProjectionEngine(
      this.skillDir,
      this.manifest.deliverable_projections || [],
      options.workspaceDir || process.cwd(),
      this.jobId,
      this.isActiveJob
    );

    const autoRehydrate = options.autoRehydrate !== false;
    const latestSnapshot = autoRehydrate ? this.eventStore.getLatestSnapshot() : null;
    const history = autoRehydrate
      ? (latestSnapshot ? this.eventStore.getSince(latestSnapshot.seq) : this.eventStore.getAll())
      : [];

    if (autoRehydrate && (latestSnapshot || history.length > 0)) {
      this.rehydrate(history, latestSnapshot);
      if (this.jobId) {
        this.jobManager.updateJob(this.manifest.name, this.jobId, {
          currentState: this.getCurrentState(),
        });
      }
    } else {
      const initialPath = this.resolveInitialPath([this.manifest.initial_state]);
      this.activeStatePath = [...initialPath];

      this.eventStore.append('SKILL_INITIALIZED', {
        skill: this.manifest.name,
        initial_state: initialPath.join('.'),
        active_path: initialPath,
        context: this.context,
      }, { state: initialPath.join('.') });

      this.enterPath(initialPath, [], 'INITIAL_BOOT');
      this.eventStore.saveSnapshot(this.eventStore.getLatestSequence(), this.getCurrentState(), this.context);
      if (this.jobId) {
        this.jobManager.updateJob(this.manifest.name, this.jobId, {
          currentState: this.getCurrentState(),
        });
      }
    }
  }

  /**
   * Rehydrate state machine state and context from immutable event history,
   * resuming from the latest point-in-time state snapshot if available (PERF-02 / INV-08)
   */
  private rehydrate(
    events: SignalEvent[],
    snapshot?: { seq: number; state: string; context: Record<string, any> } | null
  ): void {
    const snap = snapshot !== undefined ? snapshot : this.eventStore.getLatestSnapshot();
    let latestPath: string[];
    let eventsToReplay = events;

    if (snap) {
      latestPath = snap.state.split('.');
      this.context = { ...this.context, ...snap.context };
      eventsToReplay = events.filter(e => e.seq > snap.seq);
    } else {
      latestPath = this.resolveInitialPath([this.manifest.initial_state]);
    }

    for (const e of eventsToReplay) {
      if (e.type === 'SKILL_INITIALIZED' && e.payload?.active_path) {
        latestPath = e.payload.active_path;
        if (e.payload.context) {
          this.context = { ...this.context, ...e.payload.context };
        }
      } else if (e.type === 'STATE_TRANSITION' && e.payload?.to) {
        latestPath = e.payload.to.split('.');
      } else if (e.type === 'STATE_ENTRY_HOOK' && e.payload?.action?.set_context) {
        this.updateContext(e.payload.action.set_context);
      } else if (e.type === 'SIGNAL_EMITTED') {
        if (this.manifest.context_keys) {
          const incomingContextUpdates: Record<string, any> = {};
          for (const key of this.manifest.context_keys) {
            if (e.payload[key] !== undefined) {
              incomingContextUpdates[key] = e.payload[key];
            }
          }
          if (Object.keys(incomingContextUpdates).length > 0) {
            this.updateContext(incomingContextUpdates);
          }
        }
        if (e.payload?.contextUpdates) {
          this.updateContext(e.payload.contextUpdates);
        }
      } else if (e.payload?.contextUpdates) {
        this.updateContext(e.payload.contextUpdates);
      }
    }

    this.activeStatePath = latestPath;

    // Recompute turn counter from event history
    this.turnsSinceLastSignal = 0;
    this.inBypassState = false;
    for (const e of eventsToReplay) {
      if (e.type === 'AGENT_TURN_STARTED') {
        this.turnsSinceLastSignal++;
      } else if (e.type === 'SIGNAL_EMITTED' || e.type === 'STATE_TRANSITION') {
        this.turnsSinceLastSignal = 0;
      }
      if (e.type === 'STATE_TRANSITION' && e.payload?.to === 'BYPASS_DETECTED') {
        this.inBypassState = true;
      }
    }

    // Restore turns_since_last_signal from snapshot context if available
    if (snap?.context?.turns_since_last_signal !== undefined) {
      this.turnsSinceLastSignal = snap.context.turns_since_last_signal;
    }
  }

  private loadManifest(): SkillManifest {
    const yamlPath = path.join(this.skillDir, 'skill.yaml');
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`Reactive skill manifest not found: ${yamlPath}`);
    }

    const raw = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.load(raw) as SkillManifest;
    const validated = SkillManifestSchema.parse(parsed);
    return validated as SkillManifest;
  }

  public getManifest(): SkillManifest {
    return this.manifest;
  }

  public getCurrentState(): string {
    return this.activeStatePath.join('.');
  }

  public getActiveStatePath(): string[] {
    return [...this.activeStatePath];
  }

  public getContext(): Record<string, any> {
    return { ...this.context };
  }

  public updateContext(updates: Record<string, any>): void {
    this.context = { ...this.context, ...updates };
  }

  public getSkillDir(): string {
    return this.skillDir;
  }

  public getEventStore(): EventStore {
    return this.eventStore;
  }

  public getEventContext(): EventContext {
    return this.eventStore.getEventContext();
  }

  public isStrictExecution(): boolean {
    return this.strictExecution;
  }

  public getTurnsSinceLastSignal(): number {
    return this.turnsSinceLastSignal;
  }

  public isBypassDetected(): boolean {
    return this.inBypassState;
  }

  public recordTurnStart(): void {
    if (!this.strictExecution || this.inBypassState) return;
    this.eventStore.append('AGENT_TURN_STARTED', {
      state: this.getCurrentState(),
      turns_since_last_signal: this.turnsSinceLastSignal + 1,
    }, { state: this.getCurrentState() });
    this.turnsSinceLastSignal++;
    this.checkBypass();
  }

  public checkBypass(): void {
    if (!this.strictExecution || this.inBypassState) return;
    const stateDef = this.getStateDefinition(this.activeStatePath);
    const maxIdleTurns = stateDef?.max_idle_turns ?? 2;
    if (this.turnsSinceLastSignal > maxIdleTurns) {
      const bypassTarget = stateDef?.bypass_target ?? 'BYPASS_DETECTED';
      this.eventStore.append('BYPASS_DETECTED', {
        reason: 'Agent exceeded max idle turns without emitting a signal',
        turns: this.turnsSinceLastSignal,
        max_idle_turns: maxIdleTurns,
        state: this.getCurrentState(),
      }, { state: bypassTarget });
      this.eventStore.append('STATE_TRANSITION', {
        from: this.getCurrentState(),
        to: bypassTarget,
        signal: 'BYPASS_DETECTED',
        payload: { reason: 'Agent exceeded max idle turns without emitting a signal' },
      }, { state: bypassTarget });
      this.inBypassState = true;
      this.activeStatePath = [bypassTarget];
      this.turnsSinceLastSignal = 0;
      throw new Error(
        `BYPASS_DETECTED: Agent exceeded ${maxIdleTurns} idle turns without emitting a signal. ` +
        `The runtime has entered the BYPASS_DETECTED state. ` +
        `To recover, run: reactive-skills-axi reset ${this.manifest.name} then re-invoke.`
      );
    }
  }

  public recordChildRunStarted(childSkillId: string, childRunId: string, requestId?: string): SignalEvent {
    return this.eventStore.append('CHILD_RUN_STARTED', {
      child_skill_id: childSkillId,
      child_run_id: childRunId,
      request_id: requestId,
    });
  }

  public recordChildRunCompleted(summary: ChildRunSummary): SignalEvent {
    const eventType = summary.outcome === 'failed' ? 'CHILD_RUN_FAILED' : 'CHILD_RUN_COMPLETED';
    return this.eventStore.append(eventType, summary);
  }

  public async invokeSkill(skillNameOrPath: string): Promise<{
    skillId: string;
    currentState: string;
    promptSlice: PromptSlice;
    event: SignalEvent;
  }> {
    const skillDir = path.resolve(this.workspaceDir || process.cwd(), skillNameOrPath);
    const skillYamlPath = path.join(skillDir, 'skill.yaml');
    let manifest: SkillManifest;

    if (fs.existsSync(skillYamlPath)) {
      const raw = fs.readFileSync(skillYamlPath, 'utf8');
      const parsed = yaml.load(raw) as SkillManifest;
      manifest = SkillManifestSchema.parse(parsed);
    } else {
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        throw new Error(`Skill not found: ${skillNameOrPath} (no skill.yaml or SKILL.md at ${skillDir})`);
      }
      manifest = LegacySkillAdapter.wrapAsReactiveManifest(skillMdPath);
    }

    const childRunId = createSortableId();
    const startEvent = this.recordChildRunStarted(manifest.name, childRunId);

    let outcome: 'completed' | 'failed' = 'completed';
    let childState = manifest.initial_state;
    let promptSlice: PromptSlice;

    try {
      const childEngine = new FSMEngine({
        skillDir,
        workspaceDir: this.workspaceDir,
        runId: childRunId,
        eventContext: {
          skill_id: manifest.name,
          parent_run_id: this.getEventContext().run_id,
        },
        initialContext: this.context,
      });
      childState = childEngine.getCurrentState();
      promptSlice = childEngine.generatePromptSlice();
    } catch (err) {
      outcome = 'failed';
      promptSlice = {
        state: manifest.initial_state,
        rawPrompt: `Failed to invoke skill: ${err instanceof Error ? err.message : String(err)}`,
        formattedXml: '',
        allowedTools: [],
        context: {},
        scopedContext: {},
        contextDelta: null,
        visitCount: 0,
        exitConditions: [],
      };
    }

    this.recordChildRunCompleted({
      child_skill_id: manifest.name,
      child_run_id: childRunId,
      outcome,
      failed_state: outcome === 'failed' ? childState : undefined,
      summary: `Invoked ${manifest.name} at state ${childState}`,
      evidence_ref: startEvent.id,
    });

    return {
      skillId: manifest.name,
      currentState: childState,
      promptSlice,
      event: startEvent,
    };
  }


  public recordDecision(decision: DecisionRecord, source = 'human_ingress'): SignalEvent {
    return this.eventStore.append('DECISION_RECORDED', decision, { source });
  }

  /**
   * Resolves full hierarchical path including default/initial substates
   */
  private resolveInitialPath(basePath: string[]): string[] {
    const fullPath = [...basePath];
    let currentDef = this.getStateDefinition(fullPath);

    while (currentDef && currentDef.initial_substate && currentDef.substates) {
      const nextSub = currentDef.initial_substate;
      fullPath.push(nextSub);
      currentDef = currentDef.substates[nextSub];
    }

    return fullPath;
  }

  /**
   * Get StateDefinition by path hierarchy
   */
  public getStateDefinition(pathSegments: string[]): StateDefinition | null {
    if (pathSegments.length === 0) return null;
    const rootName = pathSegments[0];
    let current: StateDefinition | undefined = this.manifest.states[rootName];
    if (!current) return null;

    for (let i = 1; i < pathSegments.length; i++) {
      const seg = pathSegments[i];
      if (!current.substates || !current.substates[seg]) {
        return null;
      }
      current = current.substates[seg];
    }

    return current;
  }

  /**
   * Generates the prompt slice for the active state hierarchy
   */
  public generatePromptSlice(): PromptSlice {
    const startTime = performance.now();
    const activeLeaf = this.getStateDefinition(this.activeStatePath);
    if (!activeLeaf) {
      throw new Error(`Active state definition not found: ${this.getCurrentState()}`);
    }

    // Find prompt template: check leaf first, then fallback to parent if leaf has none
    let templatePath: string | null = null;
    for (let i = this.activeStatePath.length; i >= 1; i--) {
      const depthPath = this.activeStatePath.slice(0, i);
      const def = this.getStateDefinition(depthPath);

      // 1. Explicit prompt_template path
      if (def?.prompt_template) {
        const candidate = path.resolve(this.skillDir, def.prompt_template);
        if (fs.existsSync(candidate)) {
          templatePath = candidate;
          break;
        }
      }

      // 2. Convention over configuration fallback: states/<leaf_name_lowercase>.md
      const leafName = depthPath[depthPath.length - 1].toLowerCase();
      const conventionCandidates = [
        path.resolve(this.skillDir, 'states', `${leafName}.md`),
        path.resolve(this.skillDir, 'states', `${depthPath.join('_').toLowerCase()}.md`),
        path.resolve(this.skillDir, `${leafName}.md`),
      ];

      for (const candidate of conventionCandidates) {
        if (fs.existsSync(candidate)) {
          templatePath = candidate;
          break;
        }
      }

      if (templatePath) break;
    }

    let rawPrompt = '';
    if (templatePath && fs.existsSync(templatePath)) {
      let compiled = this.templateCache.get(templatePath);
      if (!compiled) {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        compiled = Handlebars.compile(templateContent);
        this.templateCache.set(templatePath, compiled);
      }
      const scopedContext = this.computeScopedContext();
      rawPrompt = compiled({
        state: this.getCurrentState(),
        activeStatePath: this.activeStatePath,
        context: scopedContext,
        manifest: this.manifest,
      });
    } else {
      rawPrompt = `Execute instructions for state: ${this.getCurrentState()}`;
    }

    // Aggregate allowed tools up the active ancestor hierarchy
    const allowedToolsSet = new Set<string>();
    for (let i = 1; i <= this.activeStatePath.length; i++) {
      const def = this.getStateDefinition(this.activeStatePath.slice(0, i));
      if (def?.tools) {
        for (const tool of def.tools) {
          allowedToolsSet.add(tool);
        }
      }
    }
    const allowedTools = Array.from(allowedToolsSet);

    // Format model contract
    let modelContractXml = '';
    let modelContract: StateModelDefinition | null = null;
    if (activeLeaf.model) {
      modelContract = typeof activeLeaf.model === 'string' ? { tier: activeLeaf.model } : activeLeaf.model;
      const tier = modelContract.tier || 'balanced';
      const suggestedAttr = modelContract.suggested ? ` suggested="${modelContract.suggested}"` : '';
      const tempAttr = modelContract.temperature !== undefined ? ` temperature="${modelContract.temperature}"` : '';
      modelContractXml = `  <model_contract tier="${tier}"${suggestedAttr}${tempAttr} />`;
    }

    // Aggregate available exit transitions
    const exitConditions: string[] = [];
    for (let i = this.activeStatePath.length; i >= 1; i--) {
      const depthPath = this.activeStatePath.slice(0, i);
      const def = this.getStateDefinition(depthPath);
      if (def?.transitions) {
        for (const [signal, trans] of Object.entries(def.transitions)) {
          const transDef: TransitionDefinition = typeof trans === 'string' ? { target: trans } : trans;
          let condStr = `[${depthPath.join('.')}] On signal '${signal}' -> transition to '${transDef.target}'`;
          if (transDef.guard) {
            condStr += ` (guard: ${transDef.guard})`;
          }
          if (transDef.judgment) {
            condStr += ` (judgment: ${transDef.judgment.type} '${transDef.judgment.criterion}')`;
          }
          exitConditions.push(condStr);
        }
      }
    }

    const humanGate = activeLeaf.human_gate;
    let humanGateXml = '';
    if (humanGate) {
      humanGateXml = [
        `  <human_gate type="${humanGate.type}" tool="${humanGate.tool || 'ask_question'}">`,
        `    <instruction>This state requires human input/approval. Use ${humanGate.tool || 'ask_question'} or the review surface to collect user decision, then STOP calling tools to conclude your turn.</instruction>`,
        humanGate.options ? `    <options>${humanGate.options.join(' | ')}</options>` : '',
        `  </human_gate>`,
      ].filter(Boolean).join('\n');
    }

    const contextDelta = this.computeContextDelta();
    const scopedContext = this.computeScopedContext();

    const deltaXml = contextDelta
      ? [
        `  <context_delta is_revisit="${contextDelta.is_revisit}" previous_visit_seq="${contextDelta.previous_visit_seq}">`,
        contextDelta.changed_keys.length > 0
          ? `    <changed_keys>${contextDelta.changed_keys.map(k => `${k.key}`).join(', ')}</changed_keys>`
          : `    <changed_keys></changed_keys>`,
        `    <new_since_last_visit>${contextDelta.new_since_last_visit}</new_since_last_visit>`,
        `  </context_delta>`,
      ].join('\n')
      : '';

    const formattedXml = [
      `<reactive_skill_state name="${this.getCurrentState()}" path="${this.activeStatePath.join('/')}" skill="${this.manifest.name}">`,
      modelContractXml,
      this.strictExecution ? '  <strict_execution mode="enforced">' : '',
      '    <contract>TODO Card: Load -> Execute -> Emit</contract>',
      '    <contract>Every agent turn must produce a signal via reactive_emit_signal. Fetching state without emitting a signal counts against the idle budget.</contract>',
      `    <contract>Max idle turns: ${this.getStateDefinition(this.activeStatePath)?.max_idle_turns ?? 2}. Exceeding this triggers auto-abort to BYPASS_DETECTED.</contract>`,
      '    <contract>Allowed tools are enforced. Tools outside the allowed list will trigger bypass detection in interceptor mode.</contract>',
      '    <contract>Recovery: reactive-skills-axi reset <skill> then re-invoke.</contract>',
      '  </strict_execution>',
      contextDelta ? `  <context_optimization state_visit_count="${contextDelta.is_revisit ? 'revisit' : 'first'}">Context is scoped to this state\'s relevant keys only. Delta shown for revisions.</context_optimization>` : '',
      `  <state_goal>`,
      rawPrompt.trim().split('\n').map(line => `    ${line}`).join('\n'),
      `  </state_goal>`,
      `  <allowed_tools>`,
      allowedTools.map(t => `    <tool name="${t}" />`).join('\n'),
      `  </allowed_tools>`,
      humanGateXml,
      deltaXml,
      `  <transition_contracts>`,
      exitConditions.map(c => `    <contract>${c}</contract>`).join('\n'),
      `  </transition_contracts>`,
      `</reactive_skill_state>`,
    ].filter(Boolean).join('\n');

    const durationMs = Number((performance.now() - startTime).toFixed(3));
    const estTokens = Math.ceil(formattedXml.length / 4);
    const metrics: ExecutionMetrics = {
      slice_duration_ms: durationMs,
      slice_tokens_est: estTokens,
      allowed_tools_count: allowedTools.length,
    };
    this.lastSliceMetrics = metrics;

    if (durationMs > this.maxSliceDurationMs) {
      this.eventStore.append('PERF_DEGRADATION', {
        operation: 'generatePromptSlice',
        duration_ms: durationMs,
        threshold_ms: this.maxSliceDurationMs,
        state: this.getCurrentState(),
      }, { state: this.getCurrentState() });
    }

    return {
      state: this.getCurrentState(),
      rawPrompt,
      formattedXml,
      allowedTools,
      context: { ...this.context },
      scopedContext,
      contextDelta,
      visitCount: this.eventStore.query({ type: 'STATE_VISITED', state: this.getCurrentState() }).length,
      exitConditions,
      modelContract,
      metrics,
    };
  }

  /**
   * Check if current state has a blocking Human-in-the-Loop gate
   */
  public isWaitingForHuman(): boolean {
    const activeLeaf = this.getStateDefinition(this.activeStatePath);
    return Boolean(activeLeaf?.human_gate);
  }

  /**
   * Process an incoming signal event, evaluating transitions with HSM bubbling and draining queued signals
   */
  public async handleSignal(
    signalName: string,
    payload: Record<string, any> = {},
    metadata: { source?: string; causationId?: string } = {}
  ): Promise<{
    transitioned: boolean;
    previousState: string;
    newState: string;
    event: SignalEvent;
    handledAtDepth?: number;
    deliverablesWritten: string[];
    metrics?: ExecutionMetrics;
  }> {
    const startTime = performance.now();
    const previousState = this.getCurrentState();
    const prevPath = [...this.activeStatePath];

    const event =     this.eventStore.append(
      'SIGNAL_EMITTED',
      { signal: signalName, ...payload },
      { source: metadata.source, causationId: metadata.causationId, state: previousState }
    );

    this.turnsSinceLastSignal = 0;

    // Merge incoming payload fields that match context_keys into the context
    if (this.manifest.context_keys) {
      const incomingContextUpdates: Record<string, any> = {};
      for (const key of this.manifest.context_keys) {
        if (payload[key] !== undefined) {
          incomingContextUpdates[key] = payload[key];
        }
      }
      if (Object.keys(incomingContextUpdates).length > 0) {
        this.updateContext(incomingContextUpdates);
      }
    }

    // Bubble search: test from deepest leaf substate up to root
    for (let depth = this.activeStatePath.length; depth >= 1; depth--) {
      const testPath = this.activeStatePath.slice(0, depth);
      const stateDef = this.getStateDefinition(testPath);

      if (stateDef?.transitions && stateDef.transitions[signalName]) {
        const transRaw = stateDef.transitions[signalName];
        const transDef: TransitionDefinition = typeof transRaw === 'string' ? { target: transRaw } : transRaw;

        if (depth < this.activeStatePath.length) {
          this.eventStore.append('EVENT_BUBBLED', {
            signal: signalName,
            fromLeaf: previousState,
            handledAt: testPath.join('.'),
            depth,
          }, { state: previousState, causationId: event.id });
        }

        // Evaluate Guard & Snap-On Judgment
        const guardResult = await GuardEvaluator.evaluate(
          transDef.guard,
          transDef.guardFunction,
          {
            event,
            context: this.context,
            currentState: testPath.join('.'),
            skillDir: this.skillDir,
          },
          transDef.judgment
        );

        this.eventStore.append(
          'GUARD_EVALUATED',
          {
            guard: transDef.guard || transDef.guardFunction || (transDef.judgment ? `judgment:${transDef.judgment.type}` : 'true'),
            passed: guardResult.passed,
            target: transDef.target,
            handledAt: testPath.join('.'),
            error: guardResult.error,
            judgment: guardResult.judgmentResult,
            fallbackTriggered: guardResult.fallbackTriggered,
            fallbackTarget: guardResult.fallbackTarget,
          },
          { state: testPath.join('.'), causationId: event.id }
        );

        let effectiveTarget = transDef.target;
        let isTransitioning = guardResult.passed;

        if (!guardResult.passed && guardResult.fallbackTarget) {
          effectiveTarget = guardResult.fallbackTarget;
          isTransitioning = true;
          this.eventStore.append(
            'GUARD_FALLBACK_TRIGGERED',
            {
              from: previousState,
              to: effectiveTarget,
              originalTarget: transDef.target,
              reason: guardResult.error || 'Judgment rejected or below confidence threshold',
              judgment: guardResult.judgmentResult,
            },
            { state: testPath.join('.'), causationId: event.id }
          );
        }

        if (isTransitioning) {
          // Auto-invoke child skill if transition declares it
          if (transDef.invoke) {
            await this.invokeSkill(transDef.invoke);
          }

          // Parse target path (supports dot notation, e.g. "REFACTOR.EXTRACT_METHOD" or "GREEN_CODE")
          const targetSegments = effectiveTarget.split('.');
          const fullTargetPath = this.resolveInitialPath(targetSegments);

          const transitionDurationMs = Number((performance.now() - startTime).toFixed(3));
          const metrics: ExecutionMetrics = {
            transition_duration_ms: transitionDurationMs,
            slice_duration_ms: this.lastSliceMetrics?.slice_duration_ms,
            slice_tokens_est: this.lastSliceMetrics?.slice_tokens_est,
          };

          if (transitionDurationMs > this.maxTransitionDurationMs) {
            this.eventStore.append('PERF_DEGRADATION', {
              operation: 'handleSignal',
              duration_ms: transitionDurationMs,
              threshold_ms: this.maxTransitionDurationMs,
              signal: signalName,
              from: previousState,
              to: fullTargetPath.join('.'),
            }, { state: fullTargetPath.join('.') });
          }

          // Execute exit hooks and entry hooks along the transition path
          this.transitionBetweenPaths(prevPath, fullTargetPath, signalName, event.id, payload, metrics);

          // PERF-02 / INV-08: Persist state snapshot for fast cold-boot rehydration
          this.eventStore.saveSnapshot(this.eventStore.getLatestSequence(), this.getCurrentState(), this.context);

          // Render deliverables
          const deliverablesWritten = this.projectionEngine.project(
            this.eventStore,
            this.getCurrentState(),
            this.manifest.name,
            this.context,
            signalName
          );

          // Drain queued lifecycle signals with cycle-depth guard (REL-02)
          if (!this.isProcessingQueue && this.signalQueue.length > 0) {
            this.isProcessingQueue = true;
            this.signalQueueDepth = 0;
            try {
              while (this.signalQueue.length > 0) {
                this.signalQueueDepth += 1;
                if (this.signalQueueDepth > MAX_QUEUE_DRAIN_DEPTH) {
                  const cycleError = new RangeError(
                    `Signal queue cycle detected: exceeded ${MAX_QUEUE_DRAIN_DEPTH} drain steps. ` +
                    `Check on_enter/on_exit lifecycle hooks for directed cycles in skill '${this.manifest.name}'.`
                  );
                  this.eventStore.append('SIGNAL_QUEUE_CYCLE_DETECTED', {
                    depth: this.signalQueueDepth,
                    skill: this.manifest.name,
                    pendingSignals: this.signalQueue.map(s => s.signal),
                  });
                  this.signalQueue = [];
                  throw cycleError;
                }
                const next = this.signalQueue.shift()!;
                await this.handleSignal(next.signal, next.payload || {}, next.metadata || {});
              }
            } finally {
              this.isProcessingQueue = false;
              this.signalQueueDepth = 0;
            }
          }

          if (this.jobId) {
            const newState = this.getCurrentState();
            const isTerminal = isJobTerminal({ currentState: newState, status: 'active' } as any);
            this.jobManager.updateJob(this.manifest.name, this.jobId, {
              currentState: newState,
              status: isTerminal ? 'completed' : 'active',
              completedAt: isTerminal ? new Date().toISOString() : undefined,
            });
          }

          return {
            transitioned: true,
            previousState,
            newState: this.getCurrentState(),
            event,
            handledAtDepth: depth,
            deliverablesWritten,
            metrics,
          };
        }
      }
    }

    return {
      transitioned: false,
      previousState,
      newState: previousState,
      event,
      deliverablesWritten: [],
    };
  }

  /**
   * Transition between two hierarchical paths executing exit, transition, and entry hooks
   */
  private transitionBetweenPaths(
    fromPath: string[],
    toPath: string[],
    signalName: string,
    causationId: string,
    payload: Record<string, any>,
    metrics?: ExecutionMetrics
  ): void {
    // 1. Find Lowest Common Ancestor (LCA)
    let lcaDepth = 0;
    const maxDepth = Math.min(fromPath.length, toPath.length);
    while (lcaDepth < maxDepth && fromPath[lcaDepth] === toPath[lcaDepth]) {
      lcaDepth++;
    }

    // 2. Exit states from leaf up to LCA (exclusive)
    for (let i = fromPath.length; i > lcaDepth; i--) {
      const exitSubpath = fromPath.slice(0, i);
      this.executeExitHook(exitSubpath, signalName);
    }

    // 3. Record STATE_TRANSITION event in EventStore
    this.eventStore.append('STATE_TRANSITION', {
      from: fromPath.join('.'),
      to: toPath.join('.'),
      signal: signalName,
      payload,
      metrics,
    }, {
      state: toPath.join('.'),
      causationId,
    });

    // 4. Update active state path and context updates
    this.activeStatePath = [...toPath];
    if (payload?.contextUpdates) {
      this.updateContext(payload.contextUpdates);
    }

    // 5. Enter states from LCA (exclusive) down to leaf
    this.enterPath(toPath, fromPath.slice(0, lcaDepth), signalName);
  }

  /**
   * Enter a state hierarchy starting below the common ancestor
   */
  private enterPath(targetPath: string[], ancestorPath: string[], triggerSignal: string): void {
    for (let i = ancestorPath.length + 1; i <= targetPath.length; i++) {
      const enterSubpath = targetPath.slice(0, i);
      this.executeEntryHook(enterSubpath, triggerSignal);
    }
  }

  private executeEntryHook(statePath: string[], triggerSignal: string): void {
    const def = this.getStateDefinition(statePath);
    if (!def) return;

    const stateKey = statePath.join('.');

    // Track state visitation for delta detection on revisits
    const prevVisit = this.stateVisits.get(stateKey);
    const visitSeq = this.eventStore.getLatestSequence();
    const contextSnapshot = { ...this.context };

    if (prevVisit) {
      this.eventStore.append('STATE_REVISITED', {
        state: stateKey,
        previous_visit_seq: prevVisit.seq,
        current_seq: visitSeq,
        changed_keys: this.computeChangedKeys(prevVisit.context_snapshot, this.context),
        context_snapshot: contextSnapshot,
      }, { state: stateKey, causationId: prevVisit.seq.toString() });
    } else {
      this.eventStore.append('STATE_VISITED', {
        state: stateKey,
        seq: visitSeq,
        context_snapshot: contextSnapshot,
      }, { state: stateKey });
    }

    this.stateVisits.set(stateKey, {
      state: stateKey,
      seq: visitSeq,
      context_snapshot: contextSnapshot,
    });

    if (def.human_gate) {
      this.eventStore.append('HUMAN_GATE_ENTERED', {
        state: statePath.join('.'),
        gateType: def.human_gate.type,
        tool: def.human_gate.tool || 'ask_question',
        options: def.human_gate.options,
      }, { state: statePath.join('.') });
    }

    if (def.on_enter) {
      for (const action of def.on_enter) {
        if (action.set_context) {
          this.updateContext(action.set_context);
        }
        if (action.emit_signal) {
          this.eventStore.append('STATE_ENTRY_HOOK', {
            state: statePath.join('.'),
            signalEmitted: action.emit_signal,
            action: action.action,
          }, { state: statePath.join('.') });

          // Queue signal to execute transition cleanly after current cycle
          this.signalQueue.push({
            signal: action.emit_signal,
            payload: {},
            metadata: { source: `on_enter:${statePath.join('.')}` },
          });
        }
      }
    }
  }

  private executeExitHook(statePath: string[], triggerSignal: string): void {
    const def = this.getStateDefinition(statePath);
    if (!def || !def.on_exit) return;

    for (const action of def.on_exit) {
      if (action.set_context) {
        this.updateContext(action.set_context);
      }
      if (action.emit_signal) {
        this.eventStore.append('STATE_EXIT_HOOK', {
          state: statePath.join('.'),
          signalEmitted: action.emit_signal,
          action: action.action,
        }, { state: statePath.join('.') });

        // Queue signal
        this.signalQueue.push({
          signal: action.emit_signal,
          payload: {},
          metadata: { source: `on_exit:${statePath.join('.')}` },
        });
      }
    }
  }

  public getJobId(): string | undefined {
    return this.jobId;
  }

  public isJobActive(): boolean {
    return this.isActiveJob;
  }

  public getLastMetrics(): ExecutionMetrics | undefined {
    return this.lastSliceMetrics;
  }

  public clearTemplateCache(): void {
    this.templateCache.clear();
  }

  /**
   * Compute the scoped context for the active state: only include context_keys
   * declared in this state's (or any ancestor's) `context_scope`. Internal
   * keys (starting with _) and context_keys not in any scope are always included.
   */
   private computeScopedContext(): Record<string, any> {
    const scopeKeys = new Set<string>();
    let hasAnyScopeDeclaration = false;
    for (let i = 1; i <= this.activeStatePath.length; i++) {
      const def = this.getStateDefinition(this.activeStatePath.slice(0, i));
      if (def?.context_scope !== undefined) {
        hasAnyScopeDeclaration = true;
        for (const key of def!.context_scope) {
          scopeKeys.add(key);
        }
      }
    }

    // No context_scope declared on any state in the active path: return full context
    if (!hasAnyScopeDeclaration) {
      return { ...this.context };
    }

    // context_scope was explicitly declared (even if empty): scope to those keys
    const scoped: Record<string, any> = {};
    for (const key of this.manifest.context_keys || []) {
      if (scopeKeys.has(key) || key.startsWith('_')) {
        scoped[key] = this.context[key];
      }
    }
    return scoped;
  }

  /**
   * Compute context delta for revisiting a state. Returns null if this is a
   * first visit. If revisiting, compares current context against the snapshot
   * captured at the previous visit, restricted to this state's scope.
   */
  private computeContextDelta(): ContextDelta | null {
    const stateKey = this.getCurrentState();

    // Query the event store for all visit events for this state (both
    // STATE_VISITED for first entry and STATE_REVISITED for returns).
    const visitedEvents = this.eventStore.query({ type: 'STATE_VISITED', state: stateKey });
    const revisitedEvents = this.eventStore.query({ type: 'STATE_REVISITED', state: stateKey });
    const allVisitEvents = [...visitedEvents, ...revisitedEvents].sort((a, b) => a.seq - b.seq);

    // No visits or only one visit = first visit, no delta
    if (allVisitEvents.length <= 1) {
      return null;
    }

    // This is a revisit: use the second-to-last visit event as the
    // "previous visit" baseline for diffing.
    const prevVisit = allVisitEvents[allVisitEvents.length - 2];
    const prevVisitSeq = prevVisit.seq;
    const prevContextSnapshot = prevVisit.payload.context_snapshot || {};

    const scopeKeys = new Set<string>();
    for (let i = 1; i <= this.activeStatePath.length; i++) {
      const def = this.getStateDefinition(this.activeStatePath.slice(0, i));
      if (def?.context_scope) {
        for (const key of def.context_scope) {
          scopeKeys.add(key);
        }
      }
    }

    const changedKeys = this.computeChangedKeys(prevContextSnapshot, this.context, scopeKeys);

    const eventsSince = this.eventStore.query({ sinceSeq: prevVisitSeq });
    const newSinceLastVisit = eventsSince.length;

    return {
      is_revisit: true,
      previous_visit_seq: prevVisitSeq,
      changed_keys: changedKeys,
      new_since_last_visit: newSinceLastVisit,
      context_snapshot: this.computeScopedContext(),
    };
  }

  /**
   * Compute which context keys (restricted to scopeKeys if provided) differ
   * between two context snapshots. Returns an array of {key, previous, current}.
   */
  private computeChangedKeys(
    prevContext: Record<string, any>,
    currContext: Record<string, any>,
    scopeKeys?: Set<string>,
  ): Array<{ key: string; previous: any; current: any }> {
    const changed: Array<{ key: string; previous: any; current: any }> = [];
    const keysToCompare = scopeKeys
      ? Array.from(scopeKeys)
      : Object.keys(currContext);

    for (const key of keysToCompare) {
      const prevVal = prevContext[key];
      const currVal = currContext[key];
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        changed.push({ key, previous: prevVal, current: currVal });
      }
    }
    return changed;
  }

  public getVisitHistory(): StateVisitRecord[] {
    return Array.from(this.stateVisits.values());
  }

  public getStateVisitCount(stateKey: string): number {
    const visited = this.eventStore.query({ type: 'STATE_VISITED', state: stateKey });
    const revisited = this.eventStore.query({ type: 'STATE_REVISITED', state: stateKey });
    return visited.length + revisited.length;
  }

  public close(): void {
    this.eventStore.close();
  }
}
