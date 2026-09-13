import { encode } from '@toon-format/toon';

export type FieldDef =
  | { type: 'field'; key: string; as?: string }
  | { type: 'pluck'; key: string; subkey: string; as?: string }
  | { type: 'joinArray'; key: string; subkey: string; as?: string; empty?: string }
  | { type: 'relativeTime'; key: string; as?: string }
  | { type: 'boolYesNo'; key: string; as?: string };

type ExtractedItem = Record<string, string | undefined>;

function extract(item: unknown, schema: FieldDef[]): ExtractedItem {
  const result: ExtractedItem = {};

  for (const def of schema) {
    switch (def.type) {
      case 'field': {
        const value = (item as Record<string, unknown>)[def.key];
        result[def.as ?? def.key] = value !== undefined ? String(value) : undefined;
        break;
      }
      case 'pluck': {
        const nested = (item as Record<string, unknown>)[def.key];
        const value = nested != null ? (nested as Record<string, unknown>)[def.subkey] : undefined;
        result[def.as ?? def.key] = value !== undefined ? String(value) : undefined;
        break;
      }
      case 'joinArray': {
        const arr = (item as Record<string, unknown>)[def.key];
        if (Array.isArray(arr)) {
          if (arr.length === 0) {
            result[def.as ?? def.key] = def.empty ?? '';
          } else {
            const values = arr.map((elem) => {
              if (def.subkey) {
                return (elem as Record<string, unknown>)[def.subkey] ?? '';
              }
              return String(elem);
            });
            result[def.as ?? def.key] = values.join(', ');
          }
        } else {
          result[def.as ?? def.key] = def.empty ?? '';
        }
        break;
      }
      case 'relativeTime': {
        const value = (item as Record<string, unknown>)[def.key];
        result[def.as ?? def.key] = value != null ? formatRelativeTime(String(value)) : undefined;
        break;
      }
      case 'boolYesNo': {
        const value = (item as Record<string, unknown>)[def.key];
        if (typeof value === 'boolean') {
          result[def.as ?? def.key] = value ? 'yes' : 'no';
        } else if (value != null) {
          result[def.as ?? def.key] = String(value);
        } else {
          result[def.as ?? def.key] = undefined;
        }
        break;
      }
    }
  }

  return result;
}

export function renderList(label: string, items: unknown[], schema: FieldDef[]): string {
  if (items.length === 0) return '';
  const extracted = items.map((item) => extract(item, schema));
  const data = { [label]: extracted };
  return encode(data);
}

export function renderDetail(label: string, item: unknown, schema: FieldDef[]): string {
  const extracted = extract(item, schema);
  const data = { [label]: extracted };
  return encode(data);
}

export function renderHelp(lines: string[]): string {
  if (lines.length === 0) return '';
  const formatted = lines.map((line, i) => (i === 0 ? line : `  ${line}`)).join('\n');
  return `help[${lines.length}]:\n${formatted}`;
}

export function renderError(message: string, code: string, suggestions?: string[]): string {
  const parts: string[] = [];
  parts.push(`error: ${message}`);
  parts.push(`code: ${code}`);
  if (suggestions && suggestions.length > 0) {
    parts.push(`help[${suggestions.length}]:`);
    for (const suggestion of suggestions) {
      parts.push(`  ${suggestion}`);
    }
  }
  return parts.join('\n');
}

export function renderOutput(blocks: (string | undefined | null | false)[]): string {
  const filtered = blocks.filter((b): b is string => Boolean(b));
  return filtered.join('\n');
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;

  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear}y ago`;
}

export function truncate(text: string, maxLen: number): string {
  if (maxLen < 20) maxLen = 20;
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  return `${truncated}(truncated, ${text.length} chars total \u2014 use --full to see complete text)`;
}
