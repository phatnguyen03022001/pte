import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function loadTs(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  source = transpile(source);
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const packageUrl = import.meta.resolve("ts-fsrs");
const questionTypesUrl = `data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/study/question-types.ts", import.meta.url), "utf8"))).toString("base64")}`;
const identity = await loadTs("../src/lib/study/item-identity.ts", [["@/lib/study/question-types", questionTypesUrl]]);
const identityUrl = `data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/study/item-identity.ts", import.meta.url), "utf8")).replace('from "@/lib/study/question-types"', `from "${questionTypesUrl}"`)).toString("base64")}`;
const typesUrl = `data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/review/types.ts", import.meta.url), "utf8"))).toString("base64")}`;
const fsrs = await loadTs("../src/lib/review/fsrs.ts", [
  ['from "ts-fsrs"', `from "${packageUrl}"`],
  ['from "@/lib/review/types"', `from "${typesUrl}"`],
]);
const fsrsUrl = `data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/review/fsrs.ts", import.meta.url), "utf8"))
  .replace('from "ts-fsrs"', `from "${packageUrl}"`)
  .replace('from "@/lib/review/types"', `from "${typesUrl}"`)).toString("base64")}`;
const queue = await loadTs("../src/lib/review/queue.ts", [
  ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
  ['from "@/lib/review/types"', `from "${typesUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);
const core = await loadTs("../src/lib/review/repository-core.ts", [
  ['from "@/lib/review/fsrs"', `from "${fsrsUrl}"`],
  ['from "@/lib/review/queue"', `from "data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/review/queue.ts", import.meta.url), "utf8"))
    .replace('from "@/lib/review/fsrs"', `from "${fsrsUrl}"`)
    .replace('from "@/lib/review/types"', `from "${typesUrl}"`)
    .replace('from "@/lib/study/item-identity"', `from "${identityUrl}"`)).toString("base64")}"`],
  ['from "@/lib/review/types"', `from "${typesUrl}"`],
  ['from "@/lib/study/item-identity"', `from "${identityUrl}"`],
]);

const fixedNow = new Date("2026-10-14T04:00:00.000Z");

test("new FSRS cards start in the New state and serialize only when needed", async () => {
  const { State } = await import(packageUrl);
  const card = fsrs.createReviewCard(fixedNow);
  assert.equal(card.state, State.New);
  assert.equal(card.due.toISOString(), fixedNow.toISOString());
  assert.equal(fsrs.getCardStatus(undefined, fixedNow), "new");
});

for (const rating of ["Again", "Hard", "Good", "Easy"]) {
  test(`FSRS accepts ${rating} and produces a valid scheduled state`, () => {
    const initial = fsrs.createReviewCard(fixedNow);
    const reviewed = fsrs.reviewCard(initial, rating, fixedNow);
    assert.equal(reviewed.rating, rating);
    assert.ok(reviewed.dueAt instanceof Date);
    assert.ok(reviewed.dueAt.getTime() > fixedNow.getTime());
    assert.equal(fsrs.getCardStatus(reviewed.card, fixedNow), "not-due");
    assert.equal(reviewed.card.reps, 1);
  });
}

test("ratings produce distinct FSRS scheduling outcomes", () => {
  const dueDates = ["Again", "Hard", "Good", "Easy"].map((rating) =>
    fsrs.reviewCard(fsrs.createReviewCard(fixedNow), rating, fixedNow).dueAt.toISOString());
  assert.equal(new Set(dueDates).size, 4);
});

test("reviewing an existing card advances its state using the explicit review time", () => {
  const first = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow);
  const reviewTime = new Date(first.dueAt.getTime() + 15 * 60 * 1000);
  const second = fsrs.reviewCard(first.card, "Easy", reviewTime);
  assert.equal(second.card.reps, 2);
  assert.ok(second.dueAt.getTime() > reviewTime.getTime());
});

test("serialization preserves complete scheduling state and restores dates", () => {
  const reviewed = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Hard", fixedNow);
  const serialized = fsrs.serializeCard(reviewed.card);
  const restored = fsrs.deserializeCard(JSON.parse(JSON.stringify(serialized)));
  assert.deepEqual(restored, reviewed.card);
  assert.ok(restored.due instanceof Date);
  assert.equal(restored.learning_steps, reviewed.card.learning_steps);
});

