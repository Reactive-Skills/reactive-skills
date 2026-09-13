import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createReactiveMcpServer } from '../src/mcp/server.js';

describe('Reactive MCP Server Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-mcp-test-'));
    // Copy skills to tempDir
    const srcSkills = path.resolve(process.cwd(), 'skills');
    const destSkills = path.join(tempDir, 'skills');
    fs.cpSync(srcSkills, destSkills, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup locks on Windows
    }
  });

  it('should initialize MCP server instance with tools and resources', () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    expect(server).toBeDefined();
  });

  it('should handle reactive_state tool call', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;
    expect(tools['reactive_state']).toBeDefined();

    const handler = tools['reactive_state'];
    const result = await handler.handler({ skill: 'test-fsm' }, {} as any);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.skill).toBe('test-fsm');
    expect(parsed.activeState).toBe('INIT');
  });

  it('should handle reactive_emit_signal and advance state machine', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const emitHandler = tools['reactive_emit_signal'];
    const result = await emitHandler.handler({ signal: 'RUNTIME_READY', skill: 'test-fsm' }, {} as any);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.transitioned).toBe(true);
    expect(parsed.newState).toBe('RED_SPEC');
  });

  it('should execute SQL query via reactive_query tool', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const queryHandler = tools['reactive_query'];
    const result = await queryHandler.handler({ sql: 'SELECT * FROM events' }, {} as any);

    const rows = JSON.parse(result.content[0].text);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('should list available reactive skills via reactive_list_skills', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir });
    const tools = (server as any)._registeredTools;

    const listHandler = tools['reactive_list_skills'];
    const result = await listHandler.handler({}, {} as any);

    const skills = JSON.parse(result.content[0].text);
    expect(Array.isArray(skills)).toBe(true);
    const hasTestFsm = skills.some((s: any) => s.name === 'test-fsm');
    expect(hasTestFsm).toBe(true);
  });

  it('should inspect skill manifest via reactive_inspect', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir });
    const tools = (server as any)._registeredTools;

    const inspectHandler = tools['reactive_inspect'];
    const result = await inspectHandler.handler({ skill: 'test-fsm' }, {} as any);

    const manifest = JSON.parse(result.content[0].text);
    expect(manifest.name).toBe('test-fsm');
    expect(manifest.initial_state).toBe('INIT');
  });

  it('should handle reactive_migrate tool call', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir });
    const tools = (server as any)._registeredTools;

    const migrateHandler = tools['reactive_migrate'];
    const result = await migrateHandler.handler({ targetDir: tempDir }, {} as any);

    const migration = JSON.parse(result.content[0].text);
    expect(migration.migrated).toBe(true);
    expect(migration.schemaVersion).toBe('reactive/v2');
  });

  it('should reject reactive_migrate targetDir paths escaping workspace directory (SEC-02)', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir });
    const tools = (server as any)._registeredTools;

    const migrateHandler = tools['reactive_migrate'];
    const result = await migrateHandler.handler({ targetDir: '../../outside' }, {} as any);

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain('escapes workspace directory');
  });

  it('should reject traversal payloads for reactive deliverable resource names', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir });
    const resourceTemplates = (server as any)._registeredResourceTemplates;
    const deliverableResource = resourceTemplates['reactive-deliverable'];

    expect(deliverableResource).toBeDefined();

    const response = await deliverableResource.readCallback(
      new URL('reactive://deliverables/..%2F..%2Fpackage'),
      { name: '../../package' },
      {} as any
    );

    expect(response.contents[0].text).toContain('Invalid deliverable name');
  });

  it('should include strict_execution in reactive_state response', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const handler = tools['reactive_state'];
    const result = await handler.handler({ skill: 'test-fsm' }, {} as any);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.strict_execution).toBe(true);
    expect(typeof parsed.turns_since_last_signal).toBe('number');
  });

  it('should not bypass on 2 reactive_state calls for test-fsm (has strict_execution but no bypass yet)', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const handler = tools['reactive_state'];

    const res1 = await handler.handler({}, {} as any);
    const parsed1 = JSON.parse(res1.content[0].text);
    expect(parsed1.turns_since_last_signal).toBe(1);

    const res2 = await handler.handler({}, {} as any);
    const parsed2 = JSON.parse(res2.content[0].text);
    expect(parsed2.turns_since_last_signal).toBe(2);
    expect(res2.isError).toBeUndefined() || !res2.isError;
  });

  it('reactive_state job parameter: accepts optional job_id and defaults to active job', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;
    const handler = tools['reactive_state'];

    // Default active job
    const defaultRes = await handler.handler({ skill: 'test-fsm' }, {} as any);
    const defaultParsed = JSON.parse(defaultRes.content[0].text);
    expect(defaultParsed.job_id).toBe('default');
    expect(defaultParsed.activeState).toBe('INIT');

    // Targeted custom job
    const customRes = await handler.handler({ skill: 'test-fsm', job_id: 'slice-custom' }, {} as any);
    const customParsed = JSON.parse(customRes.content[0].text);
    expect(customParsed.job_id).toBe('slice-custom');
    expect(customParsed.activeState).toBe('INIT');
  });

  it('reactive_emit_signal targeted job: routes transition to targeted job_id without bleeding', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    const emitHandler = tools['reactive_emit_signal'];
    const stateHandler = tools['reactive_state'];

    // Advance job-alpha
    const emitRes = await emitHandler.handler({
      signal: 'RUNTIME_READY',
      skill: 'test-fsm',
      job_id: 'job-alpha',
    }, {} as any);
    const emitParsed = JSON.parse(emitRes.content[0].text);
    expect(emitParsed.transitioned).toBe(true);
    expect(emitParsed.job_id).toBe('job-alpha');
    expect(emitParsed.newState).toBe('RED_SPEC');

    // Verify job-beta is independent and remains at INIT
    const betaStateRes = await stateHandler.handler({
      skill: 'test-fsm',
      job_id: 'job-beta',
    }, {} as any);
    const betaParsed = JSON.parse(betaStateRes.content[0].text);
    expect(betaParsed.job_id).toBe('job-beta');
    expect(betaParsed.activeState).toBe('INIT');

    // Verify job-alpha is at RED_SPEC
    const alphaStateRes = await stateHandler.handler({
      skill: 'test-fsm',
      job_id: 'job-alpha',
    }, {} as any);
    const alphaParsed = JSON.parse(alphaStateRes.content[0].text);
    expect(alphaParsed.job_id).toBe('job-alpha');
    expect(alphaParsed.activeState).toBe('RED_SPEC');
  });

  it('reactive_list_jobs tool: returns all known jobs for a skill with status metadata', async () => {
    const server = createReactiveMcpServer({ workspaceDir: tempDir, defaultSkill: 'test-fsm' });
    const tools = (server as any)._registeredTools;

    expect(tools['reactive_list_jobs']).toBeDefined();

    // Emit signals on two jobs so they are created
    const emitHandler = tools['reactive_emit_signal'];
    await emitHandler.handler({ signal: 'RUNTIME_READY', skill: 'test-fsm', job_id: 'job-one' }, {} as any);
    await emitHandler.handler({ signal: 'RUNTIME_READY', skill: 'test-fsm', job_id: 'job-two' }, {} as any);

    const listJobsHandler = tools['reactive_list_jobs'];
    const res = await listJobsHandler.handler({ skill: 'test-fsm' }, {} as any);
    const parsed = JSON.parse(res.content[0].text);

    expect(parsed.skill).toBe('test-fsm');
    expect(Array.isArray(parsed.jobs)).toBe(true);
    const jobIds = parsed.jobs.map((j: any) => j.id);
    expect(jobIds).toContain('job-one');
    expect(jobIds).toContain('job-two');
    const jobOne = parsed.jobs.find((j: any) => j.id === 'job-one');
    expect(jobOne.status).toBe('active');
    expect(jobOne.currentState).toBe('RED_SPEC');
  });
});
