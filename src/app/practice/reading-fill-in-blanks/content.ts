import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ReadingFillInBlanksBlank = {
  id: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type ReadingFillInBlanksItem = {
  slug: string;
  title: string;
  passageTemplate: string;
  blanks: ReadingFillInBlanksBlank[];
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type ReadingFillInBlanksRow = Pick<
  Tables<"reading_fill_in_blanks_items">,
  | "slug"
  | "title"
  | "passage_template"
  | "blanks"
  | "difficulty"
  | "source_type"
  | "source_ref"
>;

const selection =
  "slug,title,passage_template,blanks,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseBlank(value: unknown, index: number): ReadingFillInBlanksBlank | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const expectedId = `b${index + 1}`;
  const options = candidate.options;

  if (
    candidate.id !== expectedId ||
    !Array.isArray(options) ||
    options.length < 3 ||
    options.length > 5 ||
    !options.every(isNonEmptyString) ||
    !isNonEmptyString(candidate.answer) ||
    !isNonEmptyString(candidate.explanation)
  ) {
    return null;
  }

  const normalizedOptions: string[] = options;
  if (
    new Set(normalizedOptions).size !== normalizedOptions.length ||
    !normalizedOptions.includes(candidate.answer)
  ) {
    return null;
  }

  return {
    id: expectedId,
    options: normalizedOptions,
    answer: candidate.answer,
    explanation: candidate.explanation,
  };
}

export function parseReadingFillInBlanksItem(
  row: ReadingFillInBlanksRow,
): ReadingFillInBlanksItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.passage_template) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type) ||
    !Array.isArray(row.blanks) ||
    row.blanks.length < 1 ||
    row.blanks.length > 8
  ) {
    return null;
  }

  const blanks: ReadingFillInBlanksBlank[] = [];
  for (const [index, value] of row.blanks.entries()) {
    const parsedBlank = parseBlank(value, index);
    if (!parsedBlank) {
      return null;
    }
    blanks.push(parsedBlank);
  }

  const declaredIds = blanks.map((blank) => blank.id);
  const placeholders = Array.from(
    row.passage_template.matchAll(/\{\{([^{}]+)\}\}/g),
    (match) => match[1],
  );

  if (
    placeholders.length !== declaredIds.length ||
    placeholders.some((id, index) => id !== declaredIds[index])
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    passageTemplate: row.passage_template,
    blanks,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listReadingFillInBlanksItems(): Promise<
  ReadingFillInBlanksItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_fill_in_blanks_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Reading Fill in the Blanks practice.");
  }

  return data.flatMap((row) => {
    const parsed = parseReadingFillInBlanksItem(row);
    return parsed ? [parsed] : [];
  });
}
