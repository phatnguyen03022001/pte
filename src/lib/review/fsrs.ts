import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

import type { CardStatus, FsrsRating, ReviewRating, ReviewedCard, SerializedFsrsCard, StoredFsrsCard } from "@/lib/review/types";

const scheduler = fsrs();
const ratingByName: Record<ReviewRating, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError(`${label} must be a valid Date.`);
}

export function parseRating(value: unknown): ReviewRating {
  if (typeof value !== "string" || !Object.hasOwn(ratingByName, value)) {
    throw new TypeError("Invalid FSRS rating.");
  }
  return value as ReviewRating;
}

export function createReviewCard(now = new Date()): Card {
  assertValidDate(now, "Review time");
  return createEmptyCard(new Date(now.getTime()));
}

export function reviewCard(card: Card, rating: ReviewRating, now = new Date()): ReviewedCard {
  assertValidDate(now, "Review time");
  const validRating = parseRating(rating);
  if (!isValidFsrsCard(card)) throw new TypeError("Invalid FSRS card state.");

  const result = scheduler.next(card, new Date(now.getTime()), ratingByName[validRating]);
  return { card: result.card, dueAt: result.card.due, rating: validRating };
}

export function getCardStatus(card: Card | undefined, now = new Date()): CardStatus {
  assertValidDate(now, "Current time");
  if (!card) return "new";
  if (!isValidFsrsCard(card)) throw new TypeError("Invalid FSRS card state.");
  return card.due.getTime() <= now.getTime() ? "due" : "not-due";
}

export function serializeCard(card: Card): StoredFsrsCard {
  if (!isValidFsrsCard(card)) throw new TypeError("Invalid FSRS card state.");
  const serialized = {
    ...card,
    due: card.due.toISOString(),
    ...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
  } as SerializedFsrsCard;
  return { version: 1, card: serialized };
}

export function deserializeCard(value: unknown): Card {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid stored FSRS state.");
  const stored = value as Partial<StoredFsrsCard>;
  if (stored.version !== 1 || !stored.card || typeof stored.card !== "object" || Array.isArray(stored.card)) {
    throw new TypeError("Invalid stored FSRS state.");
  }

  const raw = stored.card as Record<string, unknown>;
  if (typeof raw.due !== "string" || !isIsoDate(raw.due)) throw new TypeError("Invalid stored FSRS state.");
  if (raw.last_review !== undefined && (typeof raw.last_review !== "string" || !isIsoDate(raw.last_review))) {
    throw new TypeError("Invalid stored FSRS state.");
  }

  const card = {
    ...raw,
    due: new Date(raw.due),
    ...(typeof raw.last_review === "string" ? { last_review: new Date(raw.last_review) } : {}),
  } as unknown as Card;
  if (!isValidFsrsCard(card)) throw new TypeError("Invalid stored FSRS state.");
  return card;
}

export function isValidFsrsCard(value: unknown): value is Card {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const card = value as Partial<Card>;
  const validState = [State.New, State.Learning, State.Review, State.Relearning].includes(card.state as State);
  return Boolean(
    card.due instanceof Date && !Number.isNaN(card.due.getTime()) &&
    (card.last_review === undefined || (card.last_review instanceof Date && !Number.isNaN(card.last_review.getTime()))) &&
    finiteNonNegative(card.stability) && finiteNonNegative(card.difficulty) &&
    finiteNonNegative(card.elapsed_days) && finiteNonNegative(card.scheduled_days) &&
    Number.isSafeInteger(card.learning_steps) && (card.learning_steps ?? -1) >= 0 &&
    Number.isSafeInteger(card.reps) && (card.reps ?? -1) >= 0 &&
    Number.isSafeInteger(card.lapses) && (card.lapses ?? -1) >= 0 && validState,
  );
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIsoDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function getFsrsRatingValue(rating: ReviewRating): FsrsRating {
  return ratingByName[parseRating(rating)];
}
