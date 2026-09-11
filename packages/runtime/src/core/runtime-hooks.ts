import { FSMEngine } from './fsm-engine.js';
import { PromptSlice, SignalEvent } from './types.js';

const RUNTIME_TOOLS = new Set([
  'reactive_state',
  'reactive_emit_signal',
  'reactive_query',
  'reactive_query_events',
  'reactive_list_skills',
  'reactive_inspect',
  'reactive_invoke_skill',
  'reactive_respond_human',
  'reactive_migrate',
]);

export interface InterceptorHookResult {
  injectedPrompt: string;
  allowedTools: string[];
  currentState: string;
  slice: PromptSlice;
}

export interface ToolExecutionEventData {
  tool: string;
  args?: any;
  result?: any;
  exitCode?: number;
}

/**
 * In-Harness Interceptor Hooks
 * Plugs directly into the agent reasoning loop without requiring changes to base models.
 */
export class ReactiveRuntimeHooks {
  /**
   * Pre-Turn Hook: Prepares the active state prompt slice and scopes allowed tools
   */
  public static onBeforeAgentTurn(
    engine: FSMEngine,
    baseSystemPrompt = ''
  ): InterceptorHookResult {
    const slice = engine.generatePromptSlice();

    let bypassWarning = '';
    if (engine.isStrictExecution() && engine.getTurnsSinceLastSignal() > 0) {
      bypassWarning = `<!-- BYPASS_WARNING: This turn will count against the idle budget. You have ${engine.getTurnsSinceLastSignal()} turn(s) since your last signal. Emit a signal via reactive_emit_signal to reset the counter. -->\n`;
    }

    const injectedPrompt = [
      bypassWarning,
      baseSystemPrompt,
      '',
      '<!-- REACTIVE SKILL CONTROL SLICE -->',
      slice.formattedXml,
      '<!-- END REACTIVE SKILL CONTROL SLICE -->',
    ].filter(Boolean).join('\n');

    return {
      injectedPrompt,
      allowedTools: slice.allowedTools,
      currentState: slice.state,
      slice,
    };
  }

  public static auditToolExecution(engine: FSMEngine, toolData: ToolExecutionEventData): { bypassed: boolean; reason?: string } {
    const allowedTools = engine.generatePromptSlice().allowedTools;
    const isRuntimeTool = RUNTIME_TOOLS.has(toolData.tool);
    const isAllowedTool = allowedTools.includes(toolData.tool);

    if (!isAllowedTool && !isRuntimeTool) {
      const eventType = 'BYPASS_DETECTED';
      engine.getEventStore().append(eventType, {
        tool: toolData.tool,
        reason: 'Tool not in allowed_tools and not a runtime tool',
        allowed_tools: allowedTools,
      }, { state: engine.getCurrentState() });

      if (engine.isStrictExecution()) {
        throw new Error(
          `BYPASS_DETECTED: Tool '${toolData.tool}' is not in the allowed tools list. ` +
          `Allowed tools: ${allowedTools.join(', ')}. ` +
          `To recover, run: reactive-skills-axi reset ${engine.getManifest().name} then re-invoke.`
        );
      }
      return { bypassed: true, reason: `Tool '${toolData.tool}' not in allowed_tools` };
    }
    return { bypassed: false };
  }

