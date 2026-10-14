import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const typeSource = await readFile(join(projectRoot, "src/lib/study/question-types.ts"), "utf8");
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const questionTypesUrl = `data:text/javascript;base64,${Buffer.from(transpile(typeSource)).toString("base64")}`;
const questionTypes = await import(questionTypesUrl);
const identitySource = await readFile(join(projectRoot, "src/lib/study/item-identity.ts"), "utf8");
const identityJavaScript = transpile(identitySource)
  .replace('from "@/lib/study/question-types"', `from "${questionTypesUrl}"`);
const identityUrl = `data:text/javascript;base64,${Buffer.from(identityJavaScript).toString("base64")}`;
const engineSource = await readFile(join(projectRoot, "src/lib/datasets/engine.ts"), "utf8");
const engineJavaScript = transpile(engineSource)
  .replace('import "server-only";', "")
  .replace('from "@/lib/study/question-types"', `from "${questionTypesUrl}"`)
  .replaceAll('from "@/lib/study/item-identity"', `from "${identityUrl}"`);
const engineUrl = `data:text/javascript;base64,${Buffer.from(engineJavaScript).toString("base64")}`;
const engine = await import(engineUrl);

async function withFixture(run) {
  const fixtureRoot = await mkdtemp(join(projectRoot, ".dataset-fixture-"));
  const dataRoot = join(fixtureRoot, "data");
  await mkdir(dataRoot, { recursive: true });
  try {
    await run({ fixtureRoot, dataRoot });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function writeBank(dataRoot, typeKey, rows) {
  const canonicalType = questionTypes.getQuestionTypeByKey(typeKey);
  assert.ok(canonicalType, `Unknown fixture type: ${typeKey}`);
  const directory = `${String(canonicalType.number).padStart(2, "0")}-${canonicalType.code.toUpperCase()}`;
  const bankPath = join(dataRoot, directory, "items.json");
  await mkdir(join(dataRoot, directory), { recursive: true });
  await writeFile(bankPath, JSON.stringify(rows), "utf8");
  return bankPath;
}

async function writeCollection(dataRoot, filename, collection) {
  const directory = join(dataRoot, "collections");
  await mkdir(directory, { recursive: true });
  const path = join(directory, filename);
  await writeFile(path, JSON.stringify(collection), "utf8");
  return path;
}

function vocabularyEntry(key, tier, lists) {
  return { key, tier, lists, word: `fixture-${key}` };
}

test("All Questions preserves canonical Question Bank order", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 8 }, { id: 2 }, { id: 5 }]);
    const result = await engine.resolveQuestionDataset("02-rs", "all", dataRoot);
    assert.equal(result.dataset.status, "available");
    assert.deepEqual(result.items.map(({ id }) => id), [8, 2, 5]);
  });
});

test("October P preserves Collection membership order", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 1 }, { id: 2 }, { id: 3 }]);
    await writeCollection(dataRoot, "apeuni-2026-10-p.json", { "02-rs": [3, 1] });
    const options = await engine.listQuestionDatasets("02-rs", dataRoot);
    const october = options.find(({ label }) => label === "October P");
    assert.ok(october);
    assert.equal(october.status, "available");
    const result = await engine.resolveQuestionDataset("02-rs", october.id, dataRoot);
    assert.deepEqual(result.items.map(({ id }) => id), [3, 1]);
    assert.equal(engine.chooseDefaultDataset(options), october.id);
  });
});

test("Legacy WFD is offered only when valid matching WFD IDs exist", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "22-wfd", [{ id: 77 }]);
    await writeBank(dataRoot, "02-rs", [{ id: 2 }]);
    await writeCollection(dataRoot, "apeuni-legacy-wfd.json", { "22-wfd": [77] });
    assert.equal((await engine.listQuestionDatasets("22-wfd", dataRoot)).some(({ label }) => label === "Legacy WFD"), true);
    assert.equal((await engine.listQuestionDatasets("02-rs", dataRoot)).some(({ label }) => label === "Legacy WFD"), false);
  });
});

