import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { EventStore, createSortableId } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { LocalEvidenceStore, canonicalEvidenceJson, type EvidenceReceipt } from '../src/core/evidence-store.js';
import { EvidenceDeclarationsSchema, EvidenceResolver } from '../src/core/evidence-resolver.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';
import { ProjectionEngine } from '../src/core/projection-engine.js';

describe('immutable evidence registry', () => {
  let workspace: string;
  let skillDir: string;
  const stores: EventStore[] = [];

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-evidence-'));
    skillDir = path.join(workspace, 'skill');
    fs.mkdirSync(skillDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const store of stores.splice(0)) store.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function store(runId = createSortableId(), root = workspace) {
    const result = new EventStore({ workspaceDir: root, skillId: 'evidence-test', runId, enableSqlite: true });
    stores.push(result);
    return result;
  }

  function fixture(structured: boolean, custom: boolean) {
    const field = { media_type: structured ? 'application/json' : 'text/plain', projection: structured ? 'json' : 'utf8' };
    const expression = structured
      ? 'event.payload.draft.score === 1 && context.draft.score === 1'
      : 'event.payload.draft === "verified" && context.draft === "verified"';
    fs.writeFileSync(path.join(skillDir, 'guard.cjs'), `module.exports = ({event, context}) => ${expression};`);
    fs.writeFileSync(path.join(skillDir, 'view.hbs'), '{{#each events}}{{#if (eq type "SIGNAL_EMITTED")}}{{{json payload.draft}}}{{/if}}{{/each}}|{{{json context.draft}}}');
    const transition = { target: 'S2', ...(custom ? { guardFunction: 'guard.cjs' } : { guard: expression }) };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump({
      schema_version: 'reactive/v1', name: 'evidence-test', description: 'Evidence parity', initial_state: 'S1',
      context_keys: ['draft'],
      evidence: { signals: { CHECK: { '/draft': field, '/contextUpdates/draft': field } }, context: { '/draft': field } },
      states: { S1: { transitions: { CHECK: transition } }, S2: { transitions: { CHECK: transition } } },
      deliverable_projections: [{ template: 'view.hbs', output: 'result.txt' }],
    }));
  }

  function registryDirectory(ledger: EventStore) {
    return path.join(workspace, '.reactive', 'skills', 'evidence-test', 'runs', ledger.getEventContext().run_id!, 'artifacts', 'evidence-v1');
  }

  function textReceipt(ledger: EventStore, text = 'verified') {
    fs.writeFileSync(path.join(workspace, 'draft.txt'), text);
    return ledger.getEvidenceStore().importFile('draft.txt', 'text/plain');
  }

  const parity = [false, true].flatMap(structured => [false, true].flatMap(custom =>
    [false, true].flatMap(reference => ['live', 'snapshot', 'replay'].flatMap(mode =>
      [false, true].map(accepted => ({ structured, custom, reference, mode, accepted }))))));

  it.each(parity)('preserves inline meaning: %j', async ({ structured, custom, reference, mode, accepted }) => {
    fixture(structured, custom);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const value = structured ? { message: 'verified', score: accepted ? 1 : 0 } : accepted ? 'verified' : 'rejected';
    fs.writeFileSync(path.join(workspace, 'draft.txt'), typeof value === 'string' ? value : JSON.stringify(value));
    const receipt = reference
      ? structured ? ledger.getEvidenceStore().registerJson(value) : ledger.getEvidenceStore().importFile('draft.txt', 'text/plain')
      : undefined;
    const submitted = receipt ? { $evidence: receipt } : value;
    const payload = { draft: submitted, contextUpdates: { draft: submitted } };
    const result = await engine.handleSignal('CHECK', payload);
    expect(result.transitioned).toBe(accepted);
    expect(result.event.payload.draft).toEqual(submitted);
    expect(engine.getContext().draft).toEqual(accepted ? submitted : undefined);
    if (accepted) {
      expect(result.deliverablesWritten.length).toBeGreaterThan(0);
      expect(fs.readFileSync(result.deliverablesWritten[0], 'utf8')).toBe(`${JSON.stringify(value, null, 2)}|${JSON.stringify(value, null, 2)}`);
      expect(ledger.getLatestSnapshot()?.context.draft).toEqual(submitted);
    } else {
      expect(fs.existsSync(path.join(workspace, 'result.txt'))).toBe(false);
    }
    fs.unlinkSync(path.join(workspace, 'draft.txt'));
    if (mode !== 'live') {
      const reopened = store(ledger.getEventContext().run_id);
      if (mode === 'replay') vi.spyOn(reopened, 'getLatestSnapshot').mockReturnValue(null);
      const restored = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: reopened });
      expect(restored.getCurrentState()).toBe(accepted ? 'S2' : 'S1');
      expect(restored.getContext().draft).toEqual(accepted ? submitted : undefined);
      expect((await restored.handleSignal('CHECK', payload)).transitioned).toBe(accepted);
    }
  });

  const faults = ['tamper', 'missing-blob', 'missing-registration', 'receipt-mismatch', 'cross-run', 'cross-workspace'] as const;
  function damage(ledger: EventStore, receipt: EvidenceReceipt, fault: typeof faults[number]): EvidenceReceipt {
    if (fault === 'tamper') fs.writeFileSync(path.join(registryDirectory(ledger), `${receipt.sha256}.blob`), 'replaced');
    if (fault === 'missing-blob') fs.unlinkSync(path.join(registryDirectory(ledger), `${receipt.sha256}.blob`));
    if (fault === 'missing-registration') fs.unlinkSync(path.join(registryDirectory(ledger), `${receipt.id}.receipt.json`));
    if (fault === 'receipt-mismatch') return { ...receipt, byte_length: receipt.byte_length + 1 };
    if (fault === 'cross-run') return textReceipt(store());
    if (fault === 'cross-workspace') {
      const elsewhere = path.join(workspace, 'elsewhere');
      fs.mkdirSync(elsewhere);
      fs.writeFileSync(path.join(elsewhere, 'draft.txt'), 'different evidence');
      return store(ledger.getEventContext().run_id, elsewhere).getEvidenceStore().importFile('draft.txt', 'text/plain');
    }
    return receipt;
  }

  it.each(faults)('refuses %s before invoking a permissive guard, without committing context', async fault => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const receipt = damage(ledger, textReceipt(ledger), fault);
    const guard = vi.spyOn(GuardEvaluator, 'evaluate').mockResolvedValue({ passed: true });
    const payload = { draft: { $evidence: receipt }, contextUpdates: { draft: { $evidence: receipt } } };
    const result = await engine.handleSignal('CHECK', payload, { idempotencyKey: 'invalid-evidence' });
    expect(result.transitioned).toBe(false);
    expect(result.refusalReason).toContain('Evidence verification failed');
    expect(guard).not.toHaveBeenCalled();
    expect(engine.getContext().draft).toBeUndefined();
    expect(ledger.query({ type: 'STATE_TRANSITION' })).toHaveLength(0);
    const count = ledger.getEventCount();
    const retry = await engine.handleSignal('CHECK', payload, { idempotencyKey: 'invalid-evidence' });
    expect(retry.refusalReason).toBe(result.refusalReason);
    expect(ledger.getEventCount()).toBe(count);
  });

  it.each([...faults, 'malformed'] as const)('recovers after refused %s evidence through replay, snapshot, projection and export', async fault => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const bad = fault === 'malformed' ? { $evidence: { bogus: true } } : { $evidence: damage(ledger, textReceipt(ledger, 'other'), fault) };
    const refused = await engine.handleSignal('CHECK', { draft: bad, contextUpdates: { draft: bad } });
    expect(refused.refusalReason).toContain('Evidence verification failed');
    const receipt = textReceipt(ledger);
    const accepted = await engine.handleSignal('CHECK', { draft: { $evidence: receipt } });
    expect(accepted.transitioned).toBe(true);
    expect(fs.readFileSync(accepted.deliverablesWritten[0], 'utf8')).toBe(`${JSON.stringify(bad, null, 2)}"verified"|"verified"`);
    expect(ledger.query({ type: 'PROJECTION_FAILED' })).toHaveLength(0);
    for (const snapshot of [true, false]) {
      const reopened = store(ledger.getEventContext().run_id);
      if (!snapshot) vi.spyOn(reopened, 'getLatestSnapshot').mockReturnValue(null);
      const restored = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: reopened });
      expect(restored.getCurrentState()).toBe('S2');
      expect(restored.getContext().draft).toEqual({ $evidence: receipt });
    }
    const exported = engine.exportRun();
    expect(exported.events.find(event => event.id === refused.event.id)?.payload.draft).toEqual(bad);
    expect(exported.evidence.entries.map(entry => entry.receipt)).toEqual([receipt]);
    expect(exported.evidence.skipped).toEqual(fault === 'tamper' || fault === 'missing-blob'
      ? [{ id: (bad.$evidence as EvidenceReceipt).id, error: expect.stringMatching(/mismatch|ENOENT/) }] : []);
    damage(ledger, receipt, 'missing-blob');
    expect(() => engine.exportRun()).toThrow();
  });

  it.each(['snapshot', 'replay'] as const)('fails %s restoration and export explicitly when retained evidence is unavailable', async mode => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const receipt = textReceipt(ledger);
    expect((await engine.handleSignal('CHECK', { draft: { $evidence: receipt } })).transitioned).toBe(true);
    damage(ledger, receipt, 'missing-blob');
    const reopened = store(ledger.getEventContext().run_id);
    if (mode === 'replay') vi.spyOn(reopened, 'getLatestSnapshot').mockReturnValue(null);
    expect(() => new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: reopened })).toThrow();
    expect(() => engine.exportRun()).toThrow();
  });

  it('records projection failure instead of substituting empty evidence', async () => {
    fixture(false, false);
    const ledger = store();
    const receipt = textReceipt(ledger);
    const signal = ledger.append('SIGNAL_EMITTED', { signal: 'CHECK', draft: { $evidence: receipt } });
    ledger.append('STATE_TRANSITION', { from: 'S1', to: 'S2', signal: 'CHECK' }, { causationId: signal.id });
    damage(ledger, receipt, 'tamper');
    const declarations = EvidenceDeclarationsSchema.parse({ signals: { CHECK: { '/draft': { media_type: 'text/plain', projection: 'utf8' } } } });
    const projection = new ProjectionEngine(skillDir, [{ template: 'view.hbs', output: 'corrupt.txt' }], workspace, undefined, true, declarations);
    expect(projection.project(ledger, 'S2', 'evidence-test', {})).toEqual([]);
    expect(fs.existsSync(path.join(workspace, 'corrupt.txt'))).toBe(false);
    expect(ledger.query({ type: 'PROJECTION_FAILED' })[0].payload.error).toContain('Evidence verification failed');
  });

  it('bundles receipts and blobs with canonical snapshots/events for restore in another workspace', async () => {
    fixture(true, true);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const receipt = ledger.getEvidenceStore().registerJson({ score: 1, message: 'verified' });
    const payload = { draft: { $evidence: receipt } };
    expect((await engine.handleSignal('CHECK', payload)).transitioned).toBe(true);
    const exported = engine.exportRun();
    expect(exported.events.find(event => event.type === 'SIGNAL_EMITTED')?.payload.draft).toEqual(payload.draft);
    expect(exported.snapshot?.context.draft).toEqual(payload.draft);
    expect(exported.evidence.entries).toHaveLength(1);
    const destination = path.join(workspace, 'restored');
    fs.mkdirSync(destination);
    const imported = store(ledger.getEventContext().run_id, destination);
    imported.getEvidenceStore().restoreBundle(exported.evidence);
    imported.getSqliteDriver()!.importEvents(exported.events);
    imported.saveSnapshot(exported.snapshot!.seq, exported.snapshot!.state, exported.snapshot!.context);
    fs.rmSync(registryDirectory(ledger), { recursive: true });
    const restored = new FSMEngine({ skillDir, workspaceDir: destination, eventStore: store(ledger.getEventContext().run_id, destination) });
    expect((await restored.handleSignal('CHECK', payload)).transitioned).toBe(true);
    expect(restored.exportRun().evidence.entries).toEqual(exported.evidence.entries);
  });

  it('bundles every registration when the lower-level export omits declarations', async () => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const receipt = textReceipt(ledger);
    expect((await engine.handleSignal('CHECK', { draft: { $evidence: receipt } })).transitioned).toBe(true);
    const exported = ledger.exportRun();
    expect(exported.evidence.entries.map(entry => entry.receipt)).toEqual([receipt]);
    const destination = path.join(workspace, 'restored');
    fs.mkdirSync(destination);
    const imported = store(receipt.run_id, destination);
    imported.getEvidenceStore().restoreBundle(exported.evidence);
    imported.getSqliteDriver()!.importEvents(exported.events);
    const restored = new FSMEngine({ skillDir, workspaceDir: destination, eventStore: store(receipt.run_id, destination) });
    expect(restored.getContext().draft).toEqual({ $evidence: receipt });
    damage(ledger, receipt, 'missing-blob');
    expect(() => ledger.exportRun()).toThrow();
  });

  it('never opens a registry for old inline replay, snapshot restore, guards or projections', async () => {
    fixture(false, true);
    const ledger = store();
    const registry = vi.spyOn(ledger, 'getEvidenceStore').mockImplementation(() => { throw new Error('registry must remain unused'); });
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const payload = { draft: 'verified' };
    expect((await engine.handleSignal('CHECK', payload)).transitioned).toBe(true);
    const canonicalEvents = JSON.stringify(ledger.getAll());
    for (const snapshot of [ledger.getLatestSnapshot(), null]) {
      vi.spyOn(ledger, 'getLatestSnapshot').mockReturnValue(snapshot);
      const restored = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
      expect(restored.getContext().draft).toBe('verified');
      expect(JSON.stringify(ledger.getAll())).toBe(canonicalEvents);
    }
    expect(registry).not.toHaveBeenCalled();
    expect(fs.existsSync(registryDirectory(ledger))).toBe(false);
  });

  it('does not recursively resolve hash-shaped values or undeclared reference fields', () => {
    const access = vi.fn(() => { throw new Error('no registry access'); });
    const resolver = new EvidenceResolver({ signals: { CHECK: { '/draft': { media_type: 'text/plain', projection: 'utf8' } } } }, access);
    const payload = { signal: 'CHECK', draft: { sha256: 'a'.repeat(64), nested: { $evidence: {} } }, elsewhere: { $evidence: {} } };
    const event = { id: 'inline', seq: 1, timestamp: '', type: 'SIGNAL_EMITTED', payload };
    expect(resolver.resolveEvent(event).payload).toEqual(payload);
    expect(access).not.toHaveBeenCalled();
  });

  it.each([{}, { $evidence: {} }, { $evidence: { version: 'wrong' } }, { $evidence: null }])('handles malformed declared references explicitly: %j', async value => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    expect((await engine.handleSignal('CHECK', { draft: value })).transitioned).toBe(false);
    expect(engine.getContext().draft).toBeUndefined();
  });

  it('registers exact text bytes idempotently and gives changed bytes a new receipt', () => {
    const ledger = store();
    const text = '\uFEFFverified\r\nλ';
    const first = textReceipt(ledger, text);
    expect(ledger.getEvidenceStore().read(first)).toEqual(Buffer.from(text));
    expect(textReceipt(ledger, text)).toEqual(first);
    const changed = textReceipt(ledger, `${text}\n`);
    expect(changed.id).not.toBe(first.id);
    expect(changed.sha256).not.toBe(first.sha256);
    expect(first.byte_length).toBe(Buffer.byteLength(text));
  });

  it('defines canonical JSON and explicit whole-object projection without changing the input', () => {
    const ledger = store();
    const value = { z: [false, null, 'λ'], a: { z: -0, a: 1 } };
    const receipt = ledger.getEvidenceStore().registerJson(value);
    expect(receipt.canonicalization).toBe('rsa-json/v1');
    expect(ledger.getEvidenceStore().read(receipt).toString()).toBe('{"a":{"a":1,"z":0},"z":[false,null,"λ"]}');
    const original = { envelope: { evidence: { $evidence: receipt } } };
    const resolver = new EvidenceResolver(undefined, () => ledger.getEvidenceStore());
    const resolved = resolver.resolveFields(original, { '/envelope/evidence': { media_type: 'application/json', projection: 'json' } });
    expect(resolved.envelope.evidence).toEqual(JSON.parse(canonicalEvidenceJson(value)));
    expect(original.envelope.evidence).toEqual({ $evidence: receipt });
  });

  it.each([undefined, Number.NaN, Infinity, { missing: undefined }, new Date(0), [undefined], Array(1)])('rejects values outside canonical JSON: %j', value => {
    expect(() => store().getEvidenceStore().registerJson(value)).toThrow();
  });

  it('checks explicit media and size allowlists, UTF-8 validity, and canonical JSON imports', () => {
    const ledger = store();
    const local = new LocalEvidenceStore({ workspaceDir: workspace, artifactsDir: path.dirname(registryDirectory(ledger)), runId: ledger.getEventContext().run_id!, maxBytes: 8, allowedMediaTypes: ['text/plain'] });
    fs.writeFileSync(path.join(workspace, 'short.txt'), 'verified');
    expect(local.read(local.importFile('short.txt', 'text/plain')).toString()).toBe('verified');
    fs.writeFileSync(path.join(workspace, 'long.txt'), 'verified!');
    expect(() => local.importFile('long.txt', 'text/plain')).toThrow(/bounded|maxBytes/);
    expect(() => local.registerJson({ valid: true })).toThrow(/not allowed/);
    fs.writeFileSync(path.join(workspace, 'invalid.txt'), Buffer.from([0xff]));
    expect(() => ledger.getEvidenceStore().importFile('invalid.txt', 'text/plain')).toThrow();
    fs.writeFileSync(path.join(workspace, 'pretty.json'), '{ "z": 1 }');
    expect(() => ledger.getEvidenceStore().importFile('pretty.json', 'application/json')).toThrow(/canonical/);
    fs.writeFileSync(path.join(workspace, 'canonical.json'), '{"z":1}');
    expect(ledger.getEvidenceStore().importFile('canonical.json', 'application/json').canonicalization).toBe('rsa-json/v1');
  });

  it('rejects absolute paths, traversal, source symlinks, and symlinked parents', () => {
    const ledger = store();
    fs.writeFileSync(path.join(workspace, 'draft.txt'), 'verified');
    fs.symlinkSync(path.join(workspace, 'draft.txt'), path.join(workspace, 'linked.txt'));
    fs.symlinkSync(skillDir, path.join(workspace, 'linked-dir'), 'dir');
    fs.writeFileSync(path.join(skillDir, 'draft.txt'), 'verified');
    for (const candidate of [path.join(workspace, 'draft.txt'), '../draft.txt', 'linked.txt', 'linked-dir/draft.txt', 'https://example.invalid/evidence']) {
      expect(() => ledger.getEvidenceStore().importFile(candidate, 'text/plain')).toThrow();
    }
  });

  it.each(['replace-before-open', 'mutate-during-read'] as const)('refuses registration race: %s', race => {
    const ledger = store();
    const source = path.join(workspace, 'draft.txt');
    fs.writeFileSync(source, 'verified');
    if (race === 'replace-before-open') {
      const open = fs.openSync;
      vi.spyOn(fs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
        if (args[0] === source) {
          fs.renameSync(source, `${source}.old`);
          fs.writeFileSync(source, 'replaced');
        }
        return open(...args);
      });
    } else {
      const read = fs.readSync;
      let changed = false;
      vi.spyOn(fs, 'readSync').mockImplementation(((...args: Parameters<typeof fs.readSync>) => {
        const result = read(...args);
        if (!changed) { changed = true; fs.writeFileSync(source, 'replacement'); }
        return result;
      }) as typeof fs.readSync);
    }
    expect(() => ledger.getEvidenceStore().importFile('draft.txt', 'text/plain')).toThrow(/changed/);
    expect(fs.existsSync(registryDirectory(ledger))).toBe(false);
  });

  it.each(['write', 'blob-publication', 'receipt-publication', 'sync'] as const)('recovers safely after interrupted %s', stage => {
    const ledger = store();
    const registry = ledger.getEvidenceStore();
    if (stage === 'write') vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('interrupted write'); });
    else if (stage === 'sync') vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw new Error('interrupted sync'); });
    else {
      const link = fs.linkSync;
      vi.spyOn(fs, 'linkSync').mockImplementation((source, destination) => {
        if (String(destination).endsWith(stage === 'blob-publication' ? '.blob' : '.receipt.json')) throw new Error('interrupted publication');
        return link(source, destination);
      });
    }
    expect(() => registry.registerJson({ score: 1 })).toThrow(/interrupted/);
    vi.restoreAllMocks();
    fs.writeFileSync(path.join(registryDirectory(ledger), '.pending-abandoned'), 'incomplete');
    expect(registry.exportBundle().entries).toHaveLength(0);
    const receipt = registry.registerJson({ score: 1 });
    expect(registry.read(receipt).toString()).toBe('{"score":1}');
    expect(registry.exportBundle().entries).toHaveLength(1);
  });

  it('handles concurrent registrations from separate processes without replacing complete evidence', async () => {
    const ledger = store();
    const options = { workspaceDir: workspace, artifactsDir: path.dirname(registryDirectory(ledger)), runId: ledger.getEventContext().run_id! };
    const moduleUrl = pathToFileURL(path.resolve(import.meta.dirname, '../src/core/evidence-store.ts')).href;
    const code = `import {LocalEvidenceStore} from ${JSON.stringify(moduleUrl)}; const store = new LocalEvidenceStore(JSON.parse(process.argv[1])); for (let i=0;i<8;i++) store.registerJson({score:1}); process.stdout.write(JSON.stringify(store.exportBundle()));`;
    const [one, two] = await Promise.all([1, 2].map(() => promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code, JSON.stringify(options)], { cwd: path.resolve(import.meta.dirname, '..') })));
    expect(JSON.parse(one.stdout)).toEqual(JSON.parse(two.stdout));
    expect(ledger.getEvidenceStore().exportBundle().entries).toHaveLength(1);
  });

  it('preserves idempotency and competing-engine version checks for reference signals', async () => {
    fixture(false, false);
    const ledger = store();
    const first = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const competing = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: store(ledger.getEventContext().run_id) });
    const payload = { draft: { $evidence: textReceipt(ledger) } };
    const results = await Promise.all([first.handleSignal('CHECK', payload, { idempotencyKey: 'once' }), first.handleSignal('CHECK', payload, { idempotencyKey: 'once' })]);
    expect(results.filter(result => result.transitioned)).toHaveLength(1);
    expect(ledger.query({ type: 'SIGNAL_EMITTED' })).toHaveLength(1);
    expect(ledger.query({ type: 'STATE_TRANSITION' })).toHaveLength(1);
    await expect(competing.handleSignal('CHECK', payload)).rejects.toMatchObject({ code: 'RUN_VERSION_CONFLICT' });
  });

  it('binds references to the actual signal, including when the submitted payload names another signal', async () => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const result = await engine.handleSignal('CHECK', { signal: 'UNDECLARED', draft: { $evidence: {} } });
    expect(result.transitioned).toBe(false);
    expect(result.refusalReason).toContain('signal binding');
  });

  it('validates signal declarations before expanding context updates', async () => {
    fixture(false, false);
    const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as Record<string, any>;
    manifest.evidence.context['/draft'] = { media_type: 'application/json', projection: 'json' };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const receipt = ledger.getEvidenceStore().registerJson({ score: 1 });
    vi.spyOn(GuardEvaluator, 'evaluate').mockResolvedValue({ passed: true });
    const result = await engine.handleSignal('CHECK', { contextUpdates: { draft: { $evidence: receipt } } });
    expect(result.transitioned).toBe(false);
    expect(result.refusalReason).toContain('media type mismatch');
  });

  it('rejects media/projection mismatch and malformed or overlapping field declarations', () => {
    const field = { media_type: 'text/plain', projection: 'utf8' };
    for (const context of [{ invalid: field }, { '/a~2b': field }, { '/constructor/x': field }, { '/a': field, '/a-b': field, '/a/b': field }, { '/draft': { media_type: 'application/json', projection: 'utf8' } }]) {
      expect(() => EvidenceDeclarationsSchema.parse({ context })).toThrow();
    }
    const ledger = store();
    const receipt = textReceipt(ledger);
    const resolver = new EvidenceResolver(undefined, () => ledger.getEvidenceStore());
    expect(() => resolver.resolveFields({ draft: { $evidence: receipt } }, { '/draft': { media_type: 'application/json', projection: 'json' } })).toThrow(/media type/);
    const original = { 'with/slash': [{ draft: { $evidence: receipt } }] };
    expect(resolver.resolveFields(original, { '/with~1slash/0/draft': { media_type: 'text/plain', projection: 'utf8' } })).toEqual({ 'with/slash': [{ draft: 'verified' }] });
  });

  it('does not publish any entries from a mismatched or corrupt evidence bundle', () => {
    const original = store();
    textReceipt(original);
    const bundle = original.getEvidenceStore().exportBundle();
    const target = path.join(workspace, 'bundle-target');
    fs.mkdirSync(target);
    const destination = store(original.getEventContext().run_id, target).getEvidenceStore();
    expect(() => destination.restoreBundle({ ...bundle, run_id: createSortableId() })).toThrow(/mismatch/);
    const corrupt = { ...bundle, entries: [...bundle.entries, { receipt: bundle.entries[0].receipt, bytes_base64: Buffer.from('mismatch').toString('base64') }] };
    expect(() => destination.restoreBundle(corrupt)).toThrow(/mismatch/);
    expect(destination.exportBundle().entries).toHaveLength(0);
  });

  it('retains evidence for older events after newer snapshots and opens read-only without permitting imports', async () => {
    fixture(false, false);
    const ledger = store();
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: ledger });
    const old = textReceipt(ledger, 'verified');
    expect((await engine.handleSignal('CHECK', { draft: { $evidence: old } })).transitioned).toBe(true);
    expect((await engine.handleSignal('CHECK', { draft: 'verified' })).transitioned).toBe(true);
    expect(ledger.getLatestSnapshot()?.context.draft).toBe('verified');
    expect(engine.exportRun().evidence.entries[0].receipt).toEqual(old);
    const readOnly = new EventStore({ workspaceDir: workspace, skillId: 'evidence-test', runId: old.run_id, enableSqlite: true, readOnly: true });
    stores.push(readOnly);
    expect(readOnly.getEvidenceStore().read(old).toString()).toBe('verified');
    expect(() => readOnly.getEvidenceStore().registerJson({ score: 1 })).toThrow(/read-only/);
    expect(() => readOnly.getEvidenceStore().restoreBundle(engine.exportRun().evidence)).toThrow(/read-only/);
  });

  it('registers, verifies and exports evidence in a workspace reached through a symlink', async () => {
    fixture(false, false);
    const real = path.join(workspace, 'real');
    const linked = path.join(workspace, 'linked');
    fs.mkdirSync(real);
    fs.symlinkSync(real, linked, 'dir');
    const ledger = store(createSortableId(), linked);
    const engine = new FSMEngine({ skillDir, workspaceDir: linked, eventStore: ledger });
    fs.writeFileSync(path.join(linked, 'draft.txt'), 'verified');
    const receipt = ledger.getEvidenceStore().importFile('draft.txt', 'text/plain');
    expect((await engine.handleSignal('CHECK', { draft: { $evidence: receipt } })).transitioned).toBe(true);
    expect(fs.existsSync(path.join(real, '.reactive', 'skills', 'evidence-test', 'runs', receipt.run_id, 'artifacts', 'evidence-v1', `${receipt.sha256}.blob`))).toBe(true);
    const restored = new FSMEngine({ skillDir, workspaceDir: linked, eventStore: store(receipt.run_id, linked) });
    expect(restored.getCurrentState()).toBe('S2');
    expect(engine.exportRun().evidence.entries.map(entry => entry.receipt)).toEqual([receipt]);
    fs.symlinkSync(path.join(real, 'draft.txt'), path.join(real, 'alias.txt'));
    expect(() => ledger.getEvidenceStore().importFile('alias.txt', 'text/plain')).toThrow(/symlink/);
    expect(() => ledger.getEvidenceStore().importFile('../draft.txt', 'text/plain')).toThrow(/traversal/);
  });

  it('supports paths with spaces and rejects symlinked artifact directories', () => {
    const ledger = store();
    fs.writeFileSync(path.join(workspace, 'draft with spaces.txt'), 'verified');
    expect(ledger.getEvidenceStore().importFile('draft with spaces.txt', 'text/plain').byte_length).toBe(8);
    const other = store();
    const artifacts = path.dirname(registryDirectory(other));
    fs.rmSync(artifacts, { recursive: true });
    fs.symlinkSync(skillDir, artifacts, 'dir');
    expect(() => other.getEvidenceStore().registerJson({ score: 1 })).toThrow(/symlink/);
  });
});
