import type { Card } from "ts-fsrs";

import { deserializeCard, serializeCard } from "@/lib/review/fsrs";
import { getDueCards } from "@/lib/review/queue";
import type { ReviewStateRecord } from "@/lib/review/types";
import { isCanonicalItemIdentity } from "@/lib/study/item-identity";

const SELECT_COLUMNS = "item_key, card_state, due_at, updated_at";
// Cap total work per call while allowing the current 5,968-entry Vocabulary dataset.
const MAX_REVIEW_IDENTITIES = 20_000;
// Each query asks for at most 250 rows and 500 item keys, below Supabase's usual 1,000-row API cap.
const ITEM_KEYS_PER_BATCH = 500;
const ROWS_PER_PAGE = 250;
const MICROS_PER_MILLISECOND = BigInt(1000);

export class ReviewRepositoryError extends Error {
  constructor(readonly code: "invalid-input" | "persistence-failed" | "invalid-stored-state") {
    const messages = {
      "invalid-input": "The review state request is invalid.",
      "persistence-failed": "The review state could not be loaded or saved.",
      "invalid-stored-state": "A saved review state is invalid and needs attention.",
    };
    super(messages[code]);
    this.name = "ReviewRepositoryError";
  }
}

type SupabaseResult = { data: unknown; error: { code?: string } | null };
type ReviewQueryBuilder = {
  select(columns: string): ReviewQueryBuilder;
  eq(column: string, value: string): ReviewQueryBuilder;
  in(column: string, values: readonly string[]): ReviewQueryBuilder;
  order(column: string, options: { ascending: boolean }): ReviewQueryBuilder;
  range(from: number, to: number): ReviewQueryBuilder;
  insert(row: Record<string, unknown>): ReviewQueryBuilder;
  update(row: Record<string, unknown>): ReviewQueryBuilder;
  maybeSingle(): Promise<SupabaseResult>;
};
type ReviewSupabaseClient = {
  from(table: string): unknown;
};

function queryFor(client: ReviewSupabaseClient): ReviewQueryBuilder {
  return client.from("study_review_states") as ReviewQueryBuilder;
}

export type ReviewRepositoryDependencies = {
  getAuthenticatedUserId(): Promise<string>;
  createClient(): Promise<ReviewSupabaseClient>;
};

export type SaveReviewResult = { status: "saved"; state: ReviewStateRecord } | { status: "conflict" };

export function createReviewRepository(dependencies: ReviewRepositoryDependencies) {
  async function loadReviewStates(itemKeys: readonly string[]): Promise<ReviewStateRecord[]> {
    const keys = validateItemKeys(itemKeys);
    const userId = await dependencies.getAuthenticatedUserId();
    if (keys.length === 0) return [];
    const client = await dependencies.createClient();
    const stateByKey = new Map<string, ReviewStateRecord>();

    for (let batchStart = 0; batchStart < keys.length; batchStart += ITEM_KEYS_PER_BATCH) {
      const batch = keys.slice(batchStart, batchStart + ITEM_KEYS_PER_BATCH);
      const requestedKeys = new Set(batch);

      for (let offset = 0; ; offset += ROWS_PER_PAGE) {
        const { data, error } = await queryFor(client)
          .select(SELECT_COLUMNS)
          .eq("user_id", userId)
          .in("item_key", batch)
          .order("item_key", { ascending: true })
          .range(offset, offset + ROWS_PER_PAGE - 1) as unknown as SupabaseResult;
        if (error) throw new ReviewRepositoryError("persistence-failed");
        if (!Array.isArray(data) || data.length > ROWS_PER_PAGE) {
          throw new ReviewRepositoryError("persistence-failed");
        }

        for (const row of data) {
          const state = parseStateRow(row);
          if (!requestedKeys.has(state.itemKey) || stateByKey.has(state.itemKey)) {
            throw new ReviewRepositoryError("invalid-stored-state");
          }
          stateByKey.set(state.itemKey, state);
        }

        if (data.length < ROWS_PER_PAGE) break;
      }
    }

    // PostgREST does not guarantee row order; return only found states in the caller's order.
    return keys.flatMap((key) => {
      const state = stateByKey.get(key);
      return state ? [state] : [];
    });
  }

  async function saveReviewedCard(
    itemKey: string,
    card: Card,
    expectedUpdatedAt: string | null,
    now = new Date(),
  ): Promise<SaveReviewResult> {
    const parsedExpectedUpdatedAt = expectedUpdatedAt === null
      ? null
      : parsePostgresTimestamptz(expectedUpdatedAt);
    if (!isCanonicalItemIdentity(itemKey) || !isValidTimestamp(now) ||
      (expectedUpdatedAt !== null && !parsedExpectedUpdatedAt)) {
      throw new ReviewRepositoryError("invalid-input");
    }

    let cardState;
    try {
      cardState = serializeCard(card);
    } catch {
      throw new ReviewRepositoryError("invalid-input");
    }

    const userId = await dependencies.getAuthenticatedUserId();
    const client = await dependencies.createClient();
    const nowMicroseconds = BigInt(now.getTime()) * MICROS_PER_MILLISECOND;
    const updatedAt = parsedExpectedUpdatedAt && nowMicroseconds <= parsedExpectedUpdatedAt.epochMicroseconds
      ? formatUtcTimestamptz(parsedExpectedUpdatedAt.epochMicroseconds + BigInt(1))
      : now.toISOString();
    const row = {
      user_id: userId,
      item_key: itemKey,
      card_state: cardState,
      due_at: card.due.toISOString(),
      updated_at: updatedAt,
    };

    let result: SupabaseResult;
    if (expectedUpdatedAt === null) {
      result = await queryFor(client)
        .insert(row)
        .select(SELECT_COLUMNS)
        .maybeSingle() as SupabaseResult;
    } else {
      result = await queryFor(client)
        .update({ card_state: row.card_state, due_at: row.due_at, updated_at: row.updated_at })
        .eq("user_id", userId)
        .eq("item_key", itemKey)
        .eq("updated_at", expectedUpdatedAt)
        .select(SELECT_COLUMNS)
        .maybeSingle() as SupabaseResult;
    }

    if (result.error?.code === "23505") return { status: "conflict" };
    if (result.error) throw new ReviewRepositoryError("persistence-failed");
    if (!result.data) return { status: "conflict" };
    return { status: "saved", state: parseStateRow(result.data) };
  }

  async function getDueReviewStates(itemKeys: readonly string[], now = new Date()): Promise<ReviewStateRecord[]> {
    if (!isValidTimestamp(now)) throw new ReviewRepositoryError("invalid-input");
    const keys = validateItemKeys(itemKeys);
    const states = await loadReviewStates(keys);
    const stateByKey = new Map(states.map((state) => [state.itemKey, state]));
    const dueKeys = getDueCards(keys, stateByKey, now).map(({ itemKey }) => itemKey);
    return dueKeys.map((key) => stateByKey.get(key)).filter((state): state is ReviewStateRecord => Boolean(state));
  }

  return { loadReviewStates, saveReviewedCard, getDueReviewStates };
}

