import vm from 'node:vm';
import { analyzeJs, HitCollector, stripHashComments, type JsViews, type VetHit } from './source.js';

export type CodeLanguage = 'js' | 'py' | 'sh' | 'go';

function* matches(re: RegExp, text: string): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) re.lastIndex++;
    yield m;
  }
}

const safeDetail = (value: string): string | undefined => (/^[\w$:@/.\-[\]…]{1,64}$/.test(value) ? value : undefined);

// ---------------------------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------------------------

/** Credential stores and secret files. Used by the code rule and by the prose rule. */
export const CREDENTIAL_PATH_SOURCE = String.raw`(?:^|[\\/'"\x60~=\s:(,@])\.(?:ssh|aws|gnupg|kube|azure|npmrc|netrc|pypirc|git-credentials|bash_history|zsh_history)(?=$|[\\/'"\x60\s:),.;])|\.docker[\\/]config\.json|\.config[\\/](?:gcloud|gh|git[\\/]credentials)\b|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|/etc/(?:shadow|sudoers|passwd)\b|/proc/(?:self|\d+)/environ|Library/Keychains|\bAppData[\\/]Roaming[\\/]\.?(?:gnupg|npm)\b`;
const CREDENTIAL_PATH = new RegExp(CREDENTIAL_PATH_SOURCE, 'gi');

const CREDENTIAL_NAME = /(?:TOKEN|SECRET|PASSW|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH|COOKIE|SESSION|^AWS_|^GH_|^GITHUB_|^NPM_|^SSH_|^ANTHROPIC|^OPENAI)/i;

/** The arguments of the call whose `(` is at `open`, up to `max`, read from text that still has its strings. */
function callArguments(text: string, structure: string, open: number, max = 2): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  const limit = Math.min(structure.length, open + 500);
  for (let i = open + 1; i < limit && args.length < max; i++) {
    const c = structure[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) {
        args.push(text.slice(start, i));
        return args;
      }
      depth--;
    } else if (c === ',' && depth === 0) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (args.length < max) args.push(text.slice(start, limit));
  return args;
}

/** Which arguments of a file-system call name a path that the call changes. */
function writtenArguments(name: string, args: string[]): string[] {
  if (/^(?:copyFile|cp|symlink|link)(?:Sync)?$/.test(name)) return args.slice(1);
  if (/^rename(?:Sync)?$/.test(name)) return args.slice(0, 2);
  return args.slice(0, 1);
}

