import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ReadingMultipleChoiceMultipleAnswersItem = {
  slug: string;
  title: string;
  passageText: string;
  questionText: string;
  options: string[];
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

export type ReadingMultipleChoiceMultipleAnswersResult = {
  correctIndexes: number[];
  explanationText: string;
};

type ItemRow = Pick<
  Tables<"reading_multiple_choice_multiple_answers_items">,
  | "slug"
  | "title"
  | "passage_text"
  | "question_text"
  | "options"
  | "difficulty"
  | "source_type"
  | "source_ref"
>;

type ResultRow = Pick<
  Tables<"reading_multiple_choice_multiple_answers_items">,
  "correct_indexes" | "explanation_text"
>;

const itemSelection =
  "slug,title,passage_text,question_text,options,difficulty,source_type,source_ref";
const resultSelection = "correct_indexes,explanation_text";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseItem(
  row: ItemRow,
): ReadingMultipleChoiceMultipleAnswersItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.passage_text) ||
    !isNonEmptyString(row.question_text) ||
    !Array.isArray(row.options) ||
    row.options.length !== 5 ||
    !row.options.every(isNonEmptyString) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    passageText: row.passage_text,
    questionText: row.question_text,
    options: row.options,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

function parseResult(
  row: ResultRow,
): ReadingMultipleChoiceMultipleAnswersResult | null {
  if (
    !Array.isArray(row.correct_indexes) ||
    row.correct_indexes.length !== 2 ||
    !row.correct_indexes.every(
      (index) => Number.isInteger(index) && index >= 0 && index <= 4,
    ) ||
    new Set(row.correct_indexes).size !== 2 ||
    !isNonEmptyString(row.explanation_text)
  ) {
    return null;
  }

  return {
    correctIndexes: row.correct_indexes,
    explanationText: row.explanation_text,
  };
}

export async function listReadingMultipleChoiceMultipleAnswersItems(): Promise<
  ReadingMultipleChoiceMultipleAnswersItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_multiple_choice_multiple_answers_items")
    .select(itemSelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Reading MCMA practice.");
  }

  return data.flatMap((row) => {
    const item = parseItem(row);
    return item ? [item] : [];
  });
}

export async function getReadingMultipleChoiceMultipleAnswersResult(
  slug: string,
): Promise<ReadingMultipleChoiceMultipleAnswersResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_multiple_choice_multiple_answers_items")
    .select(resultSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to reveal Reading MCMA review.");
  }

  return data ? parseResult(data) : null;
}
