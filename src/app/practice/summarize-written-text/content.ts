import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type SummarizeWrittenTextItem = {
  slug: string;
  title: string;
  passage: string;
  keyPoints: string[];
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type SummarizeWrittenTextRow = Pick<
  Tables<"summarize_written_text_items">,
  "slug" | "title" | "passage" | "key_points" | "difficulty" | "source_type" | "source_ref"
>;

const selection =
  "slug,title,passage,key_points,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseKeyPoints(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 5 ||
    !value.every(isNonEmptyString)
  ) {
    return null;
  }

  return value;
}

export function parseSummarizeWrittenTextItem(
  row: SummarizeWrittenTextRow,
): SummarizeWrittenTextItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.passage) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  const keyPoints = parseKeyPoints(row.key_points);
  if (!keyPoints) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    passage: row.passage,
    keyPoints,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listSummarizeWrittenTextItems(): Promise<
  SummarizeWrittenTextItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("summarize_written_text_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Summarize Written Text practice.");
  }

  return data.flatMap((row) => {
    const parsed = parseSummarizeWrittenTextItem(row);
    return parsed ? [parsed] : [];
  });
}
