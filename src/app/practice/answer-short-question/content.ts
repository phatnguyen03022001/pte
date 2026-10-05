import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AnswerShortQuestionItem = {
  slug: string;
  title: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

export type AnswerShortQuestionPrompt = {
  questionText: string;
};

export type AnswerShortQuestionResult = {
  questionText: string;
  acceptedAnswers: string[];
};

type AnswerShortQuestionListRow = Pick<
  Tables<"answer_short_question_items">,
  "slug" | "title" | "difficulty" | "source_type" | "source_ref"
>;

type AnswerShortQuestionPromptRow = Pick<
  Tables<"answer_short_question_items">,
  "question_text"
>;

type AnswerShortQuestionResultRow = Pick<
  Tables<"answer_short_question_items">,
  "question_text" | "accepted_answers"
>;

const listSelection = "slug,title,difficulty,source_type,source_ref";
const promptSelection = "question_text";
const resultSelection = "question_text,accepted_answers";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAcceptedAnswers(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 4 &&
    value.every(isNonEmptyString)
  );
}

export function parseAnswerShortQuestionItem(
  row: AnswerShortQuestionListRow,
): AnswerShortQuestionItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

function parsePrompt(
  row: AnswerShortQuestionPromptRow,
): AnswerShortQuestionPrompt | null {
  if (!isNonEmptyString(row.question_text)) {
    return null;
  }

  return { questionText: row.question_text };
}

function parseResult(
  row: AnswerShortQuestionResultRow,
): AnswerShortQuestionResult | null {
  if (
    !isNonEmptyString(row.question_text) ||
    !isAcceptedAnswers(row.accepted_answers)
  ) {
    return null;
  }

  return {
    questionText: row.question_text,
    acceptedAnswers: row.accepted_answers,
  };
}

export async function listAnswerShortQuestionItems(): Promise<
  AnswerShortQuestionItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_short_question_items")
    .select(listSelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Answer Short Question practice.");
  }

  return data.flatMap((row) => {
    const item = parseAnswerShortQuestionItem(row);
    return item ? [item] : [];
  });
}

export async function getAnswerShortQuestionPrompt(
  slug: string,
): Promise<AnswerShortQuestionPrompt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_short_question_items")
    .select(promptSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Answer Short Question prompt.");
  }

  return data ? parsePrompt(data) : null;
}

export async function getAnswerShortQuestionResult(
  slug: string,
): Promise<AnswerShortQuestionResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_short_question_items")
    .select(resultSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to reveal Answer Short Question result.");
  }

  return data ? parseResult(data) : null;
}
