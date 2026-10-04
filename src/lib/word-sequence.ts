const ASCII_EDGE_PUNCTUATION =
  /^[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]+|[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]+$/g;

export function normalizeWords(value: string): string[] {
  const trimmed = value.toLowerCase().trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\s+/)
    .map((token) => token.replace(ASCII_EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

export function longestCommonSubsequence(
  expected: string[],
  response: string[],
): string[] {
  const lengths = Array.from({ length: expected.length + 1 }, () =>
    Array<number>(response.length + 1).fill(0),
  );

  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    for (
      let responseIndex = 1;
      responseIndex <= response.length;
      responseIndex += 1
    ) {
      if (expected[expectedIndex - 1] === response[responseIndex - 1]) {
        lengths[expectedIndex][responseIndex] =
          lengths[expectedIndex - 1][responseIndex - 1] + 1;
      } else {
        lengths[expectedIndex][responseIndex] = Math.max(
          lengths[expectedIndex - 1][responseIndex],
          lengths[expectedIndex][responseIndex - 1],
        );
      }
    }
  }

  const matched: string[] = [];
  let expectedIndex = expected.length;
  let responseIndex = response.length;

  while (expectedIndex > 0 && responseIndex > 0) {
    if (expected[expectedIndex - 1] === response[responseIndex - 1]) {
      matched.push(expected[expectedIndex - 1]);
      expectedIndex -= 1;
      responseIndex -= 1;
    } else if (
      lengths[expectedIndex - 1][responseIndex] >=
      lengths[expectedIndex][responseIndex - 1]
    ) {
      expectedIndex -= 1;
    } else {
      responseIndex -= 1;
    }
  }

  return matched.reverse();
}
