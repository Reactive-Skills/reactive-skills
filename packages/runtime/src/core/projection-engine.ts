import fs from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { DeliverableProjection, SignalEvent } from './types.js';
import { EventStore } from './event-store.js';

export interface ProjectionContext {
  skillName: string;
  currentState: string;
  jobId?: string;
  context: Record<string, any>;
  events: SignalEvent[];
  transitions: { from: string; to: string; timestamp: string; signal: string }[];
  lastUpdated: string;
}

export interface ProjectionResult {
  writtenFiles: string[];
  errors: Array<{ template: string; error: string }>;
}

/**
 * Deliverable Projection Engine (Event-Sourced Read Models)
 * Synthesizes persistent deliverables continuously from the event log.
 */
export class ProjectionEngine {
  private skillDir: string;
  private workspaceDir: string;
  private projections: DeliverableProjection[];
  private compiledTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private eventCaches = new WeakMap<EventStore, { lastSeq: number; events: SignalEvent[] }>();
  private jobId?: string;
  private isActiveJob: boolean;

  constructor(
    skillDir: string,
    projections: DeliverableProjection[] = [],
    workspaceDir = process.cwd(),
    jobId?: string,
    isActiveJob = true
  ) {
    this.skillDir = skillDir;
    this.workspaceDir = path.resolve(workspaceDir);
    this.projections = projections;
    this.jobId = jobId;
    this.isActiveJob = isActiveJob;
    this.registerHelpers();
    this.compileTemplates();
  }

  public setJob(jobId?: string, isActiveJob = true): void {
    this.jobId = jobId;
    this.isActiveJob = isActiveJob;
  }

  private resolveOutputPath(output: string): string {
    if (path.isAbsolute(output)) {
      throw new Error('Projection output must be relative to the workspace.');
    }

    const outputPath = path.resolve(this.workspaceDir, output);
    const relativePath = path.relative(this.workspaceDir, outputPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Projection output escapes the workspace.');
    }

    const outputDir = path.dirname(outputPath);
    const existingDir = fs.existsSync(outputDir) ? fs.realpathSync(outputDir) : outputDir;
    const realWorkspace = fs.realpathSync(this.workspaceDir);
    const realRelativePath = path.relative(realWorkspace, existingDir);
    if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
      throw new Error('Projection output resolves outside the workspace.');
    }

    if (fs.existsSync(outputPath)) {
      const realOutput = fs.realpathSync(outputPath);
      const outputRelativePath = path.relative(realWorkspace, realOutput);
      if (outputRelativePath.startsWith('..') || path.isAbsolute(outputRelativePath)) {
        throw new Error('Projection output resolves outside the workspace.');
      }
    }

    return outputPath;
  }

  private getProjectionEvents(eventStore: EventStore): SignalEvent[] {
    const latestSeq = eventStore.getLatestSequence();
    const cached = this.eventCaches.get(eventStore);
    if (!cached) {
      const events = eventStore.getAll();
      this.eventCaches.set(eventStore, { lastSeq: latestSeq, events });
      return events;
    }
    if (latestSeq <= cached.lastSeq) return cached.events;

    const events = [...cached.events, ...eventStore.getSince(cached.lastSeq)];
    this.eventCaches.set(eventStore, { lastSeq: latestSeq, events });
    return events;
  }

  private matchesTrigger(proj: DeliverableProjection, triggerSignal?: string): boolean {
    if (!proj.trigger_on || proj.trigger_on.length === 0) return true;
    return proj.trigger_on.includes('*') ||
      proj.trigger_on.includes('STATE_TRANSITION') ||
      Boolean(triggerSignal && proj.trigger_on.includes(triggerSignal));
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);
    Handlebars.registerHelper('formatDate', (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toISOString();
    });
  }

  private compileTemplates(): void {
    for (const proj of this.projections) {
      try {
        const templatePath = path.resolve(this.skillDir, proj.template);
        if (fs.existsSync(templatePath)) {
          const raw = fs.readFileSync(templatePath, 'utf8');
          this.compiledTemplates.set(proj.template, Handlebars.compile(raw));
        }
      } catch (err) {
        // Will be caught and reported gracefully during project()
      }
    }
  }

  /**
   * Render all deliverables matching the given event trigger safely with an error boundary
   */
  public project(
    eventStore: EventStore,
    currentState: string,
    skillName: string,
    context: Record<string, any>,
    triggerSignal?: string
  ): string[] {
    const writtenFiles: string[] = [];
    const latestSeq = eventStore.getLatestSequence();
    const eligibleProjections = this.projections.filter(proj => this.matchesTrigger(proj, triggerSignal));
    const unchanged = eligibleProjections.length > 0 && eligibleProjections.every(proj => {
      const watermark = eventStore.getProjectionWatermark(proj.template);
      return watermark?.eventSeq === latestSeq && watermark.projectionVersion === `${this.skillDir}:${proj.template}`;
    });
    if (unchanged) return writtenFiles;

    const events = this.getProjectionEvents(eventStore);

    // Extract state transitions for convenient template consumption
    const transitions = events
      .filter(e => e.type === 'STATE_TRANSITION')
      .map(e => ({
        from: e.payload.from,
        to: e.payload.to,
        timestamp: e.timestamp,
        signal: e.payload.signal,
      }));

    const projContext: ProjectionContext = {
      skillName,
      currentState,
      jobId: this.jobId,
      context,
      events,
      transitions,
      lastUpdated: new Date().toISOString(),
    };

    for (const proj of this.projections) {
      try {
        // Check if trigger matches
        if (!this.matchesTrigger(proj, triggerSignal)) continue;

        let templateFn = this.compiledTemplates.get(proj.template);
        if (!templateFn) {
          const templatePath = path.resolve(this.skillDir, proj.template);
          if (fs.existsSync(templatePath)) {
            const raw = fs.readFileSync(templatePath, 'utf8');
            templateFn = Handlebars.compile(raw);
            this.compiledTemplates.set(proj.template, templateFn);
          }
        }

        if (templateFn) {
          const outputContent = templateFn(projContext);
          const canonicalOutputPath = this.resolveOutputPath(proj.output);
          const canonicalDir = path.dirname(canonicalOutputPath);
          const fileName = path.basename(canonicalOutputPath);

          // 1. If jobId is present, write to historical job archive:
          if (this.jobId) {
            const archiveDir = path.join(canonicalDir, 'jobs', this.jobId);
            if (!fs.existsSync(archiveDir)) {
              fs.mkdirSync(archiveDir, { recursive: true });
            }
            const archivePath = path.join(archiveDir, fileName);
            fs.writeFileSync(archivePath, outputContent, 'utf8');
            writtenFiles.push(archivePath);
          }

          // 2. If active job or no jobId (legacy mode), mirror to canonical root:
          if (this.isActiveJob || !this.jobId) {
            if (!fs.existsSync(canonicalDir)) {
              fs.mkdirSync(canonicalDir, { recursive: true });
            }
            fs.writeFileSync(canonicalOutputPath, outputContent, 'utf8');
            writtenFiles.push(canonicalOutputPath);
          }

          eventStore.saveProjectionWatermark(
            proj.template,
            eventStore.getLatestSequence(),
            `${this.skillDir}:${proj.template}`
          );
        }
      } catch (err: any) {
        // Error boundary: Record projection failure without tearing down the state machine transition
        try {
          eventStore.append('PROJECTION_FAILED', {
            template: proj.template,
            output: proj.output,
            error: err.message,
          });
        } catch {
          // Swallow secondary logging error
        }
      }
    }

    return writtenFiles;
  }
}
