import { CREDENTIAL_PATH_SOURCE } from './code-rules.js';
import { HitCollector, type VetHit } from './source.js';

function* matches(re: RegExp, text: string): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) re.lastIndex++;
    yield m;
  }
}

// ---------------------------------------------------------------------------------------------
// Hidden characters
// ---------------------------------------------------------------------------------------------

/**
 * An explicit code point list, not every Unicode format character: eval transcripts and
 * multilingual text carry legitimate format characters, and a broad rule would drown the real hits.
 */
const HIDDEN_CHARACTERS =
  /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁩ㅤ︀-️﻿ﾠ]|[\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

const codePoint = (value: string): string => `U+${value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

const isVariationSelector = (cp: number): boolean => (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);

function neighbor(text: string, index: number, direction: -1 | 1): number {
  if (direction === 1) return text.codePointAt(index) ?? 0;
  if (index === 0) return 0;
  const low = text.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) return text.codePointAt(index - 2) ?? low;
  return low;
}

/** Zero-width, tag, bidirectional and other invisible characters, with their legitimate uses allowed. */
export function scanHiddenCharacters(text: string): VetHit[] {
  const hits = new HitCollector();
  for (const m of matches(HIDDEN_CHARACTERS, text)) {
    const ch = m[0];
    const cp = ch.codePointAt(0)!;
    const index = m.index;
    const detail = codePoint(ch);

    if (cp === 0xfeff) {
      if (index !== 0) hits.push({ rule: 'hidden/zero-width', index, detail });
    } else if (cp === 0x200c || cp === 0x200d) {
      // Joiners are legitimate between non-ASCII characters: emoji sequences and Persian or Indic text.
      const before = neighbor(text, index, -1);
      const after = neighbor(text, index + 1, 1);
      if (before <= 0x7f || after <= 0x7f) hits.push({ rule: 'hidden/zero-width', index, detail });
    } else if (isVariationSelector(cp)) {
      const before = neighbor(text, index, -1);
      const after = neighbor(text, index + ch.length, 1);
      const inRun = isVariationSelector(before) || isVariationSelector(after);
      const presentation = cp === 0xfe0e || cp === 0xfe0f;
      if (inRun || (!presentation && before < 0x2e80)) hits.push({ rule: 'hidden/zero-width', index, detail });
    } else if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) {
      hits.push({ rule: 'hidden/bidi-control', index, detail });
    } else if (cp === 0x00ad || cp === 0x034f || cp === 0x061c || cp === 0x17b4 || cp === 0x17b5 || cp === 0x200e || cp === 0x200f) {
      hits.push({ rule: 'hidden/invisible-format', index, detail });
    } else {
      hits.push({ rule: 'hidden/zero-width', index, detail });
    }
  }
  return hits.finish();
}

/** A long run of spaces followed by text pushes that text off screen. */
const SPACE_RUN = /[ \t]{160,}/g;
export function scanWhitespaceRuns(text: string): VetHit[] {
  const hits = new HitCollector();
  for (const m of matches(SPACE_RUN, text)) {
    const next = text[m.index + m[0].length];
    if (next !== undefined && next !== '\n' && next !== '\r') hits.push({ rule: 'hidden/whitespace-run', index: m.index });
  }
  return hits.finish();
}

const LONG_LINE_LIMIT = 4000;
export function scanLongLines(text: string): VetHit[] {
  const hits = new HitCollector();
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    if (end - start > LONG_LINE_LIMIT) hits.push({ rule: 'hidden/long-line', index: start });
    start = end + 1;
  }
  return hits.finish();
}

// ---------------------------------------------------------------------------------------------
// Prompt injection and download-and-execute patterns
// ---------------------------------------------------------------------------------------------

interface InstructionPattern {
  rule: string;
  re: RegExp;
  /** True when a nearby "never", "do not" or "detect" means the text warns against the behavior. */
  negatable: boolean;
}

const NEGATION_BEFORE =
  /\b(?:never|not|no|don'?t|doesn'?t|do not|must not|should not|shall not|cannot|can'?t|won'?t|avoid|avoids|avoiding|without|refuse|refuses|prevent|prevents|detect|detects|detecting|flag|flags|flagging|block|blocks|blocking|audit|audits|auditing|scan(?:s|ning)? for|look(?:s|ing)? for|check(?:s|ing)? for|warn(?:s|ing)? (?:about|on|of)|identify|identifies|catch|catches|stop|stops|forbid|forbids|prohibit|prohibits|reject|rejects|rather than|instead of)\b[^.\n]*$/i;

const INSTRUCTION_PATTERNS: InstructionPattern[] = [
  {
    rule: 'prompt/instruction-override',
    negatable: true,
    re: /\b(?:ignore|disregard|forget|override)\s+(?:(?:all|any|every|the|your|these|those|of)\s+){0,3}(?:previous|prior|above|earlier|preceding|system|developer|original)\s+(?:(?:and|or)\s+\w+\s+)?(?:instructions?|prompts?|rules|guidelines|directives|messages|constraints)\b|\byou\s+are\s+now\b[^.\n]{0,40}\b(?:DAN|jailbroken|unrestricted|unfiltered|developer\s+mode|no\s+longer\s+bound)\b|\b(?:reveal|print|output|show|repeat|leak|disclose)\b[^.\n]{0,20}\b(?:your|the)\s+(?:system|developer|hidden|initial)\s+(?:prompt|instructions?)\b|<\|(?:im_start|im_end|system|assistant|endoftext)\|>|\[\/?INST\]|<<\/?SYS>>|<\s*\/?\s*(?:system|assistant)\s*>/gi,
  },
  {
    rule: 'prompt/hide-from-user',
    negatable: false,
    re: /\b(?:do\s+not|don'?t|never)\s+(?:ever\s+)?(?:tell|inform|mention|reveal|disclose|notify|alert|show)\b[^.\n]{0,30}\b(?:the\s+)?(?:user|human|operator|reviewer|owner)\b[^.\n]{0,20}\b(?:about\s+)?(?:this|these|that|it|the\s+(?:above|following|instructions?|commands?|actions?|download|upload|changes?))\b|\bwithout\s+(?:telling|informing|notifying|alerting)\s+(?:the\s+)?(?:user|human|operator|reviewer)\b|\b(?:hide|conceal|obscure)\b[^.\n]{0,40}\bfrom\s+(?:the\s+)?(?:user|human|operator|reviewer)\b|\b(?:secretly|covertly)\s+(?:run|send|upload|post|read|copy|execute|install|download|modify|delete|forward)\b/gi,
  },
  {
    rule: 'prompt/exfiltrate',
    negatable: true,
    re: /\b(?:send|post|upload|transmit|email|mail|forward|leak|exfiltrate|submit|copy|push|pipe|attach|include)\b[^.\n]{0,80}?\b(?:secrets?|tokens?|credentials?|passwords?|api[ _-]?keys?|private\s+keys?|ssh\s+keys?|environment\s+variables?|env(?:ironment)?\s+vars?|\.env\b|cookies?|source\s+code|conversation|chat\s+history|system\s+prompt|context\s+window|file\s+contents?)\b[^.\n]{0,100}?\b(?:to|at|via|into|using)\b[^.\n]{0,40}?(?:https?:\/\/|\bwebhook\b|\bremote\s+(?:server|host|endpoint)\b|\bexternal\s+(?:server|url|endpoint|site|host|service)\b|\battacker\b|[\w.+-]+@[\w-]+\.[\w.]+)|\bexfiltrat(?:e|ing)\b[^.\n]{0,60}\b(?:to|via|into)\b|\bcurl\b[^\n]{0,120}\s(?:-d|--data(?:-binary)?|-F|--form|-T|--upload-file)\s+@?\S*(?:\.ssh|\.env|id_rsa|credentials|\.aws|\/etc\/passwd|\/etc\/shadow)/gi,
  },
  {
    rule: 'prompt/credential-access',
    negatable: true,
    re: new RegExp(
      String.raw`\b(?:read|cat|print|show|display|dump|send|upload|copy|include|attach|open|type|echo|list|collect|gather|harvest|steal|extract|fetch|grab|exfiltrate|output)\b[^.\n]{0,60}?(?:${CREDENTIAL_PATH_SOURCE.replace(/^\(\?:\^\|/, '(?:')})`,
      'gi'
    ),
  },
  {
    rule: 'prompt/disable-safety',
    negatable: true,
    re: /\b(?:disable|deactivate|turn\s+off|switch\s+off|bypass|circumvent|evade|neutrali[sz]e)\s+(?:\w+\s+){0,2}?(?:safety|security|sandbox(?:ing)?|guardrails?|safeguards?|content\s+filters?|moderation|permission\s+(?:checks?|prompts?)|(?:safety|security|validation)\s+checks?|antivirus|firewall|certificate\s+(?:checks?|verification|validation)|TLS\s+verification|SSL\s+verification)\b|--dangerously-(?:skip-permissions|bypass-approvals-and-sandbox)\b|--yolo\b|--no-sandbox\b|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|--disable-web-security\b|\bsslVerify\s*(?:=|\s)\s*false\b/gi,
  },
  {
    rule: 'prompt/bypass-approval',
    negatable: true,
    re: /\b(?:skip|bypass|circumvent|ignore|disable|omit|suppress|auto[- ]?(?:approve|accept|confirm|grant))\s+(?:\w+\s+){0,3}?(?:approvals?|human[- ]in[- ]the[- ]loop|human[_ ]gates?|human\s+review|confirmations?|consent|sign[- ]?off|permission\s+prompts?)\b|\b(?:approve|confirm|answer|respond\s+to|sign\s+off\s+on)\b[^.\n]{0,30}\b(?:yourself|on\s+behalf\s+of\s+the\s+user|for\s+the\s+user)\b|\bwithout\s+(?:asking|waiting\s+for|requesting|seeking|getting)\s+(?:the\s+)?(?:user'?s?\s+|human'?s?\s+)?(?:approval|confirmation|permission|consent|sign[- ]?off|review)\b|\b(?:self[- ]?approve|rubber[- ]?stamp)\b/gi,
  },
  {
    rule: 'prompt/bypass-approval',
    negatable: false,
    re: /\b(?:do\s+not|don'?t|never)\s+(?:wait|ask)\s+for\s+(?:the\s+)?(?:user|human|approval|confirmation|permission)\b/gi,
  },
  {
    rule: 'prompt/dangerous-command',
    negatable: true,
    re: /\bbash\s+-i\s*>&?\s*\/dev\/(?:tcp|udp)\/|\/dev\/(?:tcp|udp)\/[\w.-]+\/\d+|\bnc(?:at)?\b[^\n]{0,40}\s-e\s|\bmkfifo\b[^\n]{0,60}\bnc\b|\bsocat\b[^\n]{0,60}\bexec:|\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:--no-preserve-root\s+)?(?:\/(?:\s|$|\*)|~\/?(?:\s|$|\*)|\$HOME\b|\$\{HOME\}|%USERPROFILE%)|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:|\bdd\s+if=\S+\s+of=\/dev\/(?:sd|nvme|disk)|\bmkfs\.\w+\s+\/dev\/|\bchmod\s+(?:-R\s+)?[0-7]*777\s+\/(?:\s|$)/gi,
  },
];

export interface InstructionOptions {
  /** Skip the negation check, as for text found inside a hidden comment. */
  ignoreNegation?: boolean;
}

/** Instruction patterns run over paragraphs of at most this many characters, which bounds each regex call. */
const CHUNK_LIMIT = 4000;

function* chunks(text: string): Generator<{ start: number; text: string }> {
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_LIMIT);
    if (end < text.length) {
      const blank = text.lastIndexOf('\n\n', end);
      const newline = text.lastIndexOf('\n', end);
      const cut = blank > start ? blank + 1 : newline > start ? newline : end;
      end = cut;
    }
    yield { start, text: text.slice(start, end) };
    start = end > start ? end : start + CHUNK_LIMIT;
  }
}

export interface InstructionScan {
  hits: VetHit[];
  /** True when the time budget ran out before every chunk was scanned. */
  timedOut: boolean;
}

/**
 * Find imperative text that tells an agent to do something a reviewer would refuse. The scan stops
 * once `budgetMs` has passed, so a file built to be slow cannot stall a run; the caller reports it.
 */
export function scanInstructionsWithin(text: string, budgetMs: number, options: InstructionOptions = {}): InstructionScan {
  const deadline = Date.now() + budgetMs;
  const hits = new HitCollector();
  for (const chunk of chunks(text)) {
    if (Date.now() > deadline) return { hits: hits.finish(), timedOut: true };
    for (const { rule, re, negatable } of INSTRUCTION_PATTERNS) {
      for (const m of matches(re, chunk.text)) {
        if (negatable && !options.ignoreNegation) {
          const lineStart = chunk.text.lastIndexOf('\n', m.index) + 1;
          const before = chunk.text.slice(Math.max(lineStart, m.index - 80), m.index);
          if (NEGATION_BEFORE.test(before)) continue;
        }
        hits.push({ rule, index: chunk.start + m.index });
      }
    }
  }
  return { hits: hits.finish(), timedOut: false };
}

/** Scan a short text, such as a comment body or a decoded blob, with no time limit. */
export function scanInstructions(text: string, options: InstructionOptions = {}): VetHit[] {
  return scanInstructionsWithin(text, Number.POSITIVE_INFINITY, options).hits;
}

const DOWNLOADERS = String.raw`(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|fetch)`;
const INTERPRETERS = String.raw`(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|fish|python3?|node|perl|ruby|php|iex|Invoke-Expression|powershell|pwsh)`;
const DOWNLOAD_EXEC_PATTERNS: Array<[RegExp, string]> = [
  [new RegExp(String.raw`\b${DOWNLOADERS}\b[^\n|;]{0,200}\|\s*${INTERPRETERS}\b`, 'gi'), 'pipe to interpreter'],
  [new RegExp(String.raw`\b(?:sh|bash|zsh|source)\s+(?:-c\s+)?(?:["']?\$\(\s*|<\(\s*)${DOWNLOADERS}\b|\beval\s+["']?\$\(\s*${DOWNLOADERS}\b|\.\s+<\(\s*${DOWNLOADERS}\b`, 'gi'), 'run downloaded output'],
  [new RegExp(String.raw`\b(?:iex|Invoke-Expression)\s*[(\s]\s*\(?\s*(?:${DOWNLOADERS}|\(New-Object\s+(?:System\.)?Net\.WebClient\)\.DownloadString)\b|\bDownloadString\s*\([^)\n]{0,200}\)[^\n]{0,60}\b(?:iex|Invoke-Expression)\b`, 'gi'), 'Invoke-Expression download'],
  [new RegExp(String.raw`\b(?:curl|wget)\b[^\n]{0,160}?(?:-o|-O|--output|>)\s*\S+[^\n]{0,80}?(?:&&|;)\s*(?:chmod\s+\+x|(?:sh|bash)\s+\S|\.\/)`, 'gi'), 'download then run'],
  [/\b(?:npx|pnpm\s+dlx|bunx|yarn\s+dlx|uvx|pipx\s+run)\s+(?:-\S+\s+)*(?:https?:|git\+|github:|gist:)\S/gi, 'run package from URL'],
  [/\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\s+(?:-\S+\s+)*(?:https?:|git\+|git:|github:|gist:)\S/gi, 'install from URL'],
  [/\bpip3?\s+install\s+(?:-\S+\s+)*(?:https?:|git\+)\S/gi, 'install from URL'],
  [/\b(?:python3?|node|ruby|perl)\s+-[ce]\s+['"][^'"\n]{0,200}(?:urlopen|urllib|requests\.get|https?:\/\/)/gi, 'inline script that downloads'],
];

/** Download-and-execute steps in setup instructions and scripts. */
export function scanDownloadExec(text: string): VetHit[] {
  const hits = new HitCollector();
  for (const [re, detail] of DOWNLOAD_EXEC_PATTERNS) {
    for (const m of matches(re, text)) hits.push({ rule: 'supply/download-exec', index: m.index, detail });
  }
  return hits.finish();
}

// ---------------------------------------------------------------------------------------------
// Hidden comments
// ---------------------------------------------------------------------------------------------

/** Blank fenced code blocks and inline code, which render visibly, keeping offsets and line breaks. */
export function maskCode(text: string): string {
  const lines = text.split('\n');
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === undefined) {
      if (opener) {
        fence = opener[1][0];
        lines[i] = ' '.repeat(line.length);
      } else {
        lines[i] = line.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
      }
    } else {
      const closer = new RegExp(`^ {0,3}\\${fence}{3,}\\s*$`).test(line);
      lines[i] = ' '.repeat(line.length);
      if (closer) fence = undefined;
    }
  }
  return lines.join('\n');
}

const COMMENT_MARKERS = [
  /^(?:END\s+)?[A-Z0-9_ :.-]{2,64}$/,
  /^(?:prettier-ignore|markdownlint-|vale\s|cspell:|eslint-|toc|tocstop|more|truncate|slide|\/?(?:details|summary))/i,
];

/** Comments that tools and editors put in documents. They carry no instruction and do not count against any limit. */
const isMarkerComment = (body: string): boolean => {
  const trimmed = body.trim();
  return trimmed === '' || COMMENT_MARKERS.some((marker) => marker.test(trimmed));
};

/** Most non-marker comments a file may hold before the rest are reported as not checked. */
const MAX_COMMENTS = 2000;

export interface HiddenComment {
  /** Offset of the comment body. */
  index: number;
  body: string;
}

/**
 * HTML comments and markdown link-reference comments outside code, which rendering hides.
 * Marker comments are left out. `truncated` is true when more than `MAX_COMMENTS` others were found.
 */
export function findHiddenComments(text: string): { comments: HiddenComment[]; truncated: boolean } {
  const masked = maskCode(text);
  const comments: HiddenComment[] = [];
  let truncated = false;
  const add = (comment: HiddenComment): void => {
    if (isMarkerComment(comment.body)) return;
    if (comments.length >= MAX_COMMENTS) truncated = true;
    else comments.push(comment);
  };

  let at = masked.indexOf('<!--');
  while (at !== -1) {
    const close = masked.indexOf('-->', at + 4);
    // An unclosed comment runs to the end of the document.
    const end = close === -1 ? masked.length : close;
    add({ index: at + 4, body: text.slice(at + 4, end) });
    if (close === -1) break;
    at = masked.indexOf('<!--', close + 3);
  }
  const linkReference = /^ {0,3}\[(?:\/\/|comment|#|--)\]:\s*(?:#|<>)\s*(?:\(([^)\n]*)\)|"([^"\n]*)"|'([^'\n]*)')[ \t]*$/gm;
  for (const m of matches(linkReference, masked)) {
    add({ index: m.index, body: m[1] ?? m[2] ?? m[3] ?? '' });
  }
  return { comments, truncated };
}

/** Classify one hidden comment: an instruction, plain prose, or too short to matter. */
export function classifyComment(comment: HiddenComment): 'instruction' | 'prose' | 'marker' {
  const body = comment.body.trim();
  if (isMarkerComment(body)) return 'marker';
  if (scanInstructions(body, { ignoreNegation: true }).length > 0 || scanDownloadExec(body).length > 0) return 'instruction';
  const words = body.match(/[A-Za-z]{2,}/g)?.length ?? 0;
  return words >= 6 ? 'prose' : 'marker';
}

// ---------------------------------------------------------------------------------------------
// Encoded blobs
// ---------------------------------------------------------------------------------------------

const HEX_BLOB = /(?<![0-9A-Fa-f])[0-9A-Fa-f]{160,}(?![0-9A-Fa-f])/g;
const BASE64_BLOB = /[A-Za-z0-9+/]{120,}={0,2}/g;
const MAX_DECODED_BYTES = 64 * 1024;

const EXECUTABLE_MAGIC: Array<(bytes: Buffer) => boolean> = [
  (b) => b.length > 3 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46,
  (b) => b.length > 1 && b[0] === 0x4d && b[1] === 0x5a,
  (b) => b.length > 3 && b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d,
  (b) => b.length > 3 && ((b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa) || (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed) || (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe)),
  (b) => b.length > 1 && b[0] === 0x23 && b[1] === 0x21,
];

function looksLikeText(bytes: Buffer): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;
  for (const byte of bytes) {
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 9 || byte === 10 || byte === 13 || byte >= 0xc2) printable++;
  }
  return printable / bytes.length > 0.9;
}

/** A decoded blob is a payload when it is an executable, a script, or text that holds commands. */
function isPayload(bytes: Buffer): boolean {
  if (EXECUTABLE_MAGIC.some((check) => check(bytes))) return true;
  if (!looksLikeText(bytes)) return false;
  const text = bytes.toString('utf8');
  return (
    scanDownloadExec(text).length > 0 ||
    scanInstructions(text, { ignoreNegation: true }).length > 0 ||
    /\b(?:require|import)\s*\(?\s*['"](?:node:)?(?:child_process|net|http|https|fs|os)['"]|\b(?:eval|exec|execSync|spawn|system|subprocess|Invoke-Expression|powershell|cmd\.exe)\b|\/bin\/(?:ba)?sh\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|process\.env|\.ssh\b/i.test(text)
  );
}

/** Blobs decoded in full per file; the rest are reported without decoding, and the file as not fully checked. */
const MAX_DECODED_BLOBS = 300;
const MAX_DECODED_TOTAL_BYTES = 4 * 1024 * 1024;

/** Long base64 and hex blobs. A blob that decodes to code or a command is reported as a payload. */
export function scanEncodedBlobs(text: string): VetHit[] {
  const hits = new HitCollector();
  let decodedBlobs = 0;
  let decodedBytes = 0;
  const report = (index: number, decode: () => Buffer): void => {
    if (decodedBlobs >= MAX_DECODED_BLOBS || decodedBytes >= MAX_DECODED_TOTAL_BYTES) {
      hits.push({ rule: 'hidden/encoded-blob', index });
      hits.markIncomplete();
      return;
    }
    const bytes = decode();
    decodedBlobs++;
    decodedBytes += bytes.length;
    hits.push({ rule: isPayload(bytes) ? 'hidden/encoded-payload' : 'hidden/encoded-blob', index });
  };

  for (const m of matches(HEX_BLOB, text)) {
    const token = m[0];
    if (!/[a-fA-F]/.test(token) || !/\d/.test(token)) continue;
    const length = Math.min(token.length - (token.length % 2), MAX_DECODED_BYTES * 2);
    report(m.index, () => Buffer.from(token.slice(0, length), 'hex'));
  }
  for (const m of matches(BASE64_BLOB, text)) {
    const token = m[0];
    const before = text.slice(Math.max(0, m.index - 48), m.index);
    // Integrity digests and image data URIs are ordinary, and a pure hex run was handled above.
    if (/sha(?:256|384|512)-$/i.test(before)) continue;
    const dataUri = /data:([\w/+.-]*)(?:;[\w=.-]+)*;base64,$/i.exec(before);
    if (dataUri && /^(?:image|font|audio|video)\//i.test(dataUri[1])) continue;
    if (/^[0-9A-Fa-f]+$/.test(token)) continue;
    if (!/[a-z]/.test(token) || !/[A-Z]/.test(token) || !/\d/.test(token)) continue;
    const slice = token.slice(0, Math.min(token.length, (MAX_DECODED_BYTES / 3) * 4));
    report(m.index, () => Buffer.from(slice.slice(0, slice.length - (slice.length % 4)), 'base64'));
  }
  return hits.finish();
}
