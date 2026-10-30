// Seeded, synthetic context filler: realistic but unrelated engineering requests (logs, code review,
// manifests, notes, CSV). Every name, number and sentence is generated here; nothing comes from real data.

export interface FillerMessage {
  kind: string;
  text: string;
  bytes: number;
}

/** mulberry32: small deterministic PRNG so the same seed yields byte-identical filler. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T>(r: Rand, items: readonly T[]): T => items[Math.floor(r() * items.length)];
const int = (r: Rand, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
const hex = (r: Rand, n: number): string => Array.from({ length: n }, () => '0123456789abcdef'[int(r, 0, 15)]).join('');

const SERVICES = ['billing-api', 'catalog', 'search-gateway', 'notifier', 'ledger-sync', 'media-resizer', 'geo-lookup'];
const ENDPOINTS = ['/v2/invoices', '/v2/invoices/:id/pdf', '/v1/items', '/v1/items/:id', '/search', '/v1/notify', '/sync/batch', '/thumb', '/geo/ip'];
const REGIONS = ['eu-west', 'us-east', 'ap-south', 'sa-east', 'us-west'];
const NAMES = ['Ada', 'Bram', 'Chen', 'Dara', 'Eko', 'Femi', 'Gita', 'Hugo', 'Ines', 'Joon', 'Kemi', 'Lior'];
const NOUNS = ['rate card', 'carrier quote', 'zone table', 'surcharge', 'pallet rule', 'fuel index', 'dimensional weight'];
const VERBS = ['normalize', 'resolve', 'merge', 'expand', 'clamp', 'project', 'reconcile'];

function logText(r: Rand, bytes: number): string {
  const lines: string[] = [];
  let size = 0;
  let ms = Date.UTC(2026, 2, 3, 9, 0, 0);
  while (size < bytes) {
    ms += int(r, 5, 900);
    const status = r() < 0.06 ? pick(r, [500, 502, 503, 504]) : r() < 0.1 ? pick(r, [400, 404, 409, 429]) : 200;
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const line = `${new Date(ms).toISOString()} ${level} ${pick(r, SERVICES)} req=${hex(r, 12)} ${pick(r, ['GET', 'POST', 'PUT'])} ${pick(r, ENDPOINTS)} status=${status} dur_ms=${status >= 500 ? int(r, 900, 9000) : int(r, 3, 450)} region=${pick(r, REGIONS)}${status >= 500 ? ` err="${pick(r, ['upstream timeout', 'pool exhausted', 'connection reset', 'deadline exceeded'])}"` : ''}`;
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join('\n');
}

function codeText(r: Rand, bytes: number): string {
  const parts: string[] = ['// shipping-rates/src/quote.ts', "import { Zone, Parcel, Quote } from './model';", ''];
  let size = 0;
  let n = 0;
  while (size < bytes) {
    n += 1;
    const verb = pick(r, VERBS);
    const noun = pick(r, NOUNS).replace(/ (\w)/g, (_m, c: string) => c.toUpperCase());
    const fn = [
      `export function ${verb}${noun[0].toUpperCase()}${noun.slice(1)}${n}(parcel: Parcel, zone: Zone): Quote {`,
      `  const base = zone.baseRate * ${(r() * 3 + 0.5).toFixed(2)};`,
      `  let weight = parcel.weightKg;`,
      `  if (parcel.lengthCm * parcel.widthCm * parcel.heightCm / ${pick(r, [5000, 6000, 4000])} > weight) {`,
      `    weight = parcel.lengthCm * parcel.widthCm * parcel.heightCm / ${pick(r, [5000, 6000, 4000])};`,
      '  }',
      `  const surcharge = zone.remote ? ${int(r, 2, 15)} : ${r() < 0.2 ? 'undefined' : '0'};`,
      `  for (let i = 0; i <= zone.bands.length; i++) {`,
      `    if (weight < zone.bands[i].maxKg) return { carrier: '${pick(r, ['north', 'swift', 'parcelco', 'ferro'])}', amount: base + zone.bands[i].price + surcharge };`,
      '  }',
      `  return { carrier: 'fallback', amount: base * ${int(r, 2, 4)} };`,
      '}',
      '',
    ].join('\n');
    parts.push(fn);
    size += fn.length;
  }
  return parts.join('\n');
}

function manifestText(r: Rand, bytes: number): string {
  const docs: string[] = [];
  let size = 0;
  while (size < bytes) {
    const name = `${pick(r, SERVICES)}-${hex(r, 4)}`;
    const limits = r() < 0.7;
    const doc = [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      `  name: ${name}`,
      `  labels: { team: ${pick(r, ['payments', 'growth', 'platform', 'data'])}, tier: ${pick(r, ['web', 'worker', 'batch'])} }`,
      'spec:',
      `  replicas: ${pick(r, [1, 2, 3, 3, 4, 6])}`,
      '  template:',
      '    spec:',
      '      containers:',
      `        - name: ${name.split('-')[0]}`,
      `          image: registry.example.invalid/${name.split('-')[0]}:${int(r, 1, 9)}.${int(r, 0, 30)}.${int(r, 0, 9)}`,
      ...(limits ? ['          resources:', `            limits: { cpu: "${int(r, 1, 8) * 250}m", memory: "${int(r, 1, 16) * 128}Mi" }`] : []),
      `          env: [{ name: LOG_LEVEL, value: ${pick(r, ['info', 'debug', 'warn'])} }, { name: REGION, value: ${pick(r, REGIONS)} }]`,
      '---',
    ].join('\n');
    docs.push(doc);
    size += doc.length + 1;
  }
  return docs.join('\n');
}

function notesText(r: Rand, bytes: number): string {
  const lines: string[] = ['# Platform sync — notes'];
  let size = 0;
  while (size < bytes) {
    const who = pick(r, NAMES);
    const line = pick(r, [
      `- ${who} reported that ${pick(r, SERVICES)} p99 rose to ${int(r, 300, 2400)}ms after the ${pick(r, ['cache', 'pool', 'retry', 'index'])} change; ${pick(r, NAMES)} suspects ${pick(r, ['lock contention', 'a missing index', 'cold caches', 'retry storms'])}.`,
      `- Decision: move ${pick(r, SERVICES)} to ${pick(r, REGIONS)} by ${pick(r, ['next sprint', 'end of quarter', 'the freeze'])}; owner ${who}.`,
      `- Action: ${who} to write a runbook for ${pick(r, ['failover', 'key rotation', 'backfill', 'rate limiting'])} (due ${int(r, 1, 28)}/${int(r, 4, 9)}).`,
      `- Discussion: ${pick(r, NOUNS)} logic duplicated across ${int(r, 2, 5)} services; ${who} proposes a shared library, ${pick(r, NAMES)} prefers an RPC.`,
      `- ${who}: on-call load was ${int(r, 3, 40)} pages last week, ${int(r, 0, 12)} of them noise from ${pick(r, SERVICES)} health checks.`,
    ]);
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join('\n');
}

function csvText(r: Rand, bytes: number): string {
  const lines = ['order_id,region,placed_at,items,amount_eur,refunded'];
  let size = 0;
  while (size < bytes) {
    const line = `${hex(r, 10)},${pick(r, REGIONS)},2026-0${int(r, 1, 6)}-${String(int(r, 1, 28)).padStart(2, '0')},${int(r, 1, 9)},${(r() * 400 + 5).toFixed(2)},${r() < 0.07 ? 'yes' : 'no'}`;
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join('\n');
}

const KINDS = [
  { kind: 'logs', make: logText, ask: 'Which service and endpoint produce the most 5xx responses, and what error dominates? Answer in at most five bullets.' },
  { kind: 'code-review', make: codeText, ask: 'Review this module and name the three most serious bugs or risks you see, one line each.' },
  { kind: 'manifests', make: manifestText, ask: 'List the deployments that run a single replica or have no resource limits. Give counts, not the full list.' },
  { kind: 'notes', make: notesText, ask: 'Summarize the decisions and the action items with owners in at most six bullets.' },
  { kind: 'csv', make: csvText, ask: 'Which region has the highest refund rate? Estimate from the rows; one short paragraph.' },
] as const;

/** # Performance & Risk Budget
 * - Tier: P3 (offline generator; < 200ms per 100 KB)
 * - Complexity: O(b) generated bytes
 * - Cyclomatic Complexity (CC): 2 (threshold <= 20) */
export function fillerMessage(seed: number, index: number, bytes: number, during: boolean): FillerMessage {
  const r = rng(seed * 1000 + index);
  const spec = KINDS[index % KINDS.length];
  const intro = during
    ? 'Before you continue: an unrelated request from a teammate. Answer it briefly, change no files, then carry on with your current task.'
    : 'Unrelated request from a teammate. Answer briefly and change no files.';
  const text = `${intro}\n\n\`\`\`\n${spec.make(r, bytes)}\n\`\`\`\n\n${spec.ask} Keep the answer under 120 words.`;
  return { kind: spec.kind, text, bytes: Buffer.byteLength(text) };
}
