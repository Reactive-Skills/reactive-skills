import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { SignalEvent, JudgmentDefinition, JudgmentResult } from './types.js';
import { JudgmentEngine } from './judgment-engine.js';

export interface GuardEvaluationContext {
  event: SignalEvent;
  context: Record<string, any>;
  currentState: string;
  skillDir?: string;
}

const ALLOWED_GUARD_EXTENSIONS = ['.js', '.mjs', '.cjs'];

/**
 * Guard Evaluator: Safely checks transition guards and domain invariants inside an isolated sandbox
 */
export class GuardEvaluator {
  /**
   * Evaluate a transition guard expression, custom JS function file, or snap-on judgment
   */
  public static async evaluate(
    guardExpr: string | undefined,
    guardFunctionPath: string | undefined,
    evalContext: GuardEvaluationContext,
    judgment?: JudgmentDefinition
  ): Promise<{
    passed: boolean;
    error?: string;
    judgmentResult?: JudgmentResult;
    fallbackTriggered?: boolean;
    fallbackTarget?: string;
  }> {
    // If no guard and no judgment defined, it unconditionally passes
    if (!guardExpr && !guardFunctionPath && !judgment) {
      return { passed: true };
    }

    try {
      let judgmentResult: JudgmentResult | undefined;
      let fallbackTriggered = false;
      let fallbackTarget: string | undefined;

      // 0. Evaluate snap-on judgment if defined
      if (judgment) {
        const jEval = await JudgmentEngine.evaluate(judgment, evalContext);
        judgmentResult = jEval;
        fallbackTriggered = Boolean(jEval.fallbackTriggered);
        fallbackTarget = jEval.fallbackTarget;

        if (!jEval.passed) {
          return {
            passed: false,
            error: jEval.error || `Judgment rejected: '${judgment.criterion}' (confidence: ${jEval.confidence})`,
            judgmentResult,
            fallbackTriggered,
            fallbackTarget,
          };
        }
      }
      // 1. Evaluate custom guard function file if specified (SEC-01)
      if (guardFunctionPath && evalContext.skillDir) {
        const ext = path.extname(guardFunctionPath).toLowerCase();
        if (!ALLOWED_GUARD_EXTENSIONS.includes(ext)) {
          return {
            passed: false,
            error: `Guard function must be a JavaScript file (.js, .mjs, .cjs): ${guardFunctionPath}`,
          };
        }

        const skillRoot = path.resolve(evalContext.skillDir);
        const fullPath = path.resolve(skillRoot, guardFunctionPath);
        const relativePath = path.relative(skillRoot, fullPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          return {
            passed: false,
            error: `Guard function path escapes skill directory: ${guardFunctionPath}`,
          };
        }

        if (fs.existsSync(fullPath)) {
          const realSkillRoot = fs.existsSync(skillRoot) ? fs.realpathSync(skillRoot) : skillRoot;
          const realFullPath = fs.realpathSync(fullPath);
          const realRel = path.relative(realSkillRoot, realFullPath);
          if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
            return {
              passed: false,
              error: `Guard function path escapes skill directory: ${guardFunctionPath}`,
            };
          }

          const fileUrl = pathToFileURL(realFullPath).href;
          const module = await import(fileUrl);
          const fn = module.default || module.guard || module.check;
          if (typeof fn === 'function') {
            const result = await fn(evalContext);
            return {
              passed: Boolean(result),
              judgmentResult,
              fallbackTriggered,
              fallbackTarget,
            };
          }
          return {
            passed: false,
            error: `Guard function file does not export a valid function (default, guard, check): ${guardFunctionPath}`,
            judgmentResult,
            fallbackTriggered,
            fallbackTarget,
          };
        } else {
          return {
            passed: false,
            error: `Guard function file not found: ${guardFunctionPath}`,
            judgmentResult,
            fallbackTriggered,
            fallbackTarget,
          };
        }
      }

      // 2. Evaluate inline expression using hardened node:vm sandbox
      if (guardExpr) {
        // Deep clone / sanitize sandbox variables to prevent prototype pollution or escape
        const sandbox = {
          event: JSON.parse(JSON.stringify(evalContext.event)),
          context: JSON.parse(JSON.stringify(evalContext.context || {})),
          currentState: String(evalContext.currentState),
          state: String(evalContext.currentState),
          payload: JSON.parse(JSON.stringify(evalContext.event.payload || {})),
          Boolean,
          Number,
          String,
          Array,
          Object,
          Math,
          JSON,
        };

        const vmContext = vm.createContext(sandbox, {
          codeGeneration: {
            strings: false, // Disable eval / new Function inside guard
            wasm: false,
          },
        });

        // Wrap expression safely with 100ms timeout
        const script = new vm.Script(`"use strict"; Boolean(${guardExpr})`);
        const result = script.runInContext(vmContext, { timeout: 100 });

        return {
          passed: Boolean(result),
          judgmentResult,
          fallbackTriggered,
          fallbackTarget,
        };
      }

      return {
        passed: true,
        judgmentResult,
        fallbackTriggered,
        fallbackTarget,
      };
    } catch (err: any) {
      return {
        passed: false,
        error: `Guard evaluation failed: ${err.message}`,
      };
    }
  }
}
