/** Flesch Reading Ease over plain text. Higher = easier; 60–70 is the target band. */
export function fleschReadingEase(plainText: string): number {
  const sentences = plainText.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const words = plainText.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (sentences.length === 0 || words.length === 0) return 0;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(120, score)) * 10) / 10;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}
