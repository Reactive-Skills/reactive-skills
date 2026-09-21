export type ProseQualityResult = {
  ok: boolean;
  issues: string[];
};

const fillerPhrases = [
  'in today\'s fast-paced',
  'in order to',
  'at the end of the day',
  'leveraging',
  'robust opportunity',
  'best-in-class',
  'highly scalable',
  'it is worth noting',
  'in a way that',
  'best of both worlds',
  'game-changer',
  'game changer',
  'paradigm shift',
  'seamlessly',
  'delve into',
  'tapestry of',
  'testament to',
  'beacon of',
  'supercharge',
  'unlock the power',
  'harness the power',
  'it goes without saying',
  'needless to say',
  'crucial to remember',
  'at its core',
  'paving the way',
  'revolutionize',
  'revolutionizing',
  'delivers the best of both worlds',
  'in conclusion,',
  'to sum up,',
  'in summary,',
];

const longSentenceThreshold = 80;

export function assessTextQuality(text: string): ProseQualityResult {
  const normalized = text.trim();
  const issues: string[] = [];

  if (!normalized) {
    return { ok: false, issues: ['Text is empty.'] };
  }

  const markdownish = /^\s*(#|[-*+]\s|```|\d+\.\s|\||\[\]|\*\*\*|---)/m.test(normalized);
  if (markdownish) {
    return { ok: true, issues: [] };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 8) {
    return { ok: true, issues: [] };
  }

  const sentenceCount = normalized.split(/[.!?]+/).filter(Boolean).length;
  if (sentenceCount === 0) {
    issues.push('Text should contain clear sentences.');
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > longSentenceThreshold) {
      issues.push('Sentence exceeds the readability threshold and should be split.');
      break;
    }

    const lower = sentence.toLowerCase();
    for (const phrase of fillerPhrases) {
      if (lower.includes(phrase)) {
        issues.push(`Avoid filler phrase: "${phrase}".`);
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
