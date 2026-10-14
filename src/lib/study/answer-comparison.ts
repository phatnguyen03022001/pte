export type AnswerComparison = {
  missing: string[];
  extra: string[];
  mismatched: Array<{ expected: string; actual: string }>;
  matches: number;
};

function tokenize(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

export function compareAnswers(response: string, reference: string): AnswerComparison {
  if (response.length > 10_000 || reference.length > 10_000) throw new RangeError("Answers are too long to compare.");
  const actual = tokenize(response);
  const expected = tokenize(reference);
  if (actual.length > 500 || expected.length > 500) throw new RangeError("Answers contain too many words to compare.");

  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint16Array(columns));
  const normalize = (word: string) => word.toLocaleLowerCase("en-US");
  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = actual.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = normalize(expected[i]) === normalize(actual[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const missing: string[] = [];
  const extra: string[] = [];
  let matches = 0;
  let i = 0;
  let j = 0;
  let expectedRun: string[] = [];
  let actualRun: string[] = [];
  const mismatched: AnswerComparison["mismatched"] = [];
  const flush = () => {
    const pairs = Math.min(expectedRun.length, actualRun.length);
    for (let index = 0; index < pairs; index += 1) mismatched.push({ expected: expectedRun[index], actual: actualRun[index] });
    missing.push(...expectedRun.slice(pairs));
    extra.push(...actualRun.slice(pairs));
    expectedRun = [];
    actualRun = [];
  };

  while (i < expected.length && j < actual.length) {
    if (normalize(expected[i]) === normalize(actual[j])) {
      flush();
      matches += 1;
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) expectedRun.push(expected[i++]);
    else actualRun.push(actual[j++]);
  }
  expectedRun.push(...expected.slice(i));
  actualRun.push(...actual.slice(j));
  flush();

  return { missing, extra, mismatched, matches };
}
