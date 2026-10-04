import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type WriteEssayItem = {
  slug: string;
  title: string;
  prompt: string;
  planningPoints: string[];
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type WriteEssayRow = Pick<
  Tables<"write_essay_items">,
  "slug" | "title" | "prompt" | "planning_points" | "difficulty" | "source_type" | "source_ref"
>;

const selection =
  "slug,title,prompt,planning_points,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePlanningPoints(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    value.length > 5 ||
    !value.every(isNonEmptyString)
  ) {
    return null;
  }

  return value;
}

export function parseWriteEssayItem(row: WriteEssayRow): WriteEssayItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.prompt) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  const planningPoints = parsePlanningPoints(row.planning_points);
  if (!planningPoints) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    prompt: row.prompt,
    planningPoints,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listWriteEssayItems(): Promise<WriteEssayItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("write_essay_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Write Essay practice.");
  }

  return data.flatMap((row) => {
    const parsedItem = parseWriteEssayItem(row);
    return parsedItem ? [parsedItem] : [];
  });
}
