import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUserId } from "@/lib/supabase/require-auth";
import { createReviewRepository } from "@/lib/review/repository-core";

const repository = createReviewRepository({
  getAuthenticatedUserId: requireAuthenticatedUserId,
  createClient,
});

export const loadReviewStates = repository.loadReviewStates;
export const saveReviewedCard = repository.saveReviewedCard;
export const getDueReviewStates = repository.getDueReviewStates;
