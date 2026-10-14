import type { Card, Grade } from "ts-fsrs";

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type SerializedFsrsCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review?: string;
};

export type StoredFsrsCard = {
  version: 1;
  card: SerializedFsrsCard;
};

export type ReviewedCard = {
  card: Card;
  dueAt: Date;
  rating: ReviewRating;
};

export type CardStatus = "new" | "due" | "not-due";

export type ReviewStateRecord = {
  itemKey: string;
  card: Card;
  dueAt: Date;
  updatedAt: string;
};

export type ReviewQueueItem = {
  itemKey: string;
  status: CardStatus;
  dueAt?: Date;
  card?: Card;
};

export const RATING_NAMES = ["Again", "Hard", "Good", "Easy"] as const satisfies readonly ReviewRating[];
export type FsrsRating = Grade;
