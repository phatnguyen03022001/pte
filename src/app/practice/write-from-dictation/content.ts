import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type WriteFromDictationItem = {
  slug: string;
  sentence: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type WriteFromDictationRow = Pick<
  Tables<"write_from_dictation_items">,
  "slug" | "sentence" | "difficulty" | "source_type" | "source_ref"
>;

const selection = "slug,sentence,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseWriteFromDictationItem(
  row: WriteFromDictationRow,
): WriteFromDictationItem | null {
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

export async function listWriteFromDictationItems(): Promise<
  WriteFromDictationItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("write_from_dictation_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Write from Dictation practice.");
  }

  return data.flatMap((row) => {
    const parsedItem = parseWriteFromDictationItem(row);
    return parsedItem ? [parsedItem] : [];
  });
}
