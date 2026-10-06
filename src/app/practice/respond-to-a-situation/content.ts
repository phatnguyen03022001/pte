import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type RespondToASituationItem = {
  slug: string;
  title: string;
  situationText: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

export type RespondToASituationResult = {
  reviewPoints: string[];
};

type ItemRow = Pick<
  Tables<"respond_to_a_situation_items">,
  "slug" | "title" | "situation_text" | "difficulty" | "source_type" | "source_ref"
>;

type ResultRow = Pick<
  Tables<"respond_to_a_situation_items">,
  "review_points"
>;

const itemSelection =
  "slug,title,situation_text,difficulty,source_type,source_ref";
const resultSelection = "review_points";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseItem(row: ItemRow): RespondToASituationItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.situation_text) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    situationText: row.situation_text,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

function parseResult(row: ResultRow): RespondToASituationResult | null {
  if (
    !Array.isArray(row.review_points) ||
    row.review_points.length !== 5 ||
    !row.review_points.every(isNonEmptyString)
  ) {
    return null;
  }

  return { reviewPoints: row.review_points };
}

export async function listRespondToASituationItems(): Promise<
  RespondToASituationItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("respond_to_a_situation_items")
    .select(itemSelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Respond to a Situation practice.");
  }

  return data.flatMap((row) => {
    const item = parseItem(row);
    return item ? [item] : [];
  });
}

export async function getRespondToASituationResult(
  slug: string,
): Promise<RespondToASituationResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("respond_to_a_situation_items")
    .select(resultSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to reveal Respond to a Situation self-review.");
  }

  return data ? parseResult(data) : null;
}
