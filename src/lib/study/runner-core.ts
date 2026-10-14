import type { Card } from "ts-fsrs";
import { createReviewCard, getCardStatus, parseRating, reviewCard } from "@/lib/review/fsrs";
import type { ReviewStateRecord, ReviewRating } from "@/lib/review/types";
import { adaptStudyItem, type StudyItem, type TrustedMedia } from "@/lib/study/adapters";
import { questionIdentity, vocabularyIdentity, isCanonicalItemIdentity } from "@/lib/study/item-identity";
import { getStudyModes, isStudyMode, isStudyScope, type StudyMode } from "@/lib/study/modes";
import { canPracticeMode } from "@/lib/study/mode-availability";

export type StudyDataset = {
  dataset: { id: string; label: string; status: string; count: number };
  items: Array<Record<string, unknown>>;
};

export type StudyResult =
  | { status: "ok"; dataset: { id: string; label: string; count: number }; queue: string[]; item: StudyItem | null; reviewRevisions: Record<string, string | null>; persistenceAvailable: boolean; mode: StudyMode }
  | { status: "unavailable" | "invalid-request" | "unauthenticated"; message: string };

export type ReviewResult =
  | { status: "saved"; nextDueAt: string; rating: ReviewRating }
  | { status: "conflict" | "not-saved" | "invalid-request" | "unauthenticated" | "unavailable"; message: string };

type RunnerDependencies = {
  authenticate(): Promise<unknown>;
  resolve(typeKey: string, datasetId: string): Promise<StudyDataset>;
  loadStates(itemKeys: readonly string[]): Promise<ReviewStateRecord[]>;
  save(itemKey: string, card: Card, expectedUpdatedAt: string | null, now: Date): Promise<{ status: "saved" } | { status: "conflict" }>;
  resolveMedia?(typeKey: string, item: Record<string, unknown>): Promise<TrustedMedia>;
  now(): Date;
};

function identityFor(typeKey: string, item: Record<string, unknown>): string | null {
  try {
    if (typeKey === "vocabulary") return vocabularyIdentity(typeof item.key === "string" ? item.key : "");
    return questionIdentity(typeKey, typeof item.id === "number" ? item.id : Number.NaN);
  } catch {
    return null;
  }
}

function selectionItems(typeKey: string, dataset: StudyDataset): Array<{ identity: string; source: Record<string, unknown> }> {
  const seen = new Set<string>();
  return dataset.items.map((source) => {
    const identity = identityFor(typeKey, source);
    if (!identity || seen.has(identity)) throw new TypeError("The selected dataset contains an invalid or duplicate item identity.");
    seen.add(identity);
    return { identity, source };
  });
}

async function publicItem(typeKey: string, source: Record<string, unknown>, resolveMedia?: RunnerDependencies["resolveMedia"]): Promise<StudyItem> {
  let media: TrustedMedia = {};
  if (typeKey !== "vocabulary" && resolveMedia) {
    try {
      media = await resolveMedia(typeKey, source);
    } catch {
      media = {};
    }
  }
  return adaptStudyItem(typeKey, source as never, media);
}

