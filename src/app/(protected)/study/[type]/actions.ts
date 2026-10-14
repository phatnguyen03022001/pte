"use server";

import { resolveQuestionDataset, resolveVocabularyDataset } from "@/lib/datasets/engine";
import { loadReviewStates, saveReviewedCard } from "@/lib/review/repository";
import { requireAuthenticatedUserId } from "@/lib/supabase/require-auth";
import { createStudyRunnerService } from "@/lib/study/runner-core";
import { resolveQuestionMedia } from "@/lib/media/resolver";

function createService() {
  return createStudyRunnerService({
    authenticate: requireAuthenticatedUserId,
    async resolve(typeKey, datasetId) {
      return typeKey === "vocabulary"
        ? resolveVocabularyDataset(datasetId)
        : resolveQuestionDataset(typeKey, datasetId);
    },
    loadStates: loadReviewStates,
    save: async (itemKey, card, expectedUpdatedAt, now) => saveReviewedCard(itemKey, card, expectedUpdatedAt, now),
    resolveMedia: resolveQuestionMedia,
    now: () => new Date(),
  });
}

export async function startStudySession(typeKey: string, datasetId: string, mode: unknown, scope: unknown) {
  return createService().start(typeKey, datasetId, mode, scope);
}

export async function loadStudyItem(typeKey: string, datasetId: string, itemKey: string, mode: unknown) {
  return createService().getItem(typeKey, datasetId, itemKey, mode);
}

export async function submitStudyReview(typeKey: string, datasetId: string, itemKey: string, rating: unknown, expectedUpdatedAt: string | null, mode: unknown) {
  return createService().submitReview(typeKey, datasetId, itemKey, rating, expectedUpdatedAt, mode);
}