function validateItemKeys(itemKeys: readonly string[]): string[] {
  // Bound both the caller's selection size and the number of database round trips it can trigger.
  if (!Array.isArray(itemKeys) || itemKeys.length > MAX_REVIEW_IDENTITIES) {
    throw new ReviewRepositoryError("invalid-input");
  }
  const keys = [...itemKeys];
  if (keys.some((key) => !isCanonicalItemIdentity(key)) || new Set(keys).size !== keys.length) {
    throw new ReviewRepositoryError("invalid-input");
  }
  return keys;
}

function parseStateRow(value: unknown): ReviewStateRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReviewRepositoryError("invalid-stored-state");
  const row = value as Record<string, unknown>;
  const updatedAt = parsePostgresTimestamptz(row.updated_at);
  const dueAt = parsePostgresTimestamptz(row.due_at);
  if (!isCanonicalItemIdentity(row.item_key) || !updatedAt || !dueAt) {
    throw new ReviewRepositoryError("invalid-stored-state");
  }
  try {
    const card = deserializeCard(row.card_state);
    const serializedDueAt = parsePostgresTimestamptz(card.due.toISOString());
    if (!serializedDueAt || serializedDueAt.epochMicroseconds !== dueAt.epochMicroseconds) {
      throw new Error("Due date mismatch.");
    }
    return { itemKey: row.item_key, card, dueAt: card.due, updatedAt: row.updated_at as string };
  } catch {
    throw new ReviewRepositoryError("invalid-stored-state");
  }
}

function isValidTimestamp(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

type ParsedPostgresTimestamptz = { epochMicroseconds: bigint };

export function parsePostgresTimestamptz(value: unknown): ParsedPostgresTimestamptz | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/i.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText = "", zoneText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59) return null;

  let offsetMinutes = 0;
  if (zoneText.toUpperCase() !== "Z") {
    const offsetMatch = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(zoneText);
    if (!offsetMatch) return null;
    const offsetHours = Number(offsetMatch[2]);
    const offsetMinutePart = Number(offsetMatch[3] ?? 0);
    if (offsetHours > 15 || offsetMinutePart > 59) return null;
    const magnitude = offsetHours * 60 + offsetMinutePart;
    offsetMinutes = offsetMatch[1] === "+" ? magnitude : -magnitude;
  }

  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(hour, minute, second, 0);
  const localMilliseconds = utcDate.getTime();
  if (!Number.isFinite(localMilliseconds)) return null;

  const fractionMicroseconds = BigInt(fractionText.padEnd(6, "0") || "0");
  const epochMicroseconds = BigInt(localMilliseconds - offsetMinutes * 60_000) * MICROS_PER_MILLISECOND + fractionMicroseconds;
  return { epochMicroseconds };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function formatUtcTimestamptz(epochMicroseconds: bigint): string {
  const milliseconds = floorDivide(epochMicroseconds, MICROS_PER_MILLISECOND);
  const subMillisecondMicroseconds = epochMicroseconds - milliseconds * MICROS_PER_MILLISECOND;
  const date = new Date(Number(milliseconds));
  if (Number.isNaN(date.getTime())) throw new ReviewRepositoryError("invalid-input");
  const base = date.toISOString().replace(/\.\d{3}Z$/, "");
  const millisecondsText = String(date.getUTCMilliseconds()).padStart(3, "0");
  const microsecondsText = subMillisecondMicroseconds.toString().padStart(3, "0");
  return `${base}.${millisecondsText}${microsecondsText}Z`;
}

function floorDivide(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  return value < BigInt(0) && value % divisor !== BigInt(0) ? quotient - BigInt(1) : quotient;
}