export function createStudyRunnerService(dependencies: RunnerDependencies) {
  async function authenticated(): Promise<boolean> {
    try {
      await dependencies.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  async function resolveSelection(typeKey: string, datasetId: string): Promise<StudyDataset | null> {
    if (typeof typeKey !== "string" || typeof datasetId !== "string" || datasetId.length > 200) return null;
    try {
      const selection = await dependencies.resolve(typeKey, datasetId);
      if (!selection || selection.dataset.id !== datasetId || !Array.isArray(selection.items)) return null;
      return selection;
    } catch {
      return null;
    }
  }

  async function start(
    typeKey: string,
    datasetId: string,
    mode: unknown,
    scope: unknown,
  ): Promise<StudyResult> {
    if (!await authenticated()) return { status: "unauthenticated", message: "Sign in to start a study session." };
    if (!isStudyMode(mode) || !isStudyScope(scope) || !getStudyModes(typeKey).includes(mode)) {
      return { status: "invalid-request", message: "The selected study mode or session scope is invalid." };
    }
    const selection = await resolveSelection(typeKey, datasetId);
    if (!selection || !["available", "empty"].includes(selection.dataset.status)) {
      return { status: "unavailable", message: "The selected dataset is unavailable." };
    }

    let selectedItems: Array<{ identity: string; source: Record<string, unknown> }>;
    try {
      selectedItems = selectionItems(typeKey, selection);
    } catch {
      return { status: "unavailable", message: "The selected dataset failed item validation." };
    }
    let persistenceAvailable = true;
    let stateByKey = new Map<string, ReviewStateRecord>();
    try {
      stateByKey = new Map((await dependencies.loadStates(selectedItems.map(({ identity }) => identity)))
        .map((state) => [state.itemKey, state]));
    } catch {
      persistenceAvailable = false;
    }

    const now = dependencies.now();
    const queue = scope === "all" || !persistenceAvailable
      ? selectedItems
      : selectedItems.filter(({ identity }) => {
        const state = stateByKey.get(identity);
        return !state || getCardStatus(state.card, now) === "due";
      });
    const queueIdentities = queue.map(({ identity }) => identity);

    return {
      status: "ok",
      dataset: { id: selection.dataset.id, label: selection.dataset.label, count: selectedItems.length },
      queue: queueIdentities,
      item: queue.length ? await publicItem(typeKey, queue[0].source, dependencies.resolveMedia) : null,
      reviewRevisions: Object.fromEntries(queueIdentities.map((identity) => [identity, stateByKey.get(identity)?.updatedAt ?? null])),
      persistenceAvailable,
      mode,
    };
  }

  async function getItem(typeKey: string, datasetId: string, itemKey: string, mode: unknown) {
    if (!await authenticated()) return { status: "unauthenticated" as const, message: "Sign in to continue studying." };
    if (!isStudyMode(mode) || !getStudyModes(typeKey).includes(mode) || !isCanonicalItemIdentity(itemKey)) {
      return { status: "invalid-request" as const, message: "The requested study item is invalid." };
    }
    const selection = await resolveSelection(typeKey, datasetId);
    if (!selection || selection.dataset.status !== "available") {
      return { status: "unavailable" as const, message: "The selected dataset is unavailable." };
    }
    let item: { identity: string; source: Record<string, unknown> } | undefined;
    try {
      item = selectionItems(typeKey, selection).find(({ identity }) => identity === itemKey);
    } catch {
      return { status: "unavailable" as const, message: "The selected dataset failed item validation." };
    }
    return item
      ? { status: "ok" as const, item: await publicItem(typeKey, item.source, dependencies.resolveMedia) }
      : { status: "invalid-request" as const, message: "The item does not belong to the selected dataset." };
  }

  async function submitReview(typeKey: string, datasetId: string, itemKey: string, rawRating: unknown, expectedUpdatedAt: string | null, mode: unknown): Promise<ReviewResult> {
    if (!await authenticated()) return { status: "unauthenticated", message: "Sign in to save a review." };
    if (!isCanonicalItemIdentity(itemKey) || !isStudyMode(mode) || !getStudyModes(typeKey).includes(mode)) {
      return { status: "invalid-request", message: "The review item or study mode is invalid." };
    }
    if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== "string" || expectedUpdatedAt.length > 64)) {
      return { status: "invalid-request", message: "The review snapshot is invalid." };
    }
    let rating: ReviewRating;
    try {
      rating = parseRating(rawRating);
    } catch {
      return { status: "invalid-request", message: "The selected review rating is invalid." };
    }

    const selection = await resolveSelection(typeKey, datasetId);
    if (!selection || selection.dataset.status !== "available") {
      return { status: "invalid-request", message: "The item does not belong to the selected dataset." };
    }
    try {
      const selected = selectionItems(typeKey, selection).find(({ identity }) => identity === itemKey);
      if (!selected) {
        return { status: "invalid-request", message: "The item does not belong to the selected dataset." };
      }
      const item = await publicItem(typeKey, selected.source, dependencies.resolveMedia);
      if (!canPracticeMode(mode, typeKey, item)) {
        return { status: "unavailable", message: "Verified media is unavailable. No FSRS review was saved." };
      }
    } catch {
      return { status: "unavailable", message: "The selected dataset failed item validation." };
    }

    const now = dependencies.now();
    try {
      const [current] = await dependencies.loadStates([itemKey]);
      if ((current?.updatedAt ?? null) !== expectedUpdatedAt) {
        return { status: "conflict", message: "This review changed elsewhere. Reload the item before trying again." };
      }
      const reviewed = reviewCard(current?.card ?? createReviewCard(now), rating, now);
      const result = await dependencies.save(itemKey, reviewed.card, expectedUpdatedAt, now);
      if (result.status === "conflict") {
        return { status: "conflict", message: "This review changed elsewhere. Reload the item before trying again." };
      }
      return { status: "saved", nextDueAt: reviewed.dueAt.toISOString(), rating };
    } catch {
      return { status: "not-saved", message: "Practice can continue, but this review was not saved." };
    }
  }

  return { start, getItem, submitReview };
}

export function shouldAllowRating(revealed: boolean, submitting: boolean): boolean {
  return revealed && !submitting;
}

export function queueContainsItem(queue: readonly string[], identity: string): boolean {
  return isCanonicalItemIdentity(identity) && queue.includes(identity);
}
