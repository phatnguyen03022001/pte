import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export const STUDY_SKILLS = ["speaking", "writing", "reading", "listening"] as const;
export const STUDY_TYPES = [
  "strategy",
  "template",
  "skill_guide",
  "common_mistake",
  "playbook",
  "plan",
] as const;

type StudySkill = (typeof STUDY_SKILLS)[number];
type StudyType = (typeof STUDY_TYPES)[number];

export type StudyItem = Pick<
  Tables<"study_content">,
  | "slug"
  | "type"
  | "skill_code"
  | "task_type"
  | "title"
  | "target_score"
  | "source_type"
  | "source_ref"
  | "body_markdown"
>;

export type StudyFilters = {
  skill?: StudySkill;
  type?: StudyType;
};

export function parseStudySkill(value: string | undefined): StudySkill | undefined {
  return STUDY_SKILLS.find((skill) => skill === value);
}

export function parseStudyType(value: string | undefined): StudyType | undefined {
  return STUDY_TYPES.find((type) => type === value);
}

const studySelection =
  "slug,type,skill_code,task_type,title,target_score,source_type,source_ref,body_markdown";

export async function listStudyItems(filters: StudyFilters): Promise<StudyItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("study_content")
    .select(studySelection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (filters.skill) {
    query = query.eq("skill_code", filters.skill);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load Study content.");
  }

  return data;
}

export async function getStudyItem(slug: string): Promise<StudyItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_content")
    .select(studySelection)
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load Study content.");
  }

  return data;
}

export function formatStudyLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function safeSourceUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