/** True when a path argument visibly points outside the skill. */
const ESCAPING_PATH =
  /^\s*(?:['"`](?:\/|~|[A-Za-z]:[\\/]|\\\\|\$\{?HOME|%(?:USERPROFILE|HOME|APPDATA|LOCALAPPDATA)%|file:)|(?:\w+\s*\.\s*)?(?:os\s*\.\s*)?homedir\s*\(|(?:\w+\s*\.\s*)?expanduser\b)|(?:^|[\s,('"`\\/])\.\.(?:[\\/'"`]|$)|\bos\s*\.\s*homedir\s*\(|\bhomedir\s*\(\s*\)|\bprocess\s*\.\s*env\s*\.\s*(?:HOME|USERPROFILE|APPDATA|LOCALAPPDATA|XDG_\w+)\b|\bPath\s*\.\s*home\s*\(|\bos\s*\.\s*path\s*\.\s*expanduser\b|\buser\.home\b/;

const isOutsidePath = (argument: string): boolean => ESCAPING_PATH.test(argument);

// ---------------------------------------------------------------------------------------------
// JavaScript and TypeScript
// ---------------------------------------------------------------------------------------------

const CHILD_PROCESS_MODULES = new Set(['child_process', 'cluster', 'shelljs', 'execa', 'cross-spawn', 'node-pty', 'zx', 'child-process-promise']);
const NETWORK_MODULES = new Set([
  'net', 'http', 'https', 'http2', 'dgram', 'dns', 'dns/promises', 'tls',
  'axios', 'node-fetch', 'undici', 'got', 'superagent', 'ws', 'request', 'needle', 'cross-fetch', 'isomorphic-fetch',
  'socket.io-client', 'ky', 'phin', 'bent', 'ssh2', 'basic-ftp', 'ftp', 'nodemailer',
]);

const MODULE_SPECIFIER = /\b(?:from|import)\s*(?=['"`])|\b(?:require|import)\s*\(\s*(?=['"`])/g;
const DYNAMIC_LOAD = /\b(?:require|import)\s*\(\s*(?!['"`)\s])/g;
const NON_LITERAL_LOADERS = /\bcreateRequire\b|\bprocess\s*\.\s*(?:mainModule|dlopen)\b|\bmodule\s*\.\s*(?:require|constructor)\b|\bModule\s*\.\s*_load\b/g;
const ENV_TOKEN = /\bprocess\s*\.\s*env\b|\bprocess\s*\[/g;
const FS_WRITE_SYNC = /(?<![\w$])(writeFileSync|appendFileSync|createWriteStream|rmSync|unlinkSync|mkdirSync|copyFileSync|renameSync|symlinkSync|rmdirSync|truncateSync|chmodSync|chownSync|cpSync|linkSync|utimesSync)\s*\(/g;
const FS_WRITE_MEMBER = /\b(?:fs\w*|promises|fsp|fse)\s*\.\s*(?:promises\s*\.\s*)?(writeFile|appendFile|rm|rmdir|unlink|mkdir|copyFile|rename|symlink|truncate|chmod|chown|cp|link|utimes)\s*\(/g;
const FS_WRITE_OPEN = /\b(?:fs\w*|promises)\s*\.\s*(?:promises\s*\.\s*)?(openSync|open)\s*\(/g;
const RUNTIME_WRITE = /\b(?:Bun\s*\.\s*write|Deno\s*\.\s*(?:writeTextFile|writeFile|remove|mkdir|rename|symlink|copyFile))\s*\(/g;

const DYNAMIC_CODE_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![.\w$])eval\s*\(/g, 'eval'],
  [/\bnew\s+Function\b/g, 'Function'],
  [/(?<![.\w$])Function\s*\(/g, 'Function'],
  [/\bvm\s*\.\s*(?:runIn(?:This|New)?Context|Script|compileFunction|SourceTextModule)\b/g, 'vm'],
  [/\bnew\s+Script\s*\(/g, 'vm'],
  [/\.\s*constructor\s*\(\s*['"`]/g, 'constructor'],
  [/\b(?:setTimeout|setInterval|setImmediate)\s*\(\s*['"`]/g, 'setTimeout'],
];
const DECODE_PATTERNS: Array<[RegExp, string]> = [
  [/(?<![.\w$])atob\s*\(/g, 'atob'],
  [/\bString\s*\.\s*fromCharCode\s*(?:\.\s*apply\b|\(\s*\.\.\.)/g, 'fromCharCode'],
  [/(?<![.\w$])unescape\s*\(/g, 'unescape'],
  [/\bzlib\s*\.\s*(?:inflate|gunzip|unzip|brotliDecompress)\w*/g, 'zlib'],
];
const BUFFER_DECODE = /\bBuffer\s*\.\s*from\s*\([^)]{0,400}['"](?:base64|base64url|hex)['"]/g;

const NETWORK_CALLS: Array<[RegExp, string]> = [
  [/(?<![.\w$])fetch\s*\(/g, 'fetch'],
  [/\b(?:globalThis|window|self|global)\s*\.\s*fetch\b/g, 'fetch'],
  [/\bnew\s+(?:XMLHttpRequest|WebSocket|EventSource|WebTransport)\b/g, 'WebSocket'],
  [/\bXMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/\bnavigator\s*\.\s*sendBeacon\b/g, 'sendBeacon'],
  [/\b(?:Bun|Deno)\s*\.\s*(?:connect|listen|serve|connectTls)\b/g, 'connect'],
];
const PROCESS_CALLS: Array<[RegExp, string]> = [
  [/\bprocess\s*\.\s*binding\s*\(/g, 'process.binding'],
  [/\b(?:Bun\s*\.\s*(?:spawn|spawnSync|\$)|Deno\s*\.\s*(?:run|Command))\b/g, 'spawn'],
];

function destructuredNames(before: string): string[] | undefined {
  const head = before.trimEnd();
  if (!head.endsWith('=')) return undefined;
  const pattern = head.slice(0, -1).trimEnd();
  if (!pattern.endsWith('}')) return undefined;
  const open = pattern.lastIndexOf('{');
  if (open === -1) return undefined;
  const body = pattern.slice(open + 1, -1);
  if (body.includes('...') || body.includes('[') || body.includes('{')) return undefined;
  const names = body
    .split(',')
    .map((part) => part.split(/[:=]/)[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
  return names.length > 0 ? names : undefined;
}

/** Scan under both readings of an ambiguous slash and keep every distinct hit. */
function scanJavaScript(source: string): VetHit[] {
  const hits = new HitCollector();
  for (const regexLiterals of [true, false]) scanJavaScriptReading(analyzeJs(source, regexLiterals), hits);
  return hits.finish();
}

function scanJavaScriptReading(views: JsViews, hits: HitCollector): void {
  const { noComments, code } = views;
  const live = (index: number): boolean => code.charCodeAt(index) === noComments.charCodeAt(index);

  // Module specifiers, from imports and requires that are real code.
  for (const m of matches(MODULE_SPECIFIER, code)) {
    const start = m.index + m[0].length;
    const quote = noComments[start];
    const end = noComments.indexOf(quote, start + 1);
    if (end === -1 || end - start > 200) continue;
    const specifier = noComments.slice(start + 1, end);
    if (quote === '`' && specifier.includes('${')) {
      hits.push({ rule: 'code/dynamic-require', index: m.index });
      continue;
    }
    const name = specifier.replace(/^node:/, '');
    const root = name.startsWith('@') ? name : name.split('/')[0];
    if (CHILD_PROCESS_MODULES.has(name) || CHILD_PROCESS_MODULES.has(root)) {
      hits.push({ rule: 'code/child-process', index: m.index, detail: safeDetail(name) });
    } else if (NETWORK_MODULES.has(name) || NETWORK_MODULES.has(root)) {
      hits.push({ rule: 'code/network', index: m.index, detail: safeDetail(name) });
    } else if (name === 'vm') {
      hits.push({ rule: 'code/dynamic-code', index: m.index, detail: 'vm' });
    }
  }
  for (const m of matches(DYNAMIC_LOAD, code)) hits.push({ rule: 'code/dynamic-require', index: m.index });
  for (const m of matches(NON_LITERAL_LOADERS, code)) hits.push({ rule: 'code/dynamic-require', index: m.index, detail: safeDetail(m[0].replace(/\s+/g, '')) });

  for (const [re, detail] of NETWORK_CALLS) {
    for (const m of matches(re, code)) hits.push({ rule: 'code/network', index: m.index, detail });
  }
  for (const [re, detail] of PROCESS_CALLS) {
    for (const m of matches(re, code)) hits.push({ rule: 'code/child-process', index: m.index, detail });
  }

  // Environment access: named reads are low or medium, anything wider is high.
  for (const m of matches(ENV_TOKEN, code)) {
    const end = m.index + m[0].length;
    if (m[0].endsWith('[')) {
      const bracket = /^\s*(['"`])env\1\s*\]/.exec(noComments.slice(end, end + 20));
      if (!bracket) {
        hits.push({ rule: 'code/env-broad', index: m.index, detail: 'process[…]' });
        continue;
      }
      classifyEnvAccess(noComments, m.index, end + bracket[0].length, hits);
      continue;
    }
    classifyEnvAccess(noComments, m.index, end, hits);
  }

  for (const m of matches(CREDENTIAL_PATH, noComments)) hits.push({ rule: 'code/credential-path', index: m.index });

  // File writes.
  const writeCalls: RegExp[] = [FS_WRITE_SYNC, FS_WRITE_MEMBER, RUNTIME_WRITE];
  for (const re of writeCalls) {
    for (const m of matches(re, code)) {
      const open = m.index + m[0].length - 1;
      const targets = writtenArguments(m[1] ?? 'write', callArguments(noComments, code, open));
      hits.push({ rule: targets.some(isOutsidePath) ? 'code/fs-write-outside' : 'code/fs-write', index: m.index, detail: safeDetail(m[1] ?? 'write') });
    }
  }
  for (const m of matches(FS_WRITE_OPEN, code)) {
    const open = m.index + m[0].length - 1;
    const call = noComments.slice(open, open + 300);
    if (!/,\s*['"`](?:[wa]|r\+)[^'"`]*['"`]/.test(call) && !/\bO_(?:WRONLY|RDWR|CREAT|APPEND)\b/.test(call)) continue;
    const [argument = ''] = callArguments(noComments, code, open, 1);
    hits.push({ rule: isOutsidePath(argument) ? 'code/fs-write-outside' : 'code/fs-write', index: m.index, detail: m[1] });
  }

  // Code built from strings.
  let firstEval: VetHit | undefined;
  for (const [re, detail] of DYNAMIC_CODE_PATTERNS) {
    for (const m of matches(re, code)) {
      const hit = { rule: 'code/dynamic-code', index: m.index, detail };
      hits.push(hit);
      if (detail !== 'setTimeout' && (firstEval === undefined || hit.index < firstEval.index)) firstEval = hit;
    }
  }
  if (firstEval) {
    let decoder: string | undefined;
    for (const [re, detail] of DECODE_PATTERNS) {
      if (matches(re, code).next().done === false) decoder ??= detail;
    }
    for (const m of matches(BUFFER_DECODE, noComments)) {
      if (live(m.index)) decoder ??= 'Buffer.from';
    }
    if (decoder) hits.push({ rule: 'code/decoded-exec', index: firstEval.index, detail: decoder });
  }
}

function classifyEnvAccess(noComments: string, start: number, end: number, hits: HitCollector): void {
  const after = noComments.slice(end, end + 200);
  const dot = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(after);
  const bracket = /^\s*\[\s*(['"`])([^'"`$\\\n]{1,100})\1\s*\]/.exec(after);
  const name = dot?.[1] ?? bracket?.[2];
  if (name !== undefined) {
    hits.push({ rule: CREDENTIAL_NAME.test(name) ? 'code/env-credential' : 'code/env-read', index: start, detail: safeDetail(name) });
    return;
  }
  const names = destructuredNames(noComments.slice(Math.max(0, start - 700), start));
  if (names) {
    for (const each of names) {
      hits.push({ rule: CREDENTIAL_NAME.test(each) ? 'code/env-credential' : 'code/env-read', index: start, detail: safeDetail(each) });
    }
    return;
  }
  hits.push({ rule: 'code/env-broad', index: start, detail: 'process.env' });
}

// ---------------------------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------------------------

const PY_IMPORT_PROCESS = /^[ \t]*(?:import|from)[ \t]+(subprocess|pty|commands|plumbum)\b/gm;
const PY_IMPORT_NETWORK = /^[ \t]*(?:import|from)[ \t]+(socket|socketserver|requests|urllib\d?|httpx|aiohttp|http\.client|http\.server|ftplib|smtplib|telnetlib|paramiko|websockets?|pycurl|xmlrpc|poplib|imaplib)\b/gm;
const PY_PROCESS_CALLS = /\bos\s*\.\s*(system|popen|execl|execle|execlp|execv|execve|execvp|spawnl|spawnv|spawnlp|spawnvp|startfile)\s*\(/g;
const PY_NETWORK_CALLS = /\basyncio\s*\.\s*(open_connection|start_server|create_connection)\b/g;
const PY_ENV = /\bos\s*\.\s*(?:environ|getenv|putenv|environb)\b/g;
const PY_WRITE_CALLS = /\b(?:shutil\s*\.\s*(rmtree|copy\w*|move)|os\s*\.\s*(remove|unlink|rmdir|removedirs|rename|renames|replace|makedirs|mkdir|symlink|link|chmod|chown|truncate)|(?:Path\s*\([^)]{0,200}\)|\w+)\s*\.\s*(write_text|write_bytes))\s*\(/g;
const PY_OPEN = /(?<![.\w])open\s*\(/g;
const PY_DYNAMIC_CODE = /(?<![.\w])(eval|exec|compile)\s*\(/g;
const PY_DYNAMIC_IMPORT = /(?<![.\w])__import__\s*\(|\bimportlib\s*\.\s*import_module\s*\(\s*(?!['"])/g;
const PY_DECODE = /\b(?:base64\s*\.\s*(?:b64decode|decodebytes|urlsafe_b64decode|a85decode)|binascii\s*\.\s*unhexlify|bytes\s*\.\s*fromhex|zlib\s*\.\s*decompress|codecs\s*\.\s*decode)\b/g;

function scanPython(source: string): VetHit[] {
  const text = stripHashComments(source);
  const hits = new HitCollector();
  for (const m of matches(PY_IMPORT_PROCESS, text)) hits.push({ rule: 'code/child-process', index: m.index, detail: m[1] });
  for (const m of matches(PY_PROCESS_CALLS, text)) hits.push({ rule: 'code/child-process', index: m.index, detail: `os.${m[1]}` });
  for (const m of matches(PY_IMPORT_NETWORK, text)) hits.push({ rule: 'code/network', index: m.index, detail: safeDetail(m[1]) });
  for (const m of matches(PY_NETWORK_CALLS, text)) hits.push({ rule: 'code/network', index: m.index, detail: `asyncio.${m[1]}` });

  for (const m of matches(PY_ENV, text)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 120);
    const named = /^\s*\[\s*['"]([^'"\n]{1,100})['"]\s*\]/.exec(after) ?? /^\s*\.\s*get\s*\(\s*['"]([^'"\n]{1,100})['"]/.exec(after) ?? (m[0].endsWith('getenv') ? /^\s*\(\s*['"]([^'"\n]{1,100})['"]/.exec(after) : null);
    if (named) hits.push({ rule: CREDENTIAL_NAME.test(named[1]) ? 'code/env-credential' : 'code/env-read', index: m.index, detail: safeDetail(named[1]) });
    else hits.push({ rule: 'code/env-broad', index: m.index, detail: 'os.environ' });
  }
  for (const m of matches(CREDENTIAL_PATH, text)) hits.push({ rule: 'code/credential-path', index: m.index });

  for (const m of matches(PY_WRITE_CALLS, text)) {
    const open = m.index + m[0].length - 1;
    const name = m[1] ?? m[2] ?? m[3];
    const targets = /write_(?:text|bytes)\s*\($/.test(m[0]) ? [text.slice(m.index, open)] : writtenArguments(name, callArguments(text, text, open));
    hits.push({ rule: targets.some(isOutsidePath) ? 'code/fs-write-outside' : 'code/fs-write', index: m.index, detail: safeDetail(name) });
  }
  for (const m of matches(PY_OPEN, text)) {
    const open = m.index + m[0].length - 1;
    const call = text.slice(open, open + 300);
    if (!/,\s*(?:mode\s*=\s*)?['"][rwxabt+]*[wax+][rwxabt+]*['"]/.test(call)) continue;
    const [target = ''] = callArguments(text, text, open, 1);
    hits.push({ rule: isOutsidePath(target) ? 'code/fs-write-outside' : 'code/fs-write', index: m.index, detail: 'open' });
  }

  let firstDynamic: number | undefined;
  for (const m of matches(PY_DYNAMIC_CODE, text)) {
    firstDynamic ??= m.index;
    hits.push({ rule: 'code/dynamic-code', index: m.index, detail: m[1] });
  }
  for (const m of matches(PY_DYNAMIC_IMPORT, text)) hits.push({ rule: 'code/dynamic-require', index: m.index });
  const decode = matches(PY_DECODE, text).next();
  if (firstDynamic !== undefined && decode.done === false) {
    hits.push({ rule: 'code/decoded-exec', index: firstDynamic, detail: safeDetail(decode.value[0].replace(/\s+/g, '')) });
  }
  return hits.finish();
}

// ---------------------------------------------------------------------------------------------
// Shell and PowerShell
// ---------------------------------------------------------------------------------------------

const SH_NETWORK_COMMAND = /(?:^|[;&|(`{]|\$\()[ \t]*(?:sudo[ \t]+(?:-\S+[ \t]+){0,4})?(curl|wget|nc|ncat|netcat|socat|ssh|scp|sftp|rsync|ftp|tftp|telnet|aria2c|http|https|xh)\b/gm;
const SH_NETWORK_CMDLET = /\b(Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|Send-MailMessage|iwr|irm|Test-NetConnection)\b|New-Object[ \t]+(?:System\.)?Net\.(?:WebClient|Sockets\.\w+)|System\.Net\.(?:WebClient|Sockets|Http)\w*|certutil[ \t][^\n]{0,80}-urlcache|bitsadmin[ \t]+\/transfer|\/dev\/(?:tcp|udp)\//gi;
const SH_ENV_BROAD = /(?:^|[;&|(`{]|\$\()[ \t]*(?:printenv|env|export[ \t]+-p|declare[ \t]+-[xp]+|set)[ \t]*(?=$|[|;>&)\r])|\b(?:Get-ChildItem|gci|ls|dir)[ \t]+(?:-Path[ \t]+)?Env:|\[(?:System\.)?Environment\]::GetEnvironmentVariables/gim;
const SH_DYNAMIC = /(?:^|[;&|(`{]|\$\()[ \t]*eval[ \t]|\b(?:bash|sh|zsh|pwsh|powershell)[ \t]+-(?:c|Command|EncodedCommand|enc)\b|\b(?:Invoke-Expression|iex)\b/gim;
const SH_WRITE_OUTSIDE = /\b(?:cp|mv|ln|install|tee|dd|chmod|chown|mkdir|touch|rm|rmdir|truncate)\b[^\n;|&]{0,200}?[ \t]=?(?:\/(?!tmp\b|dev\/(?:null|stderr|stdout)\b)|~|\$HOME|\$\{HOME\}|%USERPROFILE%|%APPDATA%)\S*|>>?[ \t]*(?:\/(?!tmp\b|dev\/(?:null|stderr|stdout)\b)|~|\$HOME|\$\{HOME\}|%USERPROFILE%)\S*|\bRemove-Item\b[^\n]{0,200}?(?:[A-Za-z]:\\|\$env:USERPROFILE|~)/gi;
const SH_DECODE_EXEC = /\bbase64[ \t]+(?:-d|--decode|-D)\b[^\n]{0,200}\|[ \t]*(?:sh|bash|zsh|python\d?|node|perl|iex)\b|\bFromBase64String\([^)\n]{0,200}\)[^\n]{0,200}\b(?:iex|Invoke-Expression)\b|-(?:EncodedCommand|enc)[ \t]+[A-Za-z0-9+/=]{16,}/gi;

function scanShell(source: string): VetHit[] {
  const text = stripHashComments(source);
  const hits = new HitCollector();
  for (const m of matches(SH_NETWORK_COMMAND, text)) hits.push({ rule: 'code/network', index: m.index, detail: safeDetail(m[1]) });
  for (const m of matches(SH_NETWORK_CMDLET, text)) hits.push({ rule: 'code/network', index: m.index, detail: safeDetail(m[1] ?? m[0].slice(0, 24)) });
  for (const m of matches(SH_ENV_BROAD, text)) hits.push({ rule: 'code/env-broad', index: m.index, detail: 'environment' });
  for (const m of matches(CREDENTIAL_PATH, text)) hits.push({ rule: 'code/credential-path', index: m.index });
  for (const m of matches(SH_DYNAMIC, text)) hits.push({ rule: 'code/dynamic-code', index: m.index, detail: 'eval' });
  for (const m of matches(SH_WRITE_OUTSIDE, text)) hits.push({ rule: 'code/fs-write-outside', index: m.index });
  for (const m of matches(SH_DECODE_EXEC, text)) hits.push({ rule: 'code/decoded-exec', index: m.index });
  return hits.finish();
}

// ---------------------------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------------------------

const GO_IMPORT = /^[ \t]*(?:import[ \t]+)?(?:[\w._]+[ \t]+)?"([\w./-]+)"[ \t]*$/gm;
const GO_PROCESS_CALLS = /\b(?:exec\s*\.\s*Command(?:Context)?|syscall\s*\.\s*(?:Exec|ForkExec))\s*\(/g;
const GO_NETWORK_CALLS = /\b(?:http\s*\.\s*(?:Get|Post|PostForm|Head|NewRequest\w*|ListenAndServe\w*)|net\s*\.\s*(?:Dial\w*|Listen\w*))\s*\(/g;
const GO_ENV = /\bos\s*\.\s*(Environ|Getenv|LookupEnv|Setenv)\s*\(\s*(?:"([^"\n]{1,100})")?/g;
const GO_WRITE_CALLS = /\b(?:os\s*\.\s*(WriteFile|Create|OpenFile|Remove|RemoveAll|Rename|Mkdir|MkdirAll|Symlink|Chmod|Chown|Truncate|Link)|ioutil\s*\.\s*(WriteFile))\s*\(/g;
const GO_PLUGIN = /\bplugin\s*\.\s*Open\s*\(/g;

function scanGo(source: string): VetHit[] {
  const { noComments, code } = analyzeJs(source);
  const hits = new HitCollector();
  for (const m of matches(GO_IMPORT, noComments)) {
    const pkg = m[1];
    if (pkg === 'os/exec') hits.push({ rule: 'code/child-process', index: m.index, detail: pkg });
    else if (/^(?:net|net\/(?:http|rpc|smtp|textproto|mail)|crypto\/tls|golang\.org\/x\/net(?:\/.*)?)$/.test(pkg)) hits.push({ rule: 'code/network', index: m.index, detail: safeDetail(pkg) });
  }
  for (const m of matches(GO_PROCESS_CALLS, code)) hits.push({ rule: 'code/child-process', index: m.index, detail: 'exec' });
  for (const m of matches(GO_NETWORK_CALLS, code)) hits.push({ rule: 'code/network', index: m.index, detail: 'net' });
  for (const m of matches(GO_ENV, noComments)) {
    if (code.charCodeAt(m.index) !== noComments.charCodeAt(m.index)) continue;
    const name = m[2];
    if (m[1] === 'Environ' || name === undefined) hits.push({ rule: 'code/env-broad', index: m.index, detail: 'os.Environ' });
    else hits.push({ rule: CREDENTIAL_NAME.test(name) ? 'code/env-credential' : 'code/env-read', index: m.index, detail: safeDetail(name) });
  }
  for (const m of matches(CREDENTIAL_PATH, noComments)) hits.push({ rule: 'code/credential-path', index: m.index });
  for (const m of matches(GO_WRITE_CALLS, code)) {
    const name = m[1] ?? m[2];
    const targets = writtenArguments(name, callArguments(noComments, code, m.index + m[0].length - 1));
    hits.push({ rule: targets.some(isOutsidePath) ? 'code/fs-write-outside' : 'code/fs-write', index: m.index, detail: safeDetail(name) });
  }
  for (const m of matches(GO_PLUGIN, code)) hits.push({ rule: 'code/dynamic-require', index: m.index, detail: 'plugin.Open' });
  return hits.finish();
}

/** Scan decoded source text for risky APIs. Reads text only; the source is never run. */
export function scanCode(language: CodeLanguage, source: string): VetHit[] {
  switch (language) {
    case 'js':
      return scanJavaScript(source);
    case 'py':
      return scanPython(source);
    case 'sh':
      return scanShell(source);
    case 'go':
      return scanGo(source);
  }
}

/** Identifiers that make an inline guard expression able to leave the vm sandbox. */
const SANDBOX_ESCAPE = /\b(?:constructor|__proto__|__defineGetter__|__lookupGetter__|prototype|getPrototypeOf|setPrototypeOf)\b|(?<![.\w$])(?:process|require|import|globalThis|global|window|self|Function|eval|Reflect|Proxy|WebAssembly|this|arguments)\b|\[[^\]]*['"`][^\]]*\+|\[[^\]]*\+[^\]]*['"`][^\]]*\]/g;

/**
 * Check one inline `guard:` expression. The vm sandbox passes host-realm objects such as `Object`
 * and `Boolean` into the expression, and `Object.constructor('return process')()` reaches the host,
 * so the identifiers a breakout needs are the signal. Returns the offset of the first one.
 */
export function findSandboxEscape(expression: string): { index: number; detail?: string } | undefined {
  const { code } = analyzeJs(expression);
  SANDBOX_ESCAPE.lastIndex = 0;
  const m = SANDBOX_ESCAPE.exec(code);
  if (!m) return undefined;
  return { index: m.index, detail: safeDetail(m[0]) };
}

/** Relative module specifiers a JavaScript file loads, so a guard's helper files can be followed. */
export function relativeModuleSpecifiers(source: string, limit = 200): string[] {
  const { noComments, code } = analyzeJs(source);
  const specifiers = new Set<string>();
  for (const m of matches(MODULE_SPECIFIER, code)) {
    if (specifiers.size >= limit) break;
    const start = m.index + m[0].length;
    const quote = noComments[start];
    const end = noComments.indexOf(quote, start + 1);
    if (end === -1 || end - start > 200) continue;
    const specifier = noComments.slice(start + 1, end);
    if (specifier.startsWith('./') || specifier.startsWith('../')) specifiers.add(specifier);
  }
  return [...specifiers];
}

/**
 * True when text compiles as a JavaScript expression, which is when the runtime would run a
 * judgment criterion instead of reading it as prose. Compiles only; the script is never run.
 */
export function compilesAsExpression(text: string): boolean {
  try {
    new vm.Script(`"use strict"; (${text});`);
    return true;
  } catch {
    return false;
  }
}