test("queue classifies due, future and new items in selected dataset order", () => {
  const dueKey = identity.questionIdentity("02-rs", 305);
  const futureKey = identity.questionIdentity("02-rs", 306);
  const newKey = identity.questionIdentity("02-rs", 307);
  const dueCard = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card;
  const futureCard = { ...dueCard, due: new Date(fixedNow.getTime() + 86_400_000) };
  const selected = [futureKey, dueKey, newKey];
  const states = new Map([[dueKey, { ...dueCard, due: new Date(fixedNow.getTime() - 1) }], [futureKey, futureCard]]);

  assert.deepEqual(queue.getDueCards(selected, states, fixedNow).map(({ itemKey }) => itemKey), [dueKey]);
  assert.deepEqual(queue.getNotDueCards(selected, states, fixedNow).map(({ itemKey }) => itemKey), [futureKey]);
  assert.deepEqual(queue.getNewCards(selected, states).map(({ itemKey }) => itemKey), [newKey]);
  assert.deepEqual(queue.classifyReviewQueue(selected, states, fixedNow).map(({ status }) => status), ["not-due", "due", "new"]);
});

test("canonical identity is shared across overlapping datasets", () => {
  const fromAll = identity.questionIdentity("02-rs", 305);
  const fromOctober = identity.questionIdentity("02-rs", 305);
  const fromWeekly = identity.questionIdentity("02-rs", 305);
  assert.equal(fromAll, fromOctober);
  assert.equal(fromOctober, fromWeekly);
  assert.equal(identity.vocabularyIdentity("example"), "apeuni:vocabulary:example");
});

test("invalid rating, identity and stored card states are rejected", () => {
  assert.throws(() => fsrs.parseRating("Excellent"), /Invalid FSRS rating/);
  assert.throws(() => fsrs.deserializeCard({ version: 1, card: { due: "yesterday" } }), /Invalid stored FSRS state/);
  assert.throws(() => fsrs.deserializeCard({ version: 2, card: {} }), /Invalid stored FSRS state/);
  assert.throws(() => queue.classifyReviewQueue(["../../etc/passwd"], new Map()), /Invalid canonical item identity/);
});

test("PostgreSQL timestamptz values normalize UTC, offsets and microseconds", () => {
  const utcOffset = core.parsePostgresTimestamptz("2026-10-14 04:00:00+00:00");
  const microseconds = core.parsePostgresTimestamptz("2026-10-14 04:00:00.123456+00:00");
  const offsetEquivalent = core.parsePostgresTimestamptz("2026-10-14T11:00:00.123456+07:00");
  assert.ok(utcOffset);
  assert.ok(microseconds);
  assert.deepEqual(microseconds, offsetEquivalent);
  assert.equal(microseconds.epochMicroseconds - utcOffset.epochMicroseconds, 123456n);
  assert.deepEqual(
    core.parsePostgresTimestamptz("2026-10-14T04:00:00.123456Z"),
    microseconds,
  );
  assert.equal(core.parsePostgresTimestamptz("2026-02-30 04:00:00+00:00"), null);
  assert.equal(core.parsePostgresTimestamptz("2026-10-14 04:00:00.1234567+00:00"), null);
  assert.equal(core.parsePostgresTimestamptz("not-a-timestamp"), null);
});

