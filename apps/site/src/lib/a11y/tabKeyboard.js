// WAI-ARIA tabs pattern: arrows wrap, Home and End jump to the ends.
export function getTabIndexForKey(key, currentIndex, count) {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (currentIndex + 1) % count;
    case 'ArrowLeft':
      return (currentIndex - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
