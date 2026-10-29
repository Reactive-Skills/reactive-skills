import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import yaml from 'js-yaml';
import { paneText } from './capture-host.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mods-capture-'));
const input = JSON.parse(fs.readFileSync(path.join(here, 'capture-input.json'), 'utf8'));
const browserEnv = { ...process.env, CHROME_DEVTOOLS_AXI_SESSION: process.env.CHROME_DEVTOOLS_AXI_SESSION || 'mods-capture' };
const siteRequire = createRequire(path.join(root, 'apps/site/package.json'));
const require = createRequire(siteRequire.resolve('next/package.json'));
const sharp = require('sharp');
const exec = promisify(execFile);

/** # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms local target; browser waits excluded)
 * - Complexity: O(b) bounded command/output bytes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
async function browser(...args) {
  const result = await exec('chrome-devtools-axi', args, { env: browserEnv, encoding: 'utf8', timeout: 60_000 });
  assert(!/^error:/m.test(result.stdout), result.stdout);
  return result.stdout;
}

/** Runs real guarded transitions with an example clock; never edits a ledger.
 * # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target per transition)
 * - Complexity: O(e + m) bounded fixture events and manifest bytes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
async function recordRun() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'packages/runtime/tests/fixtures/public-catalog.json'), 'utf8'));
  assert.equal(catalog.commit, input.source.commit);
  const fixture = catalog.manifests.find((item) => item.path === input.source.manifest);
  assert.equal(createHash('sha1').update(`blob ${Buffer.byteLength(fixture.yaml)}\0${fixture.yaml}`).digest('hex'), fixture.git_blob);
  const manifest = yaml.load(fixture.yaml);
  const skillDir = path.join(scratch, manifest.name);
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), fixture.yaml);
  // Canonical edges derived from the pinned manifest, with guards in chart syntax.
  const edges = Object.entries(manifest.states).flatMap(([from, state]) =>
    Object.entries(state.transitions || {}).map(([signal, edge]) => `    ${from} --> ${edge.target}: ${signal} [guard]`));
  const chart = `stateDiagram-v2\n${edges.join('\n')}\n`;
  fs.writeFileSync(path.join(skillDir, 'STATECHART.md'), chart);
  const { FSMEngine } = await import(pathToFileURL(path.join(root, 'packages/runtime/dist/index.js')));
  const RealDate = globalThis.Date;
  let now = RealDate.parse(input.start);
  // Fixture clock only: durations are examples, not runtime performance measurements.
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  const engine = new FSMEngine({ workspaceDir: scratch, skillDir, jobId: input.runId });
  const snapshots = new Map();
  try {
    for (const [index, step] of input.steps.entries()) {
      now += step.dwellMs;
      const result = await engine.handleSignal(step.signal, step.payload);
      assert.equal(result.transitioned, true, step.signal);
      assert.equal(result.newState, step.state);
      snapshots.set(index + 1, { now, events: engine.getEventStore().getAll() });
    }
  } finally {
    engine.close();
    globalThis.Date = RealDate;
  }
  return { snapshots, chart, skill: manifest.name };
}

/** Execute the unmodified mod with a bounded host adapter and neutral usage.
 * # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(e + s) fixture events and pane states
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
async function renderMod(run, view) {
  const source = fs.readFileSync(path.join(root, 'mods/bq-vitals/hooks/register.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'hostElement',
  } }).outputText.replace("from 'claude-code'", `from '${pathToFileURL(path.join(here, 'capture-host.mjs')).href}'`);
  const modulePath = path.join(scratch, `${view.name}.mjs`);
  fs.writeFileSync(modulePath, `import { hostElement } from '${pathToFileURL(path.join(here, 'capture-host.mjs')).href}';\n${compiled}`);
  const mod = await import(pathToFileURL(modulePath));
  const snapshot = run.snapshots.get(view.afterStep);
  const now = snapshot.now + view.liveMs;
  const ledger = snapshot.events.map((event) => JSON.stringify(event)).join('\n');
  fs.writeFileSync(path.join(scratch, `${view.name}.events.jsonl`), `${ledger}\n`);
  const handlers = new Map();
  mod.register((event, filter, handler) => handlers.set(`${event}:${typeof filter === 'function' ? '' : filter.command || filter.component}`, handler || filter));
  let status;
  const host = {
    session: { usage: async () => input.usage },
    clock: { now: async () => now },
    process: { run: async (args) => ({ stdout: args[2].startsWith('printf') ? '/demo' : `/demo/.reactive/skills/${run.skill}/events.jsonl` }) },
    fs: { read: async (file) => {
      if (file.endsWith('STATECHART.md')) return run.chart;
      assert.equal(file, `/demo/.reactive/skills/${run.skill}/events.jsonl`);
      return ledger;
    } },
    ui: { status: (text) => { status = text; }, open: async () => {}, resolve: () => ({ Box: 'Box', Text: 'Text' }) },
  };
  await handlers.get('command.run:flow')(host);
  await handlers.get('turn.complete:')(host, {}, (event) => event);
  if (view.name === 'status-line') return status;
  if (view.name === 'flow-plan') return (await handlers.get('command.run:flow-plan')(host)).text;
  return paneText(await handlers.get('ui.render:Pane')(host, {}));
}

/** Escape literal terminal output, adding only presentation spans.
 * # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(b) bounded terminal bytes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
function highlight(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').split('\n').map((line) => {
    if (line.includes('not taken:') || line.startsWith('○')) return `<span class="muted">${line}</span>`;
    return line.replace(/█+/g, (bar) => `<span class="bar" style="width:${bar.length}ch"></span>`).replace(/✔/g, '<span class="signal">$&</span>').replace(/▶.*|▸.*/g, '<span class="current">$&</span>');
  }).join('\n');
}

