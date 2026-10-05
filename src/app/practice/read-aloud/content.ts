import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ReadAloudItem = {
  slug: string;
  title: string;
  passage: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type ReadAloudRow = Pick<
  Tables<"read_aloud_items">,
  "slug" | "title" | "passage" | "difficulty" | "source_type" | "source_ref"
>;

const selection = "slug,title,passage,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseReadAloudItem(row: ReadAloudRow): ReadAloudItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.passage) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    passage: row.passage,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listReadAloudItems(): Promise<ReadAloudItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("read_aloud_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Read Aloud practice.");
  }

  return data.flatMap((row) => {
    const parsedItem = parseReadAloudItem(row);
    return parsedItem ? [parsedItem] : [];
  });
}
