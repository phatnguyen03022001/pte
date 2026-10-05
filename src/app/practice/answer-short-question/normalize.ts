const BASIC_EDGE_PUNCTUATION =
  /^[\s.,!?;:'"“”‘’()\[\]\{\}]+|[\s.,!?;:'"“”‘’()\[\]\{\}]+$/gu;

export function normalizeAnswerShortQuestion(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(BASIC_EDGE_PUNCTUATION, "")
    .replace(/\s+/gu, " ");
}
