/**
 * Label each workspace root with its shortest path suffix that no other listed root shares: the plain folder
 * name when it is unique, otherwise enough parent folders to tell same-named folders apart.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (client; recomputed only when the catalog changes)
 * - Complexity: O(w^2 * d) for w distinct roots of depth d
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=12
 */
export function workspaceLabels(roots) {
  const parts = new Map();
  for (const root of roots) {
    if (root && !parts.has(root)) parts.set(root, root.replace(/[\\/]+$/, '').split(/[\\/]/));
  }

  const labels = new Map();
  for (const [root, segments] of parts) {
    let label = root;
    for (let depth = 1; depth < segments.length; depth += 1) {
      const suffix = segments.slice(-depth).join('/');
      const shared = [...parts].some(([other, otherSegments]) => other !== root && otherSegments.slice(-depth).join('/') === suffix);
      if (!shared) {
        label = suffix;
        break;
      }
    }
    labels.set(root, label);
  }
  return labels;
}