  /**
   * Post-Turn Tool Hook: Translates tool execution results into reactive signals
   */
  public static async onAfterToolExecution(
    engine: FSMEngine,
    toolData: ToolExecutionEventData
  ): Promise<{
    signalsEmitted: string[];
    transitioned: boolean;
    currentState: string;
    deliverablesWritten: string[];
  }> {
    const signalsEmitted: string[] = [];
    let transitioned = false;
    let deliverablesWritten: string[] = [];

    // Helper to dispatch and aggregate results
    const dispatch = async (signalName: string, payload: Record<string, any>) => {
      signalsEmitted.push(signalName);
      const res = await engine.handleSignal(signalName, payload, { source: `tool:${toolData.tool}` });
      if (res.transitioned) {
        transitioned = true;
      }
      if (res.deliverablesWritten.length > 0) {
        deliverablesWritten.push(...res.deliverablesWritten);
      }
    };

    // Audit tool execution before dispatching auto-mapped signal
    const auditResult = ReactiveRuntimeHooks.auditToolExecution(engine, toolData);
    if (auditResult.bypassed) {
      return {
        signalsEmitted: [],
        transitioned: false,
        currentState: engine.getCurrentState(),
        deliverablesWritten: [],
      };
    }

    // Auto-map common tool outputs to signals
    if (toolData.tool === 'run_command') {
      const cmd = String(toolData.args?.CommandLine || toolData.args || '');
      const output = String(toolData.result?.output || toolData.result || '');
      const exitCode = typeof toolData.exitCode === 'number' 
        ? toolData.exitCode 
        : (output.includes('FAIL') || output.includes('Error') || output.includes('failed') ? 1 : 0);

      // Check if this was a test run
      if (cmd.includes('test') || cmd.includes('vitest') || cmd.includes('jest') || cmd.includes('pytest')) {
        await dispatch('TEST_RAN', {
          command: cmd,
          exit_code: exitCode,
          output,
        });
      } else {
        await dispatch('COMMAND_RAN', {
          command: cmd,
          exit_code: exitCode,
          output,
        });
      }
    } else if (toolData.tool === 'write_to_file' || toolData.tool === 'replace_file_content') {
      await dispatch('FILE_MODIFIED', {
        tool: toolData.tool,
        path: toolData.args?.TargetFile || toolData.args?.path,
      });
    } else if (toolData.tool === 'ask_question') {
      const choice = toolData.result?.choice || toolData.result?.selected || toolData.result?.answer || String(toolData.result || '');
      engine.recordDecision({ choice, result: toolData.result }, `tool:${toolData.tool}`);
      await dispatch('USER_DECISION', {
        choice,
        result: toolData.result,
      });
      if (/approve|yes|accept|confirm|proceed/i.test(choice)) {
        await dispatch('USER_APPROVED', { choice, result: toolData.result });
      } else if (/reject|no|abort|cancel/i.test(choice)) {
        await dispatch('USER_REJECTED', { choice, result: toolData.result });
      } else if (/revision|change|modify|fix/i.test(choice)) {
        await dispatch('USER_REVISION_REQUESTED', { choice, result: toolData.result });
      }
    } else {
      await dispatch('TOOL_EXECUTED', {
        tool: toolData.tool,
        args: toolData.args,
      });
    }

    return {
      signalsEmitted,
      transitioned,
      currentState: engine.getCurrentState(),
      deliverablesWritten,
    };
  }

  /**
   * Human Ingress Hook: Directly ingests human input from UI, Lavish, or CLI
   */
  public static async onHumanResponse(
    engine: FSMEngine,
    responseData: {
      choice?: string;
      feedback?: string;
      approved?: boolean;
      data?: Record<string, any>;
    }
  ): Promise<{
    signalsEmitted: string[];
    transitioned: boolean;
    currentState: string;
    deliverablesWritten: string[];
  }> {
    const signalsEmitted: string[] = [];
    let transitioned = false;
    let deliverablesWritten: string[] = [];

    const dispatch = async (signalName: string, payload: Record<string, any>) => {
      signalsEmitted.push(signalName);
      const res = await engine.handleSignal(signalName, payload, { source: 'human_ingress' });
      if (res.transitioned) transitioned = true;
      if (res.deliverablesWritten.length > 0) deliverablesWritten.push(...res.deliverablesWritten);
    };

    // Update context if feedback or decision provided
    if (responseData.feedback) {
      engine.updateContext({ user_feedback: responseData.feedback });
    }
    if (responseData.choice) {
      engine.updateContext({ user_choice: responseData.choice });
    }

    if (responseData.choice || responseData.feedback) {
      engine.recordDecision({
        choice: responseData.choice || '',
        feedback: responseData.feedback,
        approved: responseData.approved,
        result: responseData.data,
      });
    }

    await dispatch('USER_RESPONSE', responseData);

    if (responseData.approved === true || (responseData.choice && /approve|yes|accept|confirm|proceed/i.test(responseData.choice))) {
      await dispatch('USER_APPROVED', responseData);
    } else if (responseData.approved === false || (responseData.choice && /reject|no|abort|cancel/i.test(responseData.choice))) {
      await dispatch('USER_REJECTED', responseData);
    } else if (responseData.choice && /revision|change|modify|fix/i.test(responseData.choice)) {
      await dispatch('USER_REVISION_REQUESTED', responseData);
    }

    return {
      signalsEmitted,
      transitioned,
      currentState: engine.getCurrentState(),
      deliverablesWritten,
    };
  }
}
