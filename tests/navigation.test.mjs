import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/study/question-types.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const navigation = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const canonicalKeys = [
  "01-ra", "02-rs", "03-di", "04-rl", "05-asq", "06-sgd", "07-rts", "08-swt", "09-we",
  "10-fib-r-dropdown", "11-mcma-r", "12-rop", "13-fib-r-drag-and-drop", "14-mcsa-r",
  "15-sst", "16-mcma-l", "17-fib-l", "18-hcs", "19-mcsa-l", "20-smw", "21-hiw", "22-wfd",
];
const canonicalCodes = [
  "ra", "rs", "di", "rl", "asq", "sgd", "rts", "swt", "we", "fib-r-d", "mcma-r", "rop",
  "fib-r-dd", "mcsa-r", "sst", "mcma-l", "fib-l", "hcs", "mcsa-l", "smw", "hiw", "wfd",
];
const canonicalLabels = [
  "Read Aloud", "Repeat Sentence", "Describe Image", "Retell Lecture", "Answer Short Question",
  "Summarize Group Discussion", "Respond to a Situation", "Summarize Written Text", "Write Essay",
  "Reading FIB Dropdown", "Reading MC Multiple Answers", "Reorder Paragraph",
  "Reading FIB Drag & Drop", "Reading MC Single Answer", "Summarize Spoken Text",
  "Listening MC Multiple Answers", "Listening FIB Type In", "Highlight Correct Summary",
  "Listening MC Single Answer", "Select Missing Word", "Highlight Incorrect Words",
  "Write From Dictation",
];

test("navigation contains the 22 canonical question types in exam order", () => {
  const { QUESTION_TYPES } = navigation;

  assert.equal(QUESTION_TYPES.length, 22);
  assert.deepEqual(QUESTION_TYPES.map(({ key }) => key), canonicalKeys);
  assert.deepEqual(QUESTION_TYPES.map(({ number }) => number), Array.from({ length: 22 }, (_, index) => index + 1));
  assert.deepEqual(QUESTION_TYPES.map(({ label }) => label), canonicalLabels);
  assert.equal(new Set(QUESTION_TYPES.map(({ key }) => key)).size, 22);
  assert.equal(new Set(QUESTION_TYPES.map(({ code }) => code)).size, 22);
  assert.equal(new Set(QUESTION_TYPES.map(({ href }) => href)).size, 22);
  assert.deepEqual(QUESTION_TYPES.map(({ priority }) => priority), [
    "P2", "P1", "P1", "P1", "P3", "P1", "P1", "P1", "P1",
    "P1", "P3", "P2", "P1", "P3", "P1", "P3", "P2", "P3", "P3", "P3", "P2", "P1",
  ]);
  assert.deepEqual(
    QUESTION_TYPES.map(({ key, code, href }) => [key, code, href]),
    canonicalKeys.map((key, index) => [key, canonicalCodes[index], `/study/${key}`]),
  );
});

test("question types are grouped into the three exam sections", () => {
  const { QUESTION_SECTIONS, QUESTION_TYPES } = navigation;

  assert.deepEqual(QUESTION_SECTIONS.map(({ label }) => label), [
    "Speaking & Writing", "Reading", "Listening",
  ]);
  assert.deepEqual(
    QUESTION_SECTIONS.map(({ key }) => QUESTION_TYPES.filter((item) => item.section === key).length),
    [9, 5, 8],
  );
});

test("Vocabulary is a separate navigation item and unknown question keys do not resolve", () => {
  const { QUESTION_TYPES, VOCABULARY_NAVIGATION, getQuestionTypeByKey } = navigation;

  assert.deepEqual(VOCABULARY_NAVIGATION, { label: "Vocabulary", href: "/vocabulary" });
  assert.equal(QUESTION_TYPES.some(({ href }) => href === VOCABULARY_NAVIGATION.href), false);
  assert.equal(getQuestionTypeByKey("02-rs")?.label, "Repeat Sentence");
  assert.equal(getQuestionTypeByKey("not-a-question-type"), undefined);
});

test("active navigation matching supports exact and nested routes only", () => {
  const { isNavigationItemActive } = navigation;

  assert.equal(isNavigationItemActive("/study/02-rs", "/study/02-rs"), true);
  assert.equal(isNavigationItemActive("/vocabulary/review", "/vocabulary"), true);
  assert.equal(isNavigationItemActive("/study/02-rs", "/study/02"), false);
  assert.equal(isNavigationItemActive("/study", "/study/02-rs"), false);
});
