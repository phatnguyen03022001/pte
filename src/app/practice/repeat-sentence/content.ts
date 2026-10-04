import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type RepeatSentenceItem = {
  slug: string;
  sentence: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type RepeatSentenceRow = Pick<
  Tables<"repeat_sentence_items">,
  "slug" | "sentence" | "difficulty" | "source_type" | "source_ref"
>;

const selection = "slug,sentence,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseRepeatSentenceItem(
  row: RepeatSentenceRow,
): RepeatSentenceItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.sentence) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    sentence: row.sentence,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listRepeatSentenceItems(): Promise<RepeatSentenceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repeat_sentence_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Repeat Sentence practice.");
  }

  return data.flatMap((row) => {
    const parsedItem = parseRepeatSentenceItem(row);
    return parsedItem ? [parsedItem] : [];
  });
}
