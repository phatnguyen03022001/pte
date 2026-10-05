import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DiscussionSpeaker = "A" | "B" | "C";

export type DiscussionTurn = {
  speaker: DiscussionSpeaker;
  text: string;
};

export type SummarizeGroupDiscussionItem = {
  slug: string;
  title: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

export type SummarizeGroupDiscussionPrompt = {
  turns: DiscussionTurn[];
};

export type SummarizeGroupDiscussionResult = {
  turns: DiscussionTurn[];
  reviewPoints: string[];
};

type SummarizeGroupDiscussionListRow = Pick<
  Tables<"summarize_group_discussion_items">,
  "slug" | "title" | "difficulty" | "source_type" | "source_ref"
>;

type SummarizeGroupDiscussionPromptRow = Pick<
  Tables<"summarize_group_discussion_items">,
  | "speaker_a_1"
  | "speaker_b_1"
  | "speaker_c_1"
  | "speaker_a_2"
  | "speaker_b_2"
  | "speaker_c_2"
>;

type SummarizeGroupDiscussionResultRow =
  SummarizeGroupDiscussionPromptRow &
    Pick<Tables<"summarize_group_discussion_items">, "review_points">;

const listSelection = "slug,title,difficulty,source_type,source_ref";
const promptSelection =
  "speaker_a_1,speaker_b_1,speaker_c_1,speaker_a_2,speaker_b_2,speaker_c_2";
const resultSelection = `${promptSelection},review_points`;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseTurns(
  row: SummarizeGroupDiscussionPromptRow,
): DiscussionTurn[] | null {
  const values = [
    row.speaker_a_1,
    row.speaker_b_1,
    row.speaker_c_1,
    row.speaker_a_2,
    row.speaker_b_2,
    row.speaker_c_2,
  ];

  if (!values.every(isNonEmptyString)) {
    return null;
  }

  return [
    { speaker: "A", text: row.speaker_a_1 },
    { speaker: "B", text: row.speaker_b_1 },
    { speaker: "C", text: row.speaker_c_1 },
    { speaker: "A", text: row.speaker_a_2 },
    { speaker: "B", text: row.speaker_b_2 },
    { speaker: "C", text: row.speaker_c_2 },
  ];
}

export function parseSummarizeGroupDiscussionItem(
  row: SummarizeGroupDiscussionListRow,
): SummarizeGroupDiscussionItem | null {
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
  row: SummarizeGroupDiscussionPromptRow,
): SummarizeGroupDiscussionPrompt | null {
  const turns = parseTurns(row);
  return turns ? { turns } : null;
}

function parseResult(
  row: SummarizeGroupDiscussionResultRow,
): SummarizeGroupDiscussionResult | null {
  const turns = parseTurns(row);

  if (
    !turns ||
    !Array.isArray(row.review_points) ||
    row.review_points.length !== 5 ||
    !row.review_points.every(isNonEmptyString)
  ) {
    return null;
  }

  return {
    turns,
    reviewPoints: row.review_points,
  };
}

export async function listSummarizeGroupDiscussionItems(): Promise<
  SummarizeGroupDiscussionItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("summarize_group_discussion_items")
    .select(listSelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Summarize Group Discussion practice.");
  }

  return data.flatMap((row) => {
    const item = parseSummarizeGroupDiscussionItem(row);
    return item ? [item] : [];
  });
}

export async function getSummarizeGroupDiscussionPrompt(
  slug: string,
): Promise<SummarizeGroupDiscussionPrompt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("summarize_group_discussion_items")
    .select(promptSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Summarize Group Discussion prompt.");
  }

  return data ? parsePrompt(data) : null;
}

export async function getSummarizeGroupDiscussionResult(
  slug: string,
): Promise<SummarizeGroupDiscussionResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("summarize_group_discussion_items")
    .select(resultSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to reveal Summarize Group Discussion result.");
  }

  return data ? parseResult(data) : null;
}
