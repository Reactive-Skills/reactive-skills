const encoder = new TextEncoder();

export function normalizedByteLength(text) {
  return encoder.encode(text.replace(/\r\n/g, '\n')).length;
}
