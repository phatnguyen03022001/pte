import type { Card } from "ts-fsrs";

import { getCardStatus, isValidFsrsCard } from "@/lib/review/fsrs";
import type { ReviewQueueItem, ReviewStateRecord } from "@/lib/review/types";
import { isCanonicalItemIdentity } from "@/lib/study/item-identity";

export function classifyReviewQueue(
  orderedItemKeys: readonly string[],
  states: ReadonlyMap<string, Card | ReviewStateRecord>,
  now = new Date(),
): ReviewQueueItem[] {
  const seen = new Set<string>();
  return orderedItemKeys.map((itemKey) => {
    if (!isCanonicalItemIdentity(itemKey)) throw new TypeError("Invalid canonical item identity.");
    if (seen.has(itemKey)) throw new TypeError("Duplicate canonical item identity.");
    seen.add(itemKey);

    const value = states.get(itemKey);
    const card = value && "card" in value ? value.card : value as Card | undefined;
    if (!card) return { itemKey, status: "new" };
    const status = getCardStatus(card, now);
    return { itemKey, status, dueAt: card.due, card };
  });
}

export function getDueCards(
  orderedItemKeys: readonly string[],
  states: ReadonlyMap<string, Card | ReviewStateRecord>,
  now = new Date(),
): ReviewQueueItem[] {
  return classifyReviewQueue(orderedItemKeys, states, now).filter(({ status }) => status === "due");
}

export function getNotDueCards(
  orderedItemKeys: readonly string[],
  states: ReadonlyMap<string, Card | ReviewStateRecord>,
  now = new Date(),
): ReviewQueueItem[] {
  return classifyReviewQueue(orderedItemKeys, states, now).filter(({ status }) => status === "not-due");
}

export function getNewCards(
  orderedItemKeys: readonly string[],
  states: ReadonlyMap<string, Card | ReviewStateRecord>,
): ReviewQueueItem[] {
  return classifyReviewQueue(orderedItemKeys, states).filter(({ status }) => status === "new");
}

export function cardMapFromStates(states: readonly ReviewStateRecord[]): Map<string, Card> {
  return new Map(states.map(({ itemKey, card }) => {
    if (!isValidFsrsCard(card)) throw new TypeError("Invalid FSRS card state.");
    return [itemKey, card];
  }));
}