test("Legacy WFD is omitted when its Collection has no matching IDs", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "22-wfd", [{ id: 77 }]);
    await writeCollection(dataRoot, "apeuni-legacy-wfd.json", { "22-wfd": [] });
    assert.equal((await engine.listQuestionDatasets("22-wfd", dataRoot)).some(({ label }) => label === "Legacy WFD"), false);
  });
});

test("Weekly Collections are discovered from fixture files", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 41 }]);
    await writeCollection(dataRoot, "apeuni-2026-W42.json", { "02-rs": [41] });
    const options = await engine.listQuestionDatasets("02-rs", dataRoot);
    const weekly = options.find(({ label }) => label === "Week 42, 2026");
    assert.ok(weekly);
    assert.equal(weekly.kind, "collection");
    assert.deepEqual((await engine.resolveQuestionDataset("02-rs", weekly.id, dataRoot)).items.map(({ id }) => id), [41]);
  });
});

test("Unknown dataset IDs are rejected without treating them as filesystem paths", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 1 }]);
    const result = await engine.resolveQuestionDataset("02-rs", "../../outside.json", dataRoot);
    assert.equal(result.dataset.status, "not-found");
    assert.deepEqual(result.items, []);
  });
});

test("A missing Question Bank reports an unavailable state", async () => {
  await withFixture(async ({ dataRoot }) => {
    const options = await engine.listQuestionDatasets("11-mcma-r", dataRoot);
    assert.equal(options[0].status, "missing");
    assert.equal(options[0].count, 0);
    assert.equal(engine.chooseDefaultDataset(options), undefined);
    const result = await engine.resolveQuestionDataset("11-mcma-r", undefined, dataRoot);
    assert.equal(result.dataset.status, "missing");
  });
});

test("Malformed JSON and duplicate Question Bank IDs are reported as invalid", async () => {
  await withFixture(async ({ dataRoot }) => {
    const path = await writeBank(dataRoot, "02-rs", []);
    await writeFile(path, "{ malformed", "utf8");
    assert.equal((await engine.resolveQuestionDataset("02-rs", "all", dataRoot)).dataset.status, "invalid");
    await writeFile(path, JSON.stringify([{ id: 1 }, { id: 1 }]), "utf8");
    assert.equal((await engine.resolveQuestionDataset("02-rs", "all", dataRoot)).dataset.errorCode, "invalid-question-bank");
  });
});

test("Malformed Collections and duplicate membership IDs are explicitly invalid", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 1 }]);
    const path = await writeCollection(dataRoot, "apeuni-2026-W42.json", { "02-rs": [1] });
    await writeFile(path, "[ malformed", "utf8");
    const malformed = (await engine.listQuestionDatasets("02-rs", dataRoot)).find(({ kind }) => kind === "collection");
    assert.equal(malformed?.status, "invalid");
    await writeFile(path, JSON.stringify({ "02-rs": [1, 1] }), "utf8");
    const duplicate = (await engine.listQuestionDatasets("02-rs", dataRoot)).find(({ kind }) => kind === "collection");
    assert.equal(duplicate?.status, "invalid");
  });
});

test("Unresolved Collection references are reported and never silently removed", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 1 }]);
    await writeCollection(dataRoot, "apeuni-2026-W42.json", { "02-rs": [99, 1] });
    const option = (await engine.listQuestionDatasets("02-rs", dataRoot)).find(({ kind }) => kind === "collection");
    assert.equal(option?.status, "invalid");
    assert.equal(option?.errorCode, "invalid-collection");
    const result = await engine.resolveQuestionDataset("02-rs", option.id, dataRoot);
    assert.deepEqual(result.items, []);
  });
});