function createMockClient(shared, { fail = false } = {}) {
  return {
    from(table) {
      assert.equal(table, "study_review_states");
      const query = { operation: "select", filters: [] };
      const builder = {
        select() { return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        in(column, values) { query.filters.push([column, values]); return builder; },
        order(column, options) { query.order = [column, options]; return builder; },
        range(from, to) { query.range = [from, to]; return builder; },
        insert(row) { query.operation = "insert"; query.row = row; return builder; },
        update(row) { query.operation = "update"; query.row = row; return builder; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      async function execute(single) {
        if (fail) return { data: null, error: { code: "XX000" } };
        const filters = new Map(query.filters);
        if (query.operation === "insert") {
          const row = query.row;
          const key = `${row.user_id}:${row.item_key}`;
          if (shared.rows.has(key)) return { data: null, error: { code: "23505" } };
          shared.rows.set(key, row);
          return { data: single ? row : [row], error: null };
        }
        let matches = [...shared.rows.entries()].filter(([, row]) => {
          for (const [column, value] of filters) {
            if (Array.isArray(value) ? !value.includes(row[column]) : row[column] !== value) return false;
          }
          return true;
        });
        if (query.order) {
          const [column, options] = query.order;
          matches.sort(([, rowA], [, rowB]) => {
            const comparison = String(rowA[column]).localeCompare(String(rowB[column]));
            return options.ascending ? comparison : -comparison;
          });
        }
        if (query.operation === "update") {
          for (const [key, row] of matches) shared.rows.set(key, { ...row, ...query.row });
        }
        const rows = matches
          .slice(query.range?.[0] ?? 0, (query.range?.[1] ?? 999) + 1)
          .slice(0, 1000)
          .map(([key]) => shared.rows.get(key));
        shared.queryLog?.push({
          keyCount: filters.get("item_key")?.length ?? 0,
          order: query.order,
          requestedRows: (query.range?.[1] ?? 999) - (query.range?.[0] ?? 0) + 1,
          returnedRows: rows.length,
        });
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      return builder;
    },
  };
}

test("repository scopes states by verified user and rejects duplicate/conflicting writes", async () => {
  const shared = { rows: new Map() };
  const userA = "00000000-0000-4000-8000-000000000001";
  const userB = "00000000-0000-4000-8000-000000000002";
  const key = identity.questionIdentity("02-rs", 305);
  const card = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card;
  const repoA = core.createReviewRepository({ getAuthenticatedUserId: async () => userA, createClient: async () => createMockClient(shared) });
  const repoB = core.createReviewRepository({ getAuthenticatedUserId: async () => userB, createClient: async () => createMockClient(shared) });

  const inserted = await repoA.saveReviewedCard(key, card, null, fixedNow);
  assert.equal(inserted.status, "saved");
  assert.equal((await repoA.loadReviewStates([key])).length, 1);
  assert.equal((await repoB.loadReviewStates([key])).length, 0);
  assert.deepEqual(await repoA.saveReviewedCard(key, card, null, fixedNow), { status: "conflict" });

  const nextClock = fixedNow;
  const updated = await repoA.saveReviewedCard(key, card, inserted.state.updatedAt, nextClock);
  assert.equal(updated.status, "saved");
  assert.deepEqual(await repoA.saveReviewedCard(key, card, inserted.state.updatedAt, nextClock), { status: "conflict" });
  assert.equal((await repoB.saveReviewedCard(key, card, null, fixedNow)).status, "saved");
});

test("repository reports persistence failures and rejects malformed identities", async () => {
  const key = identity.questionIdentity("02-rs", 305);
  const failed = core.createReviewRepository({
    getAuthenticatedUserId: async () => "user",
    createClient: async () => createMockClient({ rows: new Map() }, { fail: true }),
  });
  await assert.rejects(failed.loadReviewStates([key]), { code: "persistence-failed" });
  await assert.rejects(
    failed.saveReviewedCard(key, fsrs.createReviewCard(fixedNow), null, fixedNow),
    { code: "persistence-failed" },
  );
  await assert.rejects(failed.loadReviewStates(["../../secret"]), { code: "invalid-input" });
});

test("repository returns only due selected identities in dataset order", async () => {
  const shared = { rows: new Map() };
  const userId = "00000000-0000-4000-8000-000000000003";
  const dueKey = identity.questionIdentity("02-rs", 305);
  const futureKey = identity.questionIdentity("02-rs", 306);
  const outsideKey = identity.questionIdentity("02-rs", 307);
  const dueCard = { ...fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card, due: new Date(fixedNow.getTime() - 1) };
  const futureCard = { ...dueCard, due: new Date(fixedNow.getTime() + 60_000) };
  for (const [itemKey, card] of [[dueKey, dueCard], [futureKey, futureCard], [outsideKey, dueCard]]) {
    shared.rows.set(`${userId}:${itemKey}`, {
      user_id: userId,
      item_key: itemKey,
      card_state: fsrs.serializeCard(card),
      due_at: card.due.toISOString(),
      updated_at: fixedNow.toISOString(),
    });
  }
  const repository = core.createReviewRepository({
    getAuthenticatedUserId: async () => userId,
    createClient: async () => createMockClient(shared),
  });
  const due = await repository.getDueReviewStates([futureKey, dueKey], fixedNow);
  assert.deepEqual(due.map(({ itemKey }) => itemKey), [dueKey]);
});

test("repository accepts PostgreSQL timestamp forms and compares due instants", async () => {
  const shared = { rows: new Map() };
  const userId = "00000000-0000-4000-8000-000000000004";
  const itemKey = identity.questionIdentity("02-rs", 808);
  const card = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card;
  const databaseDue = card.due.toISOString().replace("T04:", "T11:").replace("Z", "+07:00");
  const databaseUpdatedAt = "2026-10-14 11:00:00.123456+07:00";
  shared.rows.set(`${userId}:${itemKey}`, {
    user_id: userId,
    item_key: itemKey,
    card_state: fsrs.serializeCard(card),
    due_at: databaseDue,
    updated_at: databaseUpdatedAt,
  });
  const repository = core.createReviewRepository({
    getAuthenticatedUserId: async () => userId,
    createClient: async () => createMockClient(shared),
  });

  const [state] = await repository.loadReviewStates([itemKey]);
  assert.equal(state.updatedAt, databaseUpdatedAt);
  assert.equal(state.dueAt.getTime(), card.due.getTime());
  const saved = await repository.saveReviewedCard(itemKey, card, state.updatedAt, fixedNow);
  assert.equal(saved.status, "saved");
  assert.deepEqual(
    core.parsePostgresTimestamptz(saved.state.updatedAt),
    core.parsePostgresTimestamptz("2026-10-14T04:00:00.123457Z"),
  );
});

test("repository completely loads 5,968 distinct Vocabulary identities in bounded pages", async () => {
  const shared = { rows: new Map(), queryLog: [] };
  const userId = "00000000-0000-4000-8000-000000000005";
  const canonicalKeys = Array.from({ length: 5968 }, (_, index) =>
    identity.vocabularyIdentity(`entry-${String(index + 1).padStart(4, "0")}`));
  const card = fsrs.reviewCard(fsrs.createReviewCard(fixedNow), "Good", fixedNow).card;
  for (const itemKey of [...canonicalKeys].reverse()) {
    shared.rows.set(`${userId}:${itemKey}`, {
      user_id: userId,
      item_key: itemKey,
      card_state: fsrs.serializeCard(card),
      due_at: card.due.toISOString(),
      updated_at: fixedNow.toISOString(),
    });
  }
  const repository = core.createReviewRepository({
    getAuthenticatedUserId: async () => userId,
    createClient: async () => createMockClient(shared),
  });

  const states = await repository.loadReviewStates(canonicalKeys);
  assert.equal(states.length, 5968);
  assert.deepEqual(states.map(({ itemKey }) => itemKey), canonicalKeys);
  assert.ok(shared.queryLog.length > 1_000 / 250);
  assert.ok(shared.queryLog.every(({ keyCount, order, requestedRows, returnedRows }) =>
    keyCount <= 500 && order?.[0] === "item_key" && order?.[1]?.ascending === true &&
    requestedRows <= 250 && returnedRows <= 1000));
  await assert.rejects(repository.loadReviewStates([...canonicalKeys, canonicalKeys[0]]), { code: "invalid-input" });
});

test("review-state migration grants only authenticated ownership policies", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261014000000_create_study_review_states.sql", import.meta.url), "utf8");
  assert.match(migration, /primary key \(user_id, item_key\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select\s+to authenticated\s+using[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(migration, /for insert\s+to authenticated\s+with check[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(migration, /for update\s+to authenticated\s+using[\s\S]*auth\.uid\(\)[\s\S]*user_id[\s\S]*with check[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(migration, /revoke all on table public\.study_review_states from public, anon, authenticated/i);
});
