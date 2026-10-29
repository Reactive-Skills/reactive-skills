import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { createHash } from 'node:crypto';
import { FSMEngine, JobManager, JudgmentEngine, createReactiveMcpServer, getRuntimeCapabilities } from '@reactive-skills/runtime';
import { emitCommand } from '../../src/commands/emit.js';

const draft = 'Verified draft: café\r\n' + 'substantial evidence '.repeat(120);

describe.each(['axi', 'mcp'] as const)('%s evidence interface', transport => {
  let workspace: string;
  let skillDir: string;
  let originalWorkspace: string | undefined;
  let tools: any;
  let server: ReturnType<typeof createReactiveMcpServer>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-transport-evidence-'));
    skillDir = path.join(workspace, 'skills', 'evidence-test');
    fs.mkdirSync(skillDir, { recursive: true });
    const field = { media_type: 'text/plain', projection: 'utf8' };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump({
      schema_version: 'reactive/v1', name: 'evidence-test', description: 'Evidence transport parity', initial_state: 'REVIEW',
      context_keys: ['draft'], evidence: { signals: { CHECK: { '/draft': field } }, context: { '/draft': field } },
      states: {
        REVIEW: { transitions: { CHECK: { target: 'ACCEPTED', guard: `event.payload.draft === ${JSON.stringify(draft)}` } } },
        ACCEPTED: { prompt: 'Accepted.' },
      },
      deliverable_projections: [{ template: 'draft.hbs', output: 'result.txt' }],
    }));
    fs.writeFileSync(path.join(skillDir, 'draft.hbs'), '{{{context.draft}}}');
    fs.writeFileSync(path.join(workspace, 'draft with spaces.txt'), draft);
    new JobManager(workspace).createJob('evidence-test', { name: 'transport-run', setActive: true });
    originalWorkspace = process.env.WORKSPACE_DIR;
    process.env.WORKSPACE_DIR = workspace;
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'evidence-test' });
    tools = (server as any)._registeredTools;
  });

  afterEach(async () => {
    JudgmentEngine.reset();
    await server.close();
    if (originalWorkspace === undefined) delete process.env.WORKSPACE_DIR;
    else process.env.WORKSPACE_DIR = originalWorkspace;
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function importEvidence(source = 'draft with spaces.txt') {
    if (transport === 'axi') {
      const { evidenceCommand } = await import('../../src/commands/evidence.js');
      return evidenceCommand([skillDir, 'import', source, '--media-type', 'text/plain', '--job', 'transport-run']);
    }
    const result = await tools.reactive_import_evidence.handler({ path: source, media_type: 'text/plain', job_id: 'transport-run' }, {});
    return result.content[0].text;
  }

  async function emit(evidence?: unknown, key?: string, payload: unknown = {}) {
    if (transport === 'axi') return emitCommand([
      skillDir, 'CHECK', JSON.stringify(payload), '--job', 'transport-run',
      ...(evidence === undefined ? [] : ['--evidence', JSON.stringify(evidence)]),
      ...(key ? ['--idempotency-key', key] : []),
    ]);
    const result = await tools.reactive_emit_signal.handler({ signal: 'CHECK', payload, evidence, job_id: 'transport-run', idempotency_key: key }, {});
    return result.content[0].text;
  }

  async function read(receipt: unknown) {
    if (transport === 'axi') {
      const { evidenceCommand } = await import('../../src/commands/evidence.js');
      return evidenceCommand([skillDir, 'read', JSON.stringify(receipt), '--job', 'transport-run']);
    }
    return (await tools.reactive_read_evidence.handler({ reference: receipt, job_id: 'transport-run' }, {})).content[0].text;
  }

  function inspectRun() {
    return new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'transport-run' });
  }

  it('advertises optional reference submission negotiation and preserves inline callers', async () => {
    const capabilities = transport === 'axi' ? await getRuntimeCapabilities() : JSON.parse((await tools.reactive_capabilities.handler({}, {})).content[0].text);
    expect(capabilities.capabilities).toContain('evidence.reference_submission');
    const output = await emit(undefined, undefined, { draft });
    expect(output).not.toContain('refusal');
    expect(fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8')).toBe(draft);
  });

  it('imports exact bytes idempotently, reads on request, and submits an explicit reference', async () => {
    const first = await importEvidence();
    const receipt = JSON.parse(first).reference;
    expect(first).not.toContain('substantial evidence');
    expect(receipt.byte_length).toBe(Buffer.byteLength(draft));
    expect(receipt.sha256).toBe(createHash('sha256').update(draft).digest('hex'));
    expect(JSON.parse(await importEvidence()).reference).toEqual(receipt); // lost import response
    fs.unlinkSync(path.join(workspace, 'draft with spaces.txt'));
    expect(JSON.parse(await read(receipt)).content).toBe(draft);
    const output = await emit({ '/draft': { reference: receipt } });
    expect(output).not.toContain('substantial evidence');
    expect(fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8')).toBe(draft);
    const engine = inspectRun();
    try {
      expect(engine.getCurrentState()).toBe('ACCEPTED');
      expect(engine.getContext().draft).toEqual({ $evidence: receipt });
      expect(engine.exportRun().evidence.entries.map(e => e.receipt)).toEqual([receipt]);
    } finally { engine.close(); }
  });

  it('folds local import into emit and recovers a lost response without reopening the source', async () => {
    const evidence = { '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } };
    const first = await emit(evidence, 'capture-once');
    expect(first).not.toContain('substantial evidence');
    expect(fs.existsSync(path.join(workspace, 'result.txt'))).toBe(true);
    fs.unlinkSync(path.join(workspace, 'draft with spaces.txt'));
    const retry = await emit(evidence, 'capture-once');
    expect(retry).not.toContain('error:');
    expect(retry).not.toContain('"error"');
    const engine = inspectRun();
    try {
      expect(engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })).toHaveLength(1);
      expect(engine.exportRun().evidence.entries).toHaveLength(1);
    } finally { engine.close(); }
  });

  it('keeps concurrent keyed folded submissions to one committed signal', async () => {
    const evidence = { '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } };
    const outputs = await Promise.all([emit(evidence, 'concurrent-once'), emit(evidence, 'concurrent-once')]);
    for (const output of outputs) {
      expect(output).not.toContain('"error"');
      expect(output).not.toContain('error:');
      expect(output).not.toContain('substantial evidence');
    }
    const engine = inspectRun();
    try {
      expect(engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })).toHaveLength(1);
      expect(engine.getCurrentState()).toBe('ACCEPTED');
      expect(engine.exportRun().evidence.entries).toHaveLength(1);
      expect(fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8')).toBe(draft);
    } finally { engine.close(); }
  });

  it.each(['../outside.txt', '/etc/passwd', 'link.txt'])('denies import path %s without submitting a signal', async source => {
    fs.symlinkSync(path.join(workspace, 'draft with spaces.txt'), path.join(workspace, 'link.txt'));
    const output = await emit({ '/draft': { path: source, media_type: 'text/plain' } });
    expect(output.toLowerCase()).toContain('error');
    const engine = inspectRun();
    try { expect(engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })).toHaveLength(0); }
    finally { engine.close(); }
  });

  it.each([
    { '/draft': { reference: { id: 'invalid' } } },
    { '/undeclared': { path: 'draft with spaces.txt', media_type: 'text/plain' } },
    { '/__proto__/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } },
  ])('rejects malformed or undeclared bindings: %j', async evidence => {
    expect((await emit(evidence)).toLowerCase()).toContain('error');
    expect(fs.existsSync(path.join(workspace, 'result.txt'))).toBe(false);
  });


  it('passes resolved selected content to semantic judgment without echoing it in the receipt', async () => {
    const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as any;
    manifest.states.REVIEW.transitions.CHECK.judgment = {
      type: 'predicate', criterion: 'Is the draft supported?', adapter_hint: 'transport-fixture',
      context_paths: ['draft'], include_payload: true,
    };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    const evaluate = vi.fn(async (_request, context) => {
      expect(context.event.payload.draft).toBe(draft);
      expect(context.context.draft).toBe(draft);
      return { verdict: true, passed: true, probability: 1, confidence: 1, adapterName: 'transport-fixture', latencyMs: 0 };
    });
    JudgmentEngine.registerAdapter({ id: 'transport-fixture', supports: () => true, isAvailable: async () => true, isConfigured: () => true, evaluate });
    const output = await emit({ '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } });
    expect(evaluate).toHaveBeenCalledOnce();
    expect(output).not.toContain('substantial evidence');
    expect(fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8')).toBe(draft);
  });

  it('imports canonical JSON as the legacy object and rejects noncanonical JSON', async () => {
    const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as any;
    const field = { media_type: 'application/json', projection: 'json' };
    manifest.evidence = { signals: { CHECK: { '/draft': field } }, context: { '/draft': field } };
    manifest.states.REVIEW.transitions.CHECK.guard = 'event.payload.draft.score === 1 && context.draft.score === 1';
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    fs.writeFileSync(path.join(skillDir, 'draft.hbs'), '{{context.draft.score}}');
    fs.writeFileSync(path.join(workspace, 'draft.json'), '{ "score": 1 }');
    const evidence = { '/draft': { path: 'draft.json', media_type: 'application/json' } };
    expect((await emit(evidence)).toLowerCase()).toContain('error');
    fs.writeFileSync(path.join(workspace, 'draft.json'), '{"score":1}');
    expect(await emit(evidence)).not.toContain('refusal');
    expect(fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8')).toBe('1');
  });

  it('binds escaped nested pointers without mixing transport metadata into task JSON', async () => {
    const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as any;
    manifest.evidence.signals.CHECK = { '/document/a~1b': { media_type: 'text/plain', projection: 'utf8' } };
    manifest.context_keys = [];
    manifest.states.REVIEW.transitions.CHECK.guard = `event.payload.document['a/b'] === ${JSON.stringify(draft)}`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    const output = await emit({ '/document/a~1b': { path: 'draft with spaces.txt', media_type: 'text/plain' } });
    expect(output).not.toContain('refusal');
    const engine = inspectRun();
    try {
      expect(engine.getCurrentState()).toBe('ACCEPTED');
      const event = engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })[0];
      expect(event.payload.document['a/b'].$evidence.byte_length).toBe(Buffer.byteLength(draft));
      expect(event.payload.evidence).toBeUndefined();
      expect(event.payload.document['a/b'].path).toBeUndefined();
    } finally { engine.close(); }
  });

  it('recovers a refused keyed folded submission after source loss without changing the decision', async () => {
    fs.writeFileSync(path.join(workspace, 'draft with spaces.txt'), 'rejected draft');
    const evidence = { '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } };
    const first = await emit(evidence, 'refused-once');
    fs.unlinkSync(path.join(workspace, 'draft with spaces.txt'));
    const retry = await emit(evidence, 'refused-once');
    expect(first).not.toContain('rejected draft');
    expect(retry).not.toContain('ENOENT');
    expect(retry).not.toContain('"error"');
    const engine = inspectRun();
    try {
      expect(engine.getCurrentState()).toBe('REVIEW');
      expect(engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })).toHaveLength(1);
      expect(engine.getContext().draft).toBeUndefined();
      expect(engine.exportRun().evidence.entries).toHaveLength(0);
    } finally { engine.close(); }
  });

  it.each(['oversized', 'invalid-utf8', 'directory'])('rejects %s local evidence before signal submission', async fault => {
    const source = path.join(workspace, 'draft with spaces.txt');
    if (fault === 'oversized') fs.writeFileSync(source, Buffer.alloc(1024 * 1024 + 1));
    if (fault === 'invalid-utf8') fs.writeFileSync(source, Buffer.from([0xff]));
    if (fault === 'directory') { fs.unlinkSync(source); fs.mkdirSync(source); }
    expect((await emit({ '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } })).toLowerCase()).toContain('error');
    const engine = inspectRun();
    try { expect(engine.getEventStore().query({ type: 'SIGNAL_EMITTED' })).toHaveLength(0); }
    finally { engine.close(); }
  });

  it.each([false, true])('does not echo malformed imported JSON when folded=%s', async folded => {
    const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as any;
    manifest.evidence.signals.CHECK['/draft'] = { media_type: 'application/json', projection: 'json' };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    fs.writeFileSync(path.join(workspace, 'draft.json'), 'Unparsed draft body');
    let output: string;
    if (folded) output = await emit({ '/draft': { path: 'draft.json', media_type: 'application/json' } });
    else if (transport === 'axi') {
      const { evidenceCommand } = await import('../../src/commands/evidence.js');
      output = await evidenceCommand([skillDir, 'import', 'draft.json', '--media-type', 'application/json', '--job', 'transport-run']);
    } else {
      output = (await tools.reactive_import_evidence.handler({ path: 'draft.json', media_type: 'application/json', job_id: 'transport-run' }, {})).content[0].text;
    }
    expect(output.toLowerCase()).toContain('error');
    expect(output).not.toContain('Unparsed draft');
  });

  it('rejects a collision with inline payload data without registering a file', async () => {
    const output = await emit({ '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } }, undefined, { draft: 'inline' });
    expect(output).toContain('conflicts');
    const engine = inspectRun();
    try { expect(engine.getEventStore().getEvidenceStore().exportBundle().entries).toHaveLength(0); }
    finally { engine.close(); }
  });

  it('refuses cross-run receipts and denies malformed explicit reads', async () => {
    const receipt = JSON.parse(await importEvidence()).reference;
    expect((await read({ ...receipt, id: 'invalid' })).toLowerCase()).toContain('error');
    expect((await read({ ...receipt, run_id: 'other-run' })).toLowerCase()).toContain('error');
    const output = await emit({ '/draft': { reference: { ...receipt, run_id: 'other-run' } } });
    expect(output).toContain('Evidence verification failed');
    const engine = inspectRun();
    try { expect(engine.getCurrentState()).toBe('REVIEW'); }
    finally { engine.close(); }
  });

  it('refuses damaged registered bytes through the core resolver', async () => {
    const receipt = JSON.parse(await importEvidence()).reference;
    const engine = inspectRun();
    const blob = path.join(workspace, '.reactive', 'skills', 'evidence-test', 'runs', engine.getJobId()!, 'artifacts', 'evidence-v1', `${receipt.sha256}.blob`);
    engine.close();
    fs.writeFileSync(blob, 'changed');
    const output = await emit({ '/draft': { reference: receipt } }, 'damaged');
    expect(output).toContain('Evidence verification failed');
    expect(fs.existsSync(path.join(workspace, 'result.txt'))).toBe(false);
    expect(await emit({ '/draft': { reference: receipt } }, 'damaged')).toContain('Evidence verification failed');
  });
});
