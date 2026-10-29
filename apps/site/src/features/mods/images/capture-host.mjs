// Minimal host SDK surface for executing the actual bq-vitals hooks offline.
// No skill discovery, personal session reads or Claude Code UI are involved.

/** # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export function atom(_key, value) { return { value }; }

/** # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export async function read(_host, ref) { return ref.value; }

/** # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(1), excluding updater
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export async function update(_host, ref, updater) { ref.value = updater(ref.value); }

/** # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(c) child nodes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export function hostElement(type, props, ...children) { return { type, props, children: children.flat(Infinity) }; }

/** Preserve Text boundaries and literal glyphs emitted by the real pane.
 * # Performance & Risk Budget
 * - Tier: P3 (offline, <2000ms target)
 * - Complexity: O(n) bounded pane nodes
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export function paneText(node) {
  if (typeof node !== 'object' || node === null) return String(node ?? '');
  return node.children.map(paneText).join(node.type === 'Text' ? '' : '\n');
}