/** Reflow the live pane's existing state list beside its existing plan.
 * # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(b) bounded terminal bytes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
function terminalBody(text, view) {
  if (view.name !== 'flow') return `<pre>${highlight(text)}</pre>`;
  const [runHeader, ...lines] = text.split('\n');
  const planAt = lines.indexOf('Plan');
  assert(planAt > 0, 'Expected the live pane state list followed by Plan');
  const states = lines.slice(0, planAt).join('\n').trim();
  const plan = lines.slice(planAt).join('\n');
  return `<div class="flow-pane"><pre>${highlight(runHeader)}</pre><div class="flow-columns"><pre>${highlight(states)}</pre><pre>${highlight(plan)}</pre></div></div>`;
}

const run = await recordRun();
const font = fs.readFileSync(path.join(here, 'DejaVuSansMono.ttf')).toString('base64');
const css = fs.readFileSync(path.join(here, 'capture.css'), 'utf8').replace('FONT_DATA', font);
const documents = new Map();
for (const view of input.views) {
  const text = await renderMod(run, view);
  fs.writeFileSync(path.join(scratch, `${view.name}.txt`), text);
  documents.set(`/${view.name}`, `<!doctype html><meta charset="utf-8"><title>bq-vitals ${view.title}</title><style>${css}</style><div class="window"><header><span class="dots"><i></i><i></i><i></i></span><span class="title">bq-vitals · ${view.title}</span><span class="example">example run</span></header>${terminalBody(text, view)}</div>`);
}
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(documents.get(request.url) || 'Not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
console.log(`Capture proof: ${scratch}`);
try {
  // Work around the browser bridge's initial unselected-tab behavior.
  const pages = await browser('pages');
  const first = pages.match(/^\s*(\d+),/m);
  if (first) await browser('selectpage', first[1]);
  for (const view of input.views) {
    await browser('open', `http://127.0.0.1:${server.address().port}/${view.name}`);
    await browser('eval', 'async () => { await document.fonts.ready; return document.body.scrollHeight; }');
    const height = Number((await browser('eval', 'document.body.scrollHeight')).match(/\b\d+\b/)?.[0]);
    assert(Number.isFinite(height) && height > 0 && height < 2000);
    await browser('emulate', '--viewport', `840x${height}x2`);
    const raw = path.join(scratch, `${view.name}.png`);
    await browser('screenshot', raw);
    await sharp(raw).png({ compressionLevel: 9, palette: true, colours: 128 }).toFile(path.join(here, `${view.name}.png`));
    const meta = await sharp(path.join(here, `${view.name}.png`)).metadata();
    assert.equal(meta.width, 1680);
    assert.equal(meta.height, height * 2);
    console.log(`${view.name}.png: ${meta.width}x${meta.height}`);
  }
} finally {
  server.closeAllConnections();
  server.close();
}