test("Path traversal and symlink escapes are rejected", async () => {
  await withFixture(async ({ fixtureRoot, dataRoot }) => {
    await assert.rejects(
      engine.resolveWithinDataRoot(dataRoot, ["..", "outside.json"]),
      (error) => error.code === "invalid-path",
    );

    await writeBank(dataRoot, "02-rs", [{ id: 1 }]);
    const collectionDirectory = join(dataRoot, "collections");
    await mkdir(collectionDirectory, { recursive: true });
    const outside = join(fixtureRoot, "outside.json");
    await writeFile(outside, JSON.stringify({ "02-rs": [1] }), "utf8");
    const symlinkPath = join(collectionDirectory, "apeuni-2026-W42.json");
    await symlink(outside, symlinkPath);
    await assert.rejects(
      engine.resolveWithinDataRoot(dataRoot, ["collections", "apeuni-2026-W42.json"]),
      (error) => error.code === "invalid-path",
    );
    const option = (await engine.listQuestionDatasets("02-rs", dataRoot)).find(({ kind }) => kind === "collection");
    assert.equal(option?.status, "invalid");
  });
});

test("Vocabulary tier and list filters preserve source order and stable identities", async () => {
  await withFixture(async ({ dataRoot }) => {
    const directory = join(dataRoot, "vocabulary");
    await mkdir(directory, { recursive: true });
    const entries = [
      vocabularyEntry("vocab-a", 1, ["basic", "advanced"]),
      vocabularyEntry("vocab-b", 2, ["basic"]),
      vocabularyEntry("vocab-c", 1, ["advanced"]),
    ];
    const path = join(directory, "items.json");
    await writeFile(path, JSON.stringify({ entries }), "utf8");

    const options = await engine.listVocabularyDatasets(dataRoot);
    const tierOne = options.find(({ id }) => id === "tier-1");
    const basic = options.find(({ label }) => label === "Basic");
    assert.ok(tierOne && basic);
    assert.deepEqual((await engine.resolveVocabularyDataset(tierOne.id, dataRoot)).items.map(({ key }) => key), ["vocab-a", "vocab-c"]);
    assert.deepEqual((await engine.resolveVocabularyDataset(basic.id, dataRoot)).items.map(({ key }) => key), ["vocab-a", "vocab-b"]);
    assert.equal(engine.vocabularyIdentity("vocab-a"), "apeuni:vocabulary:vocab-a");
  });
});

test("Question identity is unchanged across All Questions and Collection selections", async () => {
  await withFixture(async ({ dataRoot }) => {
    await writeBank(dataRoot, "02-rs", [{ id: 1 }, { id: 2 }]);
    await writeCollection(dataRoot, "apeuni-2026-10-p.json", { "02-rs": [2, 1] });
    const options = await engine.listQuestionDatasets("02-rs", dataRoot);
    const october = options.find(({ label }) => label === "October P");
    const all = await engine.resolveQuestionDataset("02-rs", "all", dataRoot);
    const selected = await engine.resolveQuestionDataset("02-rs", october.id, dataRoot);
    assert.equal(engine.questionIdentity("02-rs", all.items[1].id), engine.questionIdentity("02-rs", selected.items[0].id));
  });
});

test("Dataset selection does not modify source files", async () => {
  await withFixture(async ({ dataRoot }) => {
    const bankPath = await writeBank(dataRoot, "02-rs", [{ id: 1 }, { id: 2 }]);
    const collectionPath = await writeCollection(dataRoot, "apeuni-2026-10-p.json", { "02-rs": [2] });
    const before = await Promise.all([bankPath, collectionPath].map(async (path) => createHash("sha256").update(await readFile(path)).digest("hex")));
    const options = await engine.listQuestionDatasets("02-rs", dataRoot);
    const october = options.find(({ label }) => label === "October P");
    await engine.resolveQuestionDataset("02-rs", october.id, dataRoot);
    const after = await Promise.all([bankPath, collectionPath].map(async (path) => createHash("sha256").update(await readFile(path)).digest("hex")));
    assert.deepEqual(after, before);
    assert.equal((await lstat(bankPath)).isFile(), true);
  });
});
