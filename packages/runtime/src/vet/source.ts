/** A place where a rule matched, as an offset into the decoded text. */
export interface VetHit {
  rule: string;
  index: number;
  /** A short fixed-vocabulary label for the message, such as a module name or a code point. */
  detail?: string;
}

/** Most distinct hits one scan keeps; past it the scan reports the file as not fully checked. */
export const MAX_HITS = 5000;

/**
 * Collects the hits of one scan. Only hits that are emitted count toward the limit, so allowed
 * characters and ignored markers cannot use it up. When the limit is passed, `finish` adds a
 * `scan/not-scanned` hit instead of dropping the rest silently.
 */
export class HitCollector {
  private readonly hits: VetHit[] = [];
  private readonly seen = new Set<string>();
  private truncated = false;

  push(hit: VetHit): void {
    const key = `${hit.rule}\0${hit.index}\0${hit.detail ?? ''}`;
    if (this.seen.has(key)) return;
    if (this.hits.length >= MAX_HITS) {
      this.truncated = true;
      return;
    }
    this.seen.add(key);
    this.hits.push(hit);
  }

  /** Record that part of the input was not checked, for a reason the caller found. */
  markIncomplete(): void {
    this.truncated = true;
  }

  finish(): VetHit[] {
    if (this.truncated) this.hits.push({ rule: 'scan/not-scanned', index: 0 });
    return this.hits;
  }
}

/** Maps offsets to 1-based line numbers. */
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(text: string) {
    let at = text.indexOf('\n');
    while (at !== -1) {
      this.starts.push(at + 1);
      at = text.indexOf('\n', at + 1);
    }
  }

  lineAt(offset: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }
}

/** Replace every character except line breaks with a space, so offsets and line numbers survive. */
function blank(view: Uint16Array, from: number, to: number): void {
  for (let i = from; i < to; i++) {
    const c = view[i];
    if (c !== 10 && c !== 13) view[i] = 32;
  }
}

function viewToString(view: Uint16Array): string {
  const chunk = 8192;
  let out = '';
  for (let i = 0; i < view.length; i += chunk) {
    out += String.fromCharCode(...view.subarray(i, Math.min(i + chunk, view.length)));
  }
  return out;
}

export interface JsViews {
  /** The source with comments blanked. String contents are kept, so module names stay readable. */
  noComments: string;
  /** `noComments` with the insides of strings and regular expressions blanked too. */
  code: string;
}

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield', 'await', 'instanceof',
]);
const REGEX_PRECEDING_PUNCTUATION = '(,=:[!&|?{};+-*%<>~^';

const isIdentChar = (c: number): boolean =>
  (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c > 127;

/**
 * A heuristic lexer for JavaScript and TypeScript that separates code from comments, strings and
 * regular expression literals without parsing. Line numbers and offsets are preserved.
 * A slash is ambiguous between division and a regular expression, so callers that must not miss
 * code scan both readings (`regexLiterals` true and false) and combine the hits.
 * It can still be fooled by deliberately confusing syntax; a miss is a missed finding, never a
 * reason to run the file.
 */
export function analyzeJs(source: string, regexLiterals = true): JsViews {
  const n = source.length;
  const noComments = new Uint16Array(n);
  for (let i = 0; i < n; i++) noComments[i] = source.charCodeAt(i);
  const code = new Uint16Array(noComments);

  let i = 0;
  let prevSignificant = '';
  let prevWord = '';
  let braceDepth = 0;
  /** Brace depths at which a template literal's `${` was opened. */
  const templateStack: number[] = [];

  if (source.startsWith('#!')) {
    let end = source.indexOf('\n');
    if (end === -1) end = n;
    blank(noComments, 0, end);
    blank(code, 0, end);
    i = end;
  }

  const readTemplate = (from: number): number => {
    // `from` is just after the opening backtick or the closing brace of a `${}`.
    let j = from;
    while (j < n) {
      const c = source[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '`') {
        blank(code, from, j);
        return j + 1;
      }
      if (c === '$' && source[j + 1] === '{') {
        blank(code, from, j);
        templateStack.push(braceDepth);
        braceDepth++;
        return j + 2;
      }
      j++;
    }
    blank(code, from, n);
    return n;
  };

  while (i < n) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = n;
      blank(noComments, i, end);
      blank(code, i, end);
      i = end;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      let end = source.indexOf('*/', i + 2);
      end = end === -1 ? n : end + 2;
      blank(noComments, i, end);
      blank(code, i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== '\n') {
        j += source[j] === '\\' ? 2 : 1;
      }
      blank(code, i + 1, Math.min(j, n));
      i = Math.min(j + 1, n);
      prevSignificant = c;
      prevWord = '';
      continue;
    }
    if (c === '`') {
      i = readTemplate(i + 1);
      prevSignificant = '`';
      prevWord = '';
      continue;
    }
    if (c === '{') {
      braceDepth++;
    } else if (c === '}') {
      braceDepth--;
      if (templateStack.length > 0 && templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop();
        i = readTemplate(i + 1);
        prevSignificant = '`';
        prevWord = '';
        continue;
      }
    }
    if (c === '/' && regexLiterals) {
      const regexAllowed =
        prevSignificant === '' ||
        REGEX_PRECEDING_PUNCTUATION.includes(prevSignificant) ||
        (isIdentChar(prevSignificant.charCodeAt(0)) && REGEX_PRECEDING_KEYWORDS.has(prevWord));
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        while (j < n && source[j] !== '\n') {
          const d = source[j];
          if (d === '\\') {
            j += 2;
            continue;
          }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          j++;
        }
        if (j < n && source[j] === '/') {
          blank(code, i + 1, j);
          i = j + 1;
          prevSignificant = '/';
          prevWord = '';
          continue;
        }
      }
    }

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (isIdentChar(source.charCodeAt(i))) {
      let j = i + 1;
      while (j < n && isIdentChar(source.charCodeAt(j))) j++;
      prevWord = source.slice(i, j);
      prevSignificant = source[j - 1];
      i = j;
      continue;
    }
    prevSignificant = c;
    prevWord = '';
    i++;
  }

  return { noComments: viewToString(noComments), code: viewToString(code) };
}

/** Blank `#` comment lines for Python and shell sources, keeping the shebang. */
export function stripHashComments(source: string): string {
  return source.replace(/^([ \t]*)#(?!!)[^\n]*/gm, (_m, indent: string) => indent);
}

/**
 * Replace characters that could be read as control sequences or instructions when a finding is
 * printed: control characters, format characters, line separators and lone surrogates.
 * Skill-supplied text such as file names must pass through this before it reaches output.
 */
export function sanitizeForOutput(value: string, maxLength = 200): string {
  let out = '';
  let length = 0;
  for (const ch of value) {
    if (length >= maxLength) {
      out += '…';
      break;
    }
    const code = ch.codePointAt(0)!;
    const unsafe =
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}\p{Co}\p{Cn}]/u.test(ch) || (code >= 0xd800 && code <= 0xdfff);
    if (unsafe) {
      out += `\\u{${code.toString(16)}}`;
      length += 6;
    } else {
      out += ch;
      length += 1;
    }
  }
  return out;
}
