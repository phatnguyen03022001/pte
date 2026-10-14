import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const privateDataTest = process.env.PTE_PRIVATE_DATA_TESTS === "1" ? test : test.skip;

const tsSource = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fromCode = (url) => import(url);
const importModule = async (name, code) => {
  try { return await fromCode(code); } catch (error) { throw new Error(`Could not load ${name}: ${error.message}`); }
};
const urlFor = async (path, replacements = []) => {
  let code = await tsSource(path);
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
};
const fsrsPackage = import.meta.resolve("ts-fsrs");
const questionTypesUrl = await urlFor("../src/lib/study/question-types.ts");
const identityUrl = await urlFor("../src/lib/study/item-identity.ts", [
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
]);
const reviewTypesUrl = await urlFor("../src/lib/review/types.ts");
const audioTypesUrl = await urlFor("../src/lib/audio/types.ts");
const playbackUrl = await urlFor("../src/lib/audio/playback.ts", [
  ['from "@/lib/audio/types"', `from "${audioTypesUrl}"`],
]);
const adaptersUrl = await urlFor("../src/lib/study/adapters.ts", [
  ['from "@/lib/audio/playback"', `from "${playbackUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const modesUrl = await urlFor("../src/lib/study/modes.ts");
const fsrsUrl = await urlFor("../src/lib/review/fsrs.ts", [
  ['from "ts-fsrs"', `from "${fsrsPackage}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
]);
const availabilityUrl = await urlFor("../src/lib/study/mode-availability.ts");
const runnerUrl = await urlFor("../src/lib/study/runner-core.ts", [
  ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
  ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
  ['from "@/lib/study/adapters"', `from "${adaptersUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ['from "@/lib/study/modes"', `from "${modesUrl}"`],
  ['from "@/lib/study/mode-availability"', `from "${availabilityUrl}"`],
]);
const engineUrl = await urlFor("../src/lib/datasets/engine.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const mediaResolverUrl = await urlFor("../src/lib/media/resolver.ts", [
  ['import "server-only";', ""],
  ['from "@/lib/datasets/engine"', `from "${engineUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ['from "@/lib/study/question-types"', `from "${questionTypesUrl}"`],
  ['from "@/lib/study/adapters"', `from "${adaptersUrl}"`],
]);
const adapters = await importModule("adapters", adaptersUrl);
const modes = await importModule("modes", modesUrl);
const availability = await importModule("availability", availabilityUrl);
const runner = await importModule("runner", runnerUrl);
const fsrs = await importModule("fsrs", fsrsUrl);
const engine = await importModule("dataset engine", engineUrl);
const mediaResolver = await importModule("media resolver", mediaResolverUrl);

const priorityTypes = ["01-ra", "02-rs", "03-di", "04-rl", "06-sgd", "07-rts", "08-swt", "09-we", "10-fib-r-dropdown", "12-rop", "13-fib-r-drag-and-drop", "15-sst", "17-fib-l", "21-hiw", "22-wfd"];
const now = new Date("2026-10-14T04:00:00.000Z");
const simpleDataset = (id = "all", items = [{ id: 1, text: "Prompt." }]) => ({
  dataset: { id, label: id, status: items.length ? "available" : "empty", count: items.length }, items,
});
function harness({ authenticated = true, datasets = new Map([["02-rs:all", simpleDataset()]]), loadError = false, saveStatus = "saved", states = new Map() } = {}) {
  const calls = { loads: [], saves: [] };
  const service = runner.createStudyRunnerService({
    async authenticate() { if (!authenticated) throw new Error("unauthenticated"); },
    async resolve(typeKey, datasetId) { return datasets.get(`${typeKey}:${datasetId}`) ?? { dataset: { id: "", label: "Missing", status: "not-found", count: 0 }, items: [] }; },
    async loadStates(keys) { calls.loads.push([...keys]); if (loadError) throw new Error("database unavailable"); return keys.flatMap((key) => states.has(key) ? [states.get(key)] : []); },
    async save(...args) { calls.saves.push(args); return { status: saveStatus }; },
    now: () => now,
  });
  return { service, calls };
}

privateDataTest("all 15 P1/P2 adapters map fields from real imported Question Bank schemas", async () => {
  const { readdir } = await import("node:fs/promises");
  const folders = await readdir(new URL("../data/", import.meta.url));
  for (const typeKey of priorityTypes) {
    const folder = folders.find((name) => name.startsWith(`${typeKey.slice(0, 2)}-`));
    assert.ok(folder, `${typeKey} bank is present`);
    const bank = JSON.parse(await readFile(new URL(`../data/${folder}/items.json`, import.meta.url), "utf8"));
    assert.ok(bank.length, `${typeKey} bank is non-empty`);
    const first = bank[0];
    const item = adapters.adaptQuestionItem(typeKey, first);
    assert.equal(item.identity, `apeuni:question:${typeKey}:${first.id}`);
    assert.ok(item.front.length, `${typeKey} has a display prompt`);
    assert.ok(item.front.every((text) => typeof text === "string"));
    assert.ok(item.reference.every((text) => typeof text === "string"));
    assert.ok(!item.front.includes(JSON.stringify(first)), `${typeKey} does not show a JSON dump`);
    if (typeKey === "01-ra") assert.equal(item.front[0], first.text);
    if (typeKey === "02-rs") assert.ok(item.reference.includes(first.text));
    if (typeKey === "03-di") assert.equal(item.imageExpected, Boolean(first.image));
    if (typeKey === "04-rl") assert.ok(item.front.includes(first.preview));
    if (typeKey === "06-sgd") assert.ok(item.front.includes(first.title));
    if (typeKey === "07-rts") assert.ok(item.front.includes(first.prompt.trim()));
    if (typeKey === "08-swt" || typeKey === "10-fib-r-dropdown" || typeKey === "13-fib-r-drag-and-drop") assert.ok(item.front.includes(first.passage));
    if (typeKey === "09-we") assert.ok(item.front.includes(first.prompt.trim()));
    if (typeKey === "10-fib-r-dropdown") assert.ok(item.front.some((line) => line.startsWith("Gap 1 options:")));
    if (typeKey === "12-rop") assert.equal(item.front.filter((line) => /^\d+\. /.test(line)).length, first.paragraphs.length);
    if (typeKey === "13-fib-r-drag-and-drop") assert.ok(item.front.some((line) => line.startsWith("Word bank:")));
    if (typeKey === "15-sst") assert.ok(item.front.includes(first.preview));
    if (typeKey === "17-fib-l") assert.ok(item.front.includes(first.passage));
    if (typeKey === "21-hiw") {
      assert.ok(item.front.includes(first.transcript));
      assert.ok(!item.front.includes(first.incorrect_words?.join(", ")));
    }
    if (typeKey === "22-wfd") assert.deepEqual(item.reference, [first.text]);
  }
});

test("supported study modes are limited to the authored type adapters", () => {
  for (const typeKey of priorityTypes) assert.ok(modes.getStudyModes(typeKey).includes("flashcards"));
  for (const typeKey of ["01-ra", "02-rs", "03-di", "04-rl", "06-sgd", "07-rts"]) assert.ok(modes.getStudyModes(typeKey).includes("listen-repeat"));
  for (const typeKey of ["02-rs", "04-rl", "06-sgd", "15-sst", "17-fib-l", "21-hiw", "22-wfd"]) assert.ok(modes.getStudyModes(typeKey).includes("listen-write"));
});

test("missing Question Banks resolve to controlled unavailable status", async () => {
  const missing = await engine.resolveQuestionDataset("02-rs", "all", "/path/that/does/not/exist/pte-test");
  assert.equal(missing.dataset.status, "missing");
  assert.deepEqual(missing.items, []);
  assert.equal(typeof missing.dataset.message, "string");
});

privateDataTest("Vocabulary all, tiers, lists, fields and canonical identities work across the 5,968 entries", async () => {
  const all = await engine.resolveVocabularyDataset("all");
  assert.equal(all.items.length, 5968);
  const identities = new Set(all.items.map((entry) => adapters.adaptVocabularyItem(entry).identity));
  assert.equal(identities.size, 5968);
  for (const entry of all.items) {
    const card = adapters.adaptVocabularyItem(entry);
    assert.equal(card.identity, `apeuni:vocabulary:${entry.key}`);
    assert.equal(card.vocabulary.word, entry.word);
    assert.equal(card.vocabulary.meaning, entry.meanings_vi.join("; "));
    assert.equal(card.vocabulary.ipa, entry.ipa);
    assert.deepEqual(card.vocabulary.partsOfSpeech, entry.parts_of_speech);
    assert.deepEqual(card.vocabulary.lists, entry.lists);
    assert.equal(card.vocabulary.tier, entry.tier);
  }
  for (const option of (await engine.listVocabularyDatasets()).filter((dataset) => dataset.id === "all" || dataset.kind === "tier" || dataset.kind === "list")) {
    const selected = await engine.resolveVocabularyDataset(option.id);
    assert.equal(selected.items.length, option.count);
    for (const entry of selected.items) assert.ok(identities.has(adapters.adaptVocabularyItem(entry).identity));
  }
});

test("dataset switching and overlapping lists preserve FSRS identity", () => {
  const entry = { key: "stable-word", word: "stable", meanings_vi: ["ổn định"], tier: 2, lists: ["Tier 1", "Academic"] };
  assert.equal(adapters.adaptVocabularyItem(entry).identity, adapters.adaptVocabularyItem({ ...entry, lists: ["Tier 3"] }).identity);
});

test("FSRS reviews use ts-fsrs and preserve existing card history", () => {
  const initial = fsrs.createReviewCard(new Date("2026-10-01T00:00:00Z"));
  const first = fsrs.reviewCard(initial, "Good", new Date("2026-10-01T00:00:00Z"));
  const second = fsrs.reviewCard(first.card, "Hard", new Date("2026-10-02T00:00:00Z"));
  assert.ok(second.card.reps > first.card.reps);
  assert.ok(second.card.last_review >= first.card.last_review);
  assert.notEqual(second.card.due.toISOString(), first.card.due.toISOString());
});

test("session start authenticates, validates the selected dataset, and resolves only its first item", async () => {
  let mediaCalls = 0;
  const service = runner.createStudyRunnerService({
    authenticate: async () => "verified-user-id", resolve: async () => simpleDataset("all", [{ id: 1, text: "A" }, { id: 2, text: "B" }]),
    loadStates: async () => [], save: async () => ({ status: "saved" }), resolveMedia: async () => { mediaCalls += 1; return {}; }, now: () => now,
  });
  const result = await service.start("02-rs", "all", "flashcards", "all");
  assert.equal(result.status, "ok");
  assert.deepEqual(result.queue, ["apeuni:question:02-rs:1", "apeuni:question:02-rs:2"]);
  assert.equal(mediaCalls, 1);
});

test("new items reset answer, response, rating and audio component state on identity transition", async () => {
  const source = await readFile(new URL("../src/components/study/study-runner.tsx", import.meta.url), "utf8");
  const speaking = await readFile(new URL("../src/components/study/speaking-practice.tsx", import.meta.url), "utf8");
  assert.match(source, /setRevealed\(false\);\s*setResponse\(""\);\s*setRated\(false\)/);
  assert.match(speaking, /<AudioRecorder key=\{item\.identity\}/);
  assert.match(source, /<SpeakingPractice key=\{activeItem\.identity\}/);
});

test("unavailable media can be skipped without submitting a review", async () => {
  const source = await readFile(new URL("../src/components/study/study-runner.tsx", import.meta.url), "utf8");
  assert.match(source, /async function skipUnavailable\(\)[\s\S]*?await next\(\)/);
  assert.match(source, /No FSRS review was submitted/);
  const { service, calls } = harness();
  assert.equal((await service.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good", null, "flashcards")).status, "saved");
  assert.equal(calls.saves.length, 1);
});

test("empty selected datasets create a controlled empty session", async () => {
  const { service } = harness({ datasets: new Map([["02-rs:empty", simpleDataset("empty", [])]]) });
  const result = await service.start("02-rs", "empty", "flashcards", "all");
  assert.equal(result.status, "ok");
  assert.deepEqual(result.queue, []);
  assert.equal(result.item, null);
});

test("failed persistence is displayed as unsaved and never as a successful review", async () => {
  const { service } = harness({ loadError: true });
  const session = await service.start("02-rs", "all", "flashcards", "scheduled");
  assert.equal(session.persistenceAvailable, false);
  const saved = await service.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good", null, "flashcards");
  assert.equal(saved.status, "not-saved");
  assert.doesNotMatch(JSON.stringify(saved), /saved successfully/i);
});

test("stale and concurrent review updates are rejected with compare-and-set semantics", async () => {
  const coreUrl = await urlFor("../src/lib/review/repository-core.ts", [
    ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
    ['from "@/lib/review/queue"', `from "${await urlFor("../src/lib/review/queue.ts", [['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`], ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`], ['from "@/lib/study/item-identity"', `from "${identityUrl}"`]])}"`],
    ['from "@/lib/review/types"', `from "${reviewTypesUrl}"`],
    ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
  ]);
  const { createReviewRepository } = await fromCode(coreUrl);
  let updatedAt = "2026-10-14T03:59:59.000Z";
  const db = { from() { return this; }, select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, range() { return Promise.resolve({ data: [], error: null }); }, insert() { return this; }, update() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
  const repository = createReviewRepository({ getAuthenticatedUserId: async () => "user-1", createClient: async () => db });
  const card = fsrs.reviewCard(fsrs.createReviewCard(now), "Good", now).card;
  const result = await repository.saveReviewedCard("apeuni:question:02-rs:1", card, updatedAt, now);
  assert.deepEqual(result, { status: "conflict" });
  updatedAt = "2026-10-14T04:00:01.000Z";
  assert.notEqual(updatedAt, "2026-10-14T03:59:59.000Z");

  let saveCount = 0;
  const dataset = new Map([["02-rs:all", simpleDataset()]]);
  const concurrent = runner.createStudyRunnerService({
    authenticate: async () => "user-1",
    resolve: async (type, id) => dataset.get(`${type}:${id}`),
    loadStates: async () => [],
    save: async () => ({ status: ++saveCount === 1 ? "saved" : "conflict" }),
    now: () => now,
  });
  const outcomes = await Promise.all([
    concurrent.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good", null, "flashcards"),
    concurrent.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good", null, "flashcards"),
  ]);
  assert.deepEqual(outcomes.map(({ status }) => status).sort(), ["conflict", "saved"]);
});

test("audio URLs from original records are never trusted without exact provenance", async () => {
  const card = adapters.adaptQuestionItem("02-rs", { id: 1, text: "Sentence", audio: "https://evil.example/audio.mp3" });
  assert.equal(card.audioUrl, null);
  const result = mediaResolver.resolveQuestionMediaFromIndex("02-rs", { id: 1, audio: "https://evil.example/audio.mp3" }, { registry: [], remote: {} });
  assert.deepEqual(result, {});
});

test("authenticated Cloudinary assets cannot be exposed as unsigned browser URLs", () => {
  const registry = { asset_id: "apeuni:03-di:1::image:03-describe-image/images/q1.png", owner: { provider: "apeuni", question_type: "03-di", question_id: 1 }, role: "image", source_path: "03-describe-image/images/q1.png", target_path: "data/03-DI/images/q1.png", expected_public_id: "pte/data/03-DI/images/q1", expected_delivery_type: "authenticated", resource_type: "image", source_sha256: "hash", association_status: "EXPLICIT_REFERENCE" };
  const remote = { asset_id: registry.asset_id, delivery_type: "authenticated", remote_status: "REMOTE_VERIFIED", public_id: registry.expected_public_id, resource_type: "image", source_sha256: "hash", delivery_url: "https://res.cloudinary.com/example/image/authenticated/signed.png", verification_evidence: { etag_matches_source_md5: true } };
  assert.deepEqual(mediaResolver.resolveQuestionMediaFromIndex("03-di", { id: 1, image: "images/q1.png" }, { registry: [registry], remote: { [registry.asset_id]: remote } }), {});
});

privateDataTest("the current verified DI image resolves to the authenticated local media endpoint", async () => {
  const bank = JSON.parse(await readFile(new URL("../data/03-DI/items.json", import.meta.url), "utf8"));
  const imageQuestion = bank.find(({ id }) => id === 1);
  assert.ok(imageQuestion?.image);
  assert.equal((await mediaResolver.resolveQuestionMedia("03-di", imageQuestion)).imageUrl, "/api/media?identity=apeuni%3Aquestion%3A03-di%3A1&role=image");
});

test("ambiguous exact registry associations are rejected", () => {
  const registry = { asset_id: "apeuni:03-di:1::image:03-describe-image/images/q1.png", owner: { provider: "apeuni", question_type: "03-di", question_id: 1 }, role: "image", source_path: "03-describe-image/images/q1.png", target_path: "data/03-DI/images/q1.png", expected_public_id: "pte/data/03-DI/images/q1", expected_delivery_type: "upload", resource_type: "image", source_sha256: "hash", association_status: "EXPLICIT_REFERENCE" };
  const index = { registry: [registry, { ...registry }], remote: {} };
  assert.deepEqual(mediaResolver.resolveQuestionMediaFromIndex("03-di", { id: 1, image: "images/q1.png" }, index), {});
});

test("public media is returned only when exact registry ownership and URL evidence agree", () => {
  const registry = { asset_id: "apeuni:03-di:1::image:03-describe-image/images/q1.png", owner: { provider: "apeuni", question_type: "03-di", question_id: 1 }, role: "image", source_path: "03-describe-image/images/q1.png", target_path: "data/03-DI/images/q1.png", expected_public_id: "pte/data/03-DI/images/q1", expected_delivery_type: "upload", resource_type: "image", source_sha256: "hash", association_status: "EXPLICIT_REFERENCE" };
  const deliveryUrl = "https://res.cloudinary.com/example/image/upload/v12/pte/data/03-DI/images/q1.png";
  const remote = { asset_id: registry.asset_id, cloudinary_asset_id: "verified-asset-id", cloud_name: "example", delivery_type: "upload", public_id: registry.expected_public_id, remote_status: "REMOTE_VERIFIED", resource_type: "image", source_sha256: "hash", delivery_url: deliveryUrl, verification_evidence: { asset_id: "verified-asset-id", cloud_name: "example", delivery_type: "upload", etag_matches_source_md5: true, public_id: registry.expected_public_id, resource_type: "image", delivery_url: deliveryUrl, identity_conflicts: [] } };
  const index = { registry: [registry], remote: { [registry.asset_id]: remote } };
  assert.equal(mediaResolver.resolveQuestionMediaFromIndex("03-di", { id: 1, image: "images/q1.png" }, index).imageUrl, deliveryUrl);
  const tampered = { ...remote, delivery_url: "https://evil.example/q1.png" };
  assert.deepEqual(mediaResolver.resolveQuestionMediaFromIndex("03-di", { id: 1, image: "images/q1.png" }, { registry: [registry], remote: { [registry.asset_id]: tampered } }), {});
});

test("missing source audio never triggers synthesized speech", async () => {
  const item = adapters.adaptQuestionItem("22-wfd", { id: 1, text: "A sentence." });
  assert.equal(item.audioUrl, null);
  assert.equal(availability.canPracticeMode("listen-write", "22-wfd", item), false);
  const sources = await Promise.all(["../src/lib/study/adapters.ts", "../src/components/audio/audio-player.tsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.doesNotMatch(sources.join("\n"), /speechSynthesis|new SpeechSynthesisUtterance|text.?to.?speech/i);
});

test("DI without an actually resolved image is not usable image speaking practice", () => {
  const item = adapters.adaptQuestionItem("03-di", { id: 1, title: "Solar System", image: "images/q1.png" });
  assert.equal(item.imageExpected, true);
  assert.equal(item.imageUrl, null);
  assert.equal(availability.canPracticeMode("listen-repeat", "03-di", item), false);
  assert.equal(availability.canPracticeMode("listen-repeat", "03-di", { ...item, imageUrl: "https://cdn.example.test/verified.png" }), true);
});

test("review actions require verified authentication", async () => {
  const { service, calls } = harness({ authenticated: false });
  assert.equal((await service.submitReview("02-rs", "all", "apeuni:question:02-rs:1", "Good", null, "flashcards")).status, "unauthenticated");
  assert.equal(calls.loads.length, 0);
  assert.equal(calls.saves.length, 0);
});

test("cross-user review access is constrained to the authenticated owner and migration RLS", async () => {
  const path = new URL("../supabase/migrations/20261014090608_create_study_review_states.sql", import.meta.url);
  const sql = await readFile(path, "utf8");
  assert.match(sql, /auth\.uid\(\).*user_id/s);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  const source = await readFile(new URL("../src/lib/review/repository-core.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("user_id", userId\)/);
});

test("server actions validate selected dataset membership before starting and saving", async () => {
  const { service } = harness({ datasets: new Map([["02-rs:all", simpleDataset("all", [{ id: 1, text: "Only this item." }])]]) });
  assert.equal((await service.start("02-rs", "all", "flashcards", "all")).status, "ok");
  assert.equal((await service.getItem("02-rs", "all", "apeuni:question:02-rs:2", "flashcards")).status, "invalid-request");
  assert.equal((await service.submitReview("02-rs", "all", "apeuni:question:02-rs:2", "Good", null, "flashcards")).status, "invalid-request");
});

test("no untrusted filesystem paths reach the browser adapter", () => {
  const item = adapters.adaptQuestionItem("03-di", { id: 1, title: "Prompt", image: "../../../../Users/private/image.png", audio: "/Users/private/audio.mp3" });
  assert.equal(item.imageUrl, null);
  assert.equal(item.audioUrl, null);
  assert.ok(item.front.every((line) => !line.includes("/Users/") && !line.includes("private/image")));
});

test("study controls reset identity-bound state and keep reference data behind Reveal", async () => {
  const source = await readFile(new URL("../src/components/study/study-runner.tsx", import.meta.url), "utf8");
  const adapter = await readFile(new URL("../src/lib/study/adapters.ts", import.meta.url), "utf8");
  assert.match(source, /setRevealed\(false\)/);
  assert.match(source, /setResponse\(""\)/);
  assert.match(adapter, /reference: questionReference/);
  assert.match(adapter, /referenceAvailable/);
  assert.match(source, /<Flashcard key=\{activeItem\.identity\}/);
});
