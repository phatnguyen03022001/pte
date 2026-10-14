import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const privateDataTest = process.env.PTE_PRIVATE_DATA_TESTS === "1" ? test : test.skip;

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
async function source(path) { return transpile(await readFile(new URL(path, import.meta.url), "utf8")); }
async function moduleFrom(code) { return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
async function loadTs(path, replacements = []) {
  let code = await source(path);
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  return moduleFrom(code);
}

const fsrsPackage = import.meta.resolve("ts-fsrs");
const questionTypesCode = await source("../src/lib/study/question-types.ts");
const questionTypesUrl = `data:text/javascript;base64,${Buffer.from(questionTypesCode).toString("base64")}`;
const identityCode = (await source("../src/lib/study/item-identity.ts")).replace('from "@/lib/study/question-types"', `from "${questionTypesUrl}"`);
const identityUrl = `data:text/javascript;base64,${Buffer.from(identityCode).toString("base64")}`;
const reviewTypesUrl = `data:text/javascript;base64,${Buffer.from(await source("../src/lib/review/types.ts")).toString("base64")}`;
const playbackCode = await source("../src/lib/audio/playback.ts");
const playbackUrl = `data:text/javascript;base64,${Buffer.from(playbackCode.replace('from "@/lib/audio/types"', `from "${await moduleUrl("../src/lib/audio/types.ts")}"`)).toString("base64")}`;
async function moduleUrl(path) { return `data:text/javascript;base64,${Buffer.from(await source(path)).toString("base64")}`; }
const fsrs = await loadTs("../src/lib/review/fsrs.ts", [
  ['from "ts-fsrs"', `from "${fsrsPackage}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
]);
const fsrsCode = (await source("../src/lib/review/fsrs.ts"))
  .replace('from "ts-fsrs"', `from "${fsrsPackage}"`)
  .replace('from "@/lib/review/types"', `from "${reviewTypesUrl}"`);
const fsrsUrl = `data:text/javascript;base64,${Buffer.from(fsrsCode).toString("base64")}`;
const modes = await loadTs("../src/lib/study/modes.ts");
const adapters = await loadTs("../src/lib/study/adapters.ts", [
  ['from "@/lib/audio/playback"', `from "${playbackUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const adaptersCode = (await source("../src/lib/study/adapters.ts"))
  .replace('from "@/lib/audio/playback"', `from "${playbackUrl}"`)
  .replace('from "@/lib/study/item-identity"', `from "${identityUrl}"`);
const adaptersUrl = `data:text/javascript;base64,${Buffer.from(adaptersCode).toString("base64")}`;
const availability = await loadTs("../src/lib/study/mode-availability.ts");
const comparison = await loadTs("../src/lib/study/answer-comparison.ts");
const runner = await loadTs("../src/lib/study/runner-core.ts", [
  ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
  ['from "@/lib/study/adapters"', `from "${adaptersUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ['from "@/lib/study/modes"', `from "${await moduleUrl("../src/lib/study/modes.ts")}"`],
]);
const engineCode = (await source("../src/lib/datasets/engine.ts"))
  .replace('import "server-only";', "")
  .replaceAll('from "@/lib/study/question-types"', `from "${questionTypesUrl}"`)
  .replaceAll('from "@/lib/study/item-identity"', `from "${identityUrl}"`);
const datasetEngine = await moduleFrom(engineCode);

const realQuestionTypes = ["01-ra", "02-rs", "03-di", "04-rl", "06-sgd", "07-rts", "08-swt", "09-we", "10-fib-r-dropdown", "12-rop", "13-fib-r-drag-and-drop", "15-sst", "17-fib-l", "21-hiw", "22-wfd"];
const fixedNow = new Date("2026-10-14T04:00:00.000Z");

function createHarness({ authenticated = true, datasets, states = new Map(), loadError = false, saveStatus = "saved" } = {}) {
  const calls = { loaded: [], saved: [] };
  const service = runner.createStudyRunnerService({
    async authenticate() { if (!authenticated) throw new Error("not authenticated"); return "verified-user-only"; },
    async resolve(typeKey, datasetId) {
      const selection = datasets?.get(`${typeKey}:${datasetId}`);
      if (!selection) return { dataset: { id: "", label: "Dataset not found", status: "not-found", count: 0 }, items: [] };
      return selection;
    },
    async loadStates(keys) {
      calls.loaded.push([...keys]);
      if (loadError) throw new Error("database unavailable");
      return keys.flatMap((key) => states.has(key) ? [states.get(key)] : []);
    },
    async save(itemKey, card, expectedUpdatedAt, now) {
      calls.saved.push({ itemKey, card, expectedUpdatedAt, now });
      if (saveStatus !== "saved") return { status: saveStatus };
      states.set(itemKey, { itemKey, card, dueAt: card.due, updatedAt: now.toISOString() });
      return { status: "saved" };
    },
    now: () => fixedNow,
  });
  return { service, calls, states };
}

const allFixture = {
  dataset: { id: "all", label: "All Questions", status: "available", count: 3 },
  items: [
    { id: 1, text: "First sentence." },
    { id: 2, text: "Second sentence." },
    { id: 3, text: "Third sentence.", answer: "A reference." },
  ],
};

test("flashcard adapter supplies front and back and review requires reveal", () => {
  const card = adapters.adaptQuestionItem("01-ra", { id: 1, text: "A prompt.", answer: "A reference." });
  assert.deepEqual(card.front, ["A prompt."]);
  assert.deepEqual(card.reference, ["A reference."]);
  assert.equal(card.referenceAvailable, true);
  assert.equal(runner.shouldAllowRating(false, false), false);
  assert.equal(runner.shouldAllowRating(true, true), false);
  assert.equal(runner.shouldAllowRating(true, false), true);
});

test("study ratings preserve the four FSRS labels and reject unrelated score values", async () => {
  const { Rating } = await import(fsrsPackage);
  assert.equal(fsrs.getFsrsRatingValue("Again"), Rating.Again);
  assert.equal(fsrs.getFsrsRatingValue("Hard"), Rating.Hard);
  assert.equal(fsrs.getFsrsRatingValue("Good"), Rating.Good);
  assert.equal(fsrs.getFsrsRatingValue("Easy"), Rating.Easy);
  assert.throws(() => fsrs.parseRating(90), TypeError);
});

privateDataTest("Vocabulary adapter maps word, Vietnamese meanings, IPA, parts of speech, tiers, and canonical identity", async () => {
  const file = JSON.parse(await readFile(new URL("../data/vocabulary/items.json", import.meta.url), "utf8"));
  const entry = file.entries.find((candidate) => candidate.meanings_vi?.length && candidate.ipa);
  const card = adapters.adaptVocabularyItem(entry);
  assert.deepEqual(card.front, [entry.word]);
  assert.equal(card.vocabulary.meaning, entry.meanings_vi.join("; "));
  assert.equal(card.vocabulary.ipa, entry.ipa);
  assert.deepEqual(card.vocabulary.partsOfSpeech, entry.parts_of_speech);
  assert.equal(card.vocabulary.tier, entry.tier);
  assert.equal(card.identity, `apeuni:vocabulary:${entry.key}`);
  assert.equal(card.referenceAvailable, true);
});

privateDataTest("every current Vocabulary tier and list selection resolves without changing item identity", async () => {
  const options = await datasetEngine.listVocabularyDatasets();
  assert.ok(options.some(({ id }) => id === "all"));
  assert.ok(options.some(({ kind }) => kind === "tier"));
  assert.ok(options.some(({ kind }) => kind === "list"));
  const all = await datasetEngine.resolveVocabularyDataset("all");
  const identities = new Set(all.items.map((entry) => adapters.adaptVocabularyItem(entry).identity));
  for (const option of options.filter(({ status }) => status === "available" || status === "empty")) {
    const result = await datasetEngine.resolveVocabularyDataset(option.id);
    assert.equal(result.dataset.id, option.id);
    assert.equal(result.items.length, option.count);
    for (const entry of result.items) assert.ok(identities.has(adapters.adaptVocabularyItem(entry).identity));
  }
});

privateDataTest("real Question Bank schemas produce concise adapters without stringifying records", async () => {
  for (const typeKey of realQuestionTypes) {
    const directory = (await import("node:fs/promises")).readdir;
    const files = await directory(new URL(`../data/`, import.meta.url));
    const number = typeKey.slice(0, 2);
    const folder = files.find((name) => name.startsWith(`${number}-`));
    assert.ok(folder, `missing fixture for ${typeKey}`);
    const bank = JSON.parse(await readFile(new URL(`../data/${folder}/items.json`, import.meta.url), "utf8"));
    const item = adapters.adaptQuestionItem(typeKey, bank[0]);
    assert.equal(item.identity, `apeuni:question:${typeKey}:${bank[0].id}`);
    assert.ok(item.front.every((line) => typeof line === "string"));
    assert.ok(item.reference.every((line) => typeof line === "string"));
    assert.equal(item.front.some((line) => line === JSON.stringify(bank[0])), false);
  }
});

test("items with no reference answer use self-review and do not fabricate media URLs", () => {
  const item = adapters.adaptQuestionItem("09-we", { id: 9, title: "Essay", prompt: "Discuss this topic.", answer: null, audio: "private/local.mp3" });
  assert.equal(item.referenceAvailable, false);
  assert.deepEqual(item.reference, []);
  assert.equal(item.audioExpected, true);
  assert.equal(item.audioUrl, null);
});

test("only caller-resolved HTTPS media is passed through; private paths and insecure URLs are rejected", () => {
  const record = { id: 4, title: "Image prompt", image: "images/private.png", audio: "audio/private.mp3" };
  const resolved = adapters.adaptQuestionItem("03-di", record, {
    imageUrl: "https://cdn.example.test/verified/image.png",
    audioUrl: "http://cdn.example.test/insecure/audio.mp3",
  });
  assert.equal(resolved.imageUrl, "https://cdn.example.test/verified/image.png");
  assert.equal(resolved.audioUrl, null);
  assert.equal(resolved.imageExpected, true);
  assert.equal(resolved.front.includes("images/private.png"), false);
});

test("WFD transcript remains on the reference side of the flashcard", () => {
  const card = adapters.adaptQuestionItem("22-wfd", { id: 22, text: "A transcript answer." });
  assert.deepEqual(card.front, ["Listen to the original sentence, then write what you hear."]);
  assert.deepEqual(card.reference, ["A transcript answer."]);
});

test("Reorder Paragraph adapter preserves source order and applies the one-based answer order", () => {
  const item = adapters.adaptQuestionItem("12-rop", {
    id: 14,
    title: "Arrange the paragraphs.",
    paragraphs: ["First source paragraph.", "Second source paragraph.", "Third source paragraph."],
    answer_order: [3, 1, 2],
  });
  assert.deepEqual(item.front.slice(1), ["1. First source paragraph.", "2. Second source paragraph.", "3. Third source paragraph."]);
  assert.deepEqual(item.reference, ["Third source paragraph.", "First source paragraph.", "Second source paragraph."]);
});

test("answer comparison reports case/punctuation-normalized matches, missing, extra, and mismatched words", () => {
  const exact = comparison.compareAnswers("The QUICK, fox.", "the quick fox");
  assert.deepEqual(exact, { missing: [], extra: [], mismatched: [], matches: 3 });
  const changed = comparison.compareAnswers("The brown fox jumps today", "The quick fox jumps");
  assert.deepEqual(changed.mismatched, [{ expected: "quick", actual: "brown" }]);
  assert.deepEqual(changed.extra, ["today"]);
  assert.deepEqual(changed.missing, []);
});

test("study modes are appropriate to each supported question type", () => {
  assert.deepEqual(modes.getStudyModes("vocabulary"), ["flashcards"]);
  for (const key of ["01-ra", "03-di"]) assert.ok(modes.getStudyModes(key).includes("listen-repeat"));
  for (const key of ["15-sst", "17-fib-l", "21-hiw", "22-wfd"]) assert.ok(modes.getStudyModes(key).includes("listen-write"));
  for (const key of ["08-swt", "09-we", "10-fib-r-dropdown", "12-rop", "13-fib-r-drag-and-drop"]) {
    assert.deepEqual(modes.getStudyModes(key), ["flashcards"]);
  }
});

test("missing audio disables audio-dependent modes; DI also requires its resolved image", () => {
  const item = adapters.adaptQuestionItem("02-rs", { id: 1, text: "Repeat this." });
  assert.equal(availability.canPracticeMode("listen-write", "02-rs", item), false);
  assert.equal(availability.canPracticeMode("listen-repeat", "02-rs", item), false);
  assert.equal(availability.canPracticeMode("listen-repeat", "01-ra", { ...item, identity: "apeuni:question:01-ra:1" }), true);
  assert.equal(availability.canPracticeMode("listen-repeat", "03-di", { ...item, identity: "apeuni:question:03-di:1", imageExpected: true, imageUrl: null }), false);
  assert.equal(availability.canPracticeMode("listen-repeat", "03-di", { ...item, identity: "apeuni:question:03-di:1", imageExpected: true, imageUrl: "https://media.example.test/verified.png" }), true);
});

test("microphone recording is keyed to the active canonical item and resets between items", async () => {
  const component = await readFile(new URL("../src/components/study/speaking-practice.tsx", import.meta.url), "utf8");
  assert.match(component, /<AudioRecorder key=\{item\.identity\}/);
});

test("server service chooses new and due cards in canonical dataset order and can revisit all", async () => {
  const dueIdentity = "apeuni:question:02-rs:1";
  const futureIdentity = "apeuni:question:02-rs:2";
  const states = new Map([
    [dueIdentity, { itemKey: dueIdentity, card: fsrs.createReviewCard(new Date(fixedNow.getTime() - 1000)), dueAt: new Date(fixedNow.getTime() - 1000), updatedAt: "2026-10-14T03:59:59.000Z" }],
    [futureIdentity, { itemKey: futureIdentity, card: fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card, dueAt: new Date(fixedNow.getTime() + 60_000), updatedAt: "2026-10-14T04:00:00.000Z" }],
  ]);
  const datasets = new Map([[
    "02-rs:all", { ...allFixture, items: [{ id: 2, text: "Future." }, { id: 1, text: "Due." }, { id: 3, text: "New." }] },
  ]]);
  const harness = createHarness({ datasets, states });
  const scheduled = await harness.service.start("02-rs", "all", "flashcards", "scheduled");
  assert.equal(scheduled.status, "ok");
  assert.deepEqual(scheduled.queue, [dueIdentity, "apeuni:question:02-rs:3"]);
  const all = await harness.service.start("02-rs", "all", "flashcards", "all");
  assert.deepEqual(all.queue, [futureIdentity, dueIdentity, "apeuni:question:02-rs:3"]);
});

test("overlapping dataset selection retains the canonical review identity", async () => {
  const sharedRecord = { id: 2, text: "Shared." };
  const datasets = new Map([
    ["02-rs:all", { dataset: { id: "all", label: "All", status: "available", count: 1 }, items: [sharedRecord] }],
    ["02-rs:collection-x", { dataset: { id: "collection-x", label: "Collection", status: "available", count: 1 }, items: [sharedRecord] }],
  ]);
  const harness = createHarness({ datasets });
  const first = await harness.service.start("02-rs", "all", "flashcards", "all");
  const second = await harness.service.start("02-rs", "collection-x", "flashcards", "all");
  assert.equal(first.queue[0], second.queue[0]);
});

test("unauthenticated sessions and arbitrary dataset/item identities are rejected", async () => {
  const datasets = new Map([["02-rs:all", allFixture]]);
  const unauthenticated = createHarness({ authenticated: false, datasets });
  assert.equal((await unauthenticated.service.start("02-rs", "all", "flashcards", "all")).status, "unauthenticated");
  assert.equal(unauthenticated.calls.loaded.length, 0);
  const authenticated = createHarness({ datasets });
  assert.equal((await authenticated.service.start("02-rs", "../data", "flashcards", "all")).status, "unavailable");
  assert.equal((await authenticated.service.getItem("02-rs", "all", "apeuni:question:02-rs:999", "flashcards")).status, "invalid-request");
  assert.equal((await authenticated.service.submitReview("02-rs", "all", "apeuni:question:02-rs:999", "Good")).status, "invalid-request");
});

test("ratings are recalculated server-side and persistence success is explicit", async () => {
  const datasets = new Map([["02-rs:all", { dataset: { id: "all", label: "All", status: "available", count: 1 }, items: [{ id: 3, text: "New." }] }]]);
  const harness = createHarness({ datasets });
  const result = await harness.service.submitReview("02-rs", "all", "apeuni:question:02-rs:3", "Good");
  assert.equal(result.status, "saved");
  assert.equal(result.rating, "Good");
  assert.equal(harness.calls.saved.length, 1);
  assert.equal(harness.calls.saved[0].expectedUpdatedAt, null);
  assert.ok(harness.calls.saved[0].card.due instanceof Date);
});

test("failed persistence is never reported as success and local sessions are marked unsaved", async () => {
  const datasets = new Map([["02-rs:all", allFixture]]);
  const failedLoad = createHarness({ datasets, loadError: true });
  const session = await failedLoad.service.start("02-rs", "all", "flashcards", "scheduled");
  assert.equal(session.status, "ok");
  assert.equal(session.persistenceAvailable, false);
  assert.equal(session.queue.length, 3);
  const failedSave = createHarness({ datasets, saveStatus: "conflict" });
  const result = await failedSave.service.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Again");
  assert.equal(result.status, "conflict");
  const unavailable = createHarness({ datasets, loadError: true });
  const notSaved = await unavailable.service.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good");
  assert.equal(notSaved.status, "not-saved");
});

test("duplicate submissions are blocked by optimistic concurrency conflicts", async () => {
  const identity = "apeuni:question:02-rs:1";
  const datasets = new Map([["02-rs:all", { dataset: { id: "all", label: "All", status: "available", count: 1 }, items: [{ id: 1, text: "Prompt" }] }]]);
  const saved = new Set();
  const service = runner.createStudyRunnerService({
    authenticate: async () => "authenticated",
    resolve: async (typeKey, datasetId) => datasets.get(`${typeKey}:${datasetId}`),
    loadStates: async () => [],
    async save(itemKey) {
      if (saved.has(itemKey)) return { status: "conflict" };
      saved.add(itemKey);
      return { status: "saved" };
    },
    now: () => fixedNow,
  });
  const outcomes = await Promise.all([
    service.submitReview("02-rs", "all", identity, "Good"),
    service.submitReview("02-rs", "all", identity, "Good"),
  ]);
  assert.deepEqual(outcomes.map(({ status }) => status).sort(), ["conflict", "saved"]);
});

test("unavailable datasets return a controlled state and media/study code has no upload, STT, or scoring", async () => {
  const unavailable = createHarness({ datasets: new Map() });
  assert.equal((await unavailable.service.start("02-rs", "all", "flashcards", "all")).status, "unavailable");
  const files = ["../src/lib/study/runner-core.ts", "../src/components/study/dictation.tsx", "../src/components/study/speaking-practice.tsx"];
  const contents = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  assert.doesNotMatch(contents.join("\n"), /speech.?to.?text|transcri(?:be|ption).*microphone|upload.*audio|pearson score|percentage out of 90/i);
});
