import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type RetellLectureItem = {
  slug: string;
  title: string;
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

export type RetellLecturePrompt = {
  lectureText: string;
  reviewPoints: string[];
};

type RetellLectureListRow = Pick<
  Tables<"retell_lecture_items">,
  "slug" | "title" | "difficulty" | "source_type" | "source_ref"
>;

type RetellLecturePromptRow = Pick<
  Tables<"retell_lecture_items">,
  "lecture_text" | "review_points"
>;

const listSelection = "slug,title,difficulty,source_type,source_ref";
const promptSelection = "lecture_text,review_points";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFourReviewPoints(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(isNonEmptyString)
  );
}

export function parseRetellLectureItem(
  row: RetellLectureListRow,
): RetellLectureItem | null {
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

export function parseRetellLecturePrompt(
  row: RetellLecturePromptRow,
): RetellLecturePrompt | null {
  if (
    !isNonEmptyString(row.lecture_text) ||
    !isFourReviewPoints(row.review_points)
  ) {
    return null;
  }

  return {
    lectureText: row.lecture_text,
    reviewPoints: row.review_points,
  };
}

export async function listRetellLectureItems(): Promise<RetellLectureItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retell_lecture_items")
    .select(listSelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Retell Lecture practice.");
  }

  return data.flatMap((row) => {
    const item = parseRetellLectureItem(row);
    return item ? [item] : [];
  });
}

export async function getRetellLecturePrompt(
  slug: string,
): Promise<RetellLecturePrompt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retell_lecture_items")
    .select(promptSelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Retell Lecture prompt.");
  }

  return data ? parseRetellLecturePrompt(data) : null;
}
