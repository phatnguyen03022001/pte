import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DescribeImageItem = {
  slug: string;
  title: string;
  chartType: "bar" | "line";
  labels: string[];
  values: number[];
  unit: string;
  reviewPoints: string[];
  difficulty: string;
  sourceType: string;
  sourceRef: string | null;
};

type DescribeImageRow = Pick<
  Tables<"describe_image_items">,
  | "slug"
  | "title"
  | "chart_type"
  | "labels"
  | "values"
  | "unit"
  | "review_points"
  | "difficulty"
  | "source_type"
  | "source_ref"
>;

const selection =
  "slug,title,chart_type,labels,values,unit,review_points,difficulty,source_type,source_ref";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

export function parseDescribeImageItem(
  row: DescribeImageRow,
): DescribeImageItem | null {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    (row.chart_type !== "bar" && row.chart_type !== "line") ||
    !isNonEmptyStringArray(row.labels) ||
    !isFiniteNumberArray(row.values) ||
    row.labels.length < 4 ||
    row.labels.length > 8 ||
    row.labels.length !== row.values.length ||
    !isNonEmptyString(row.unit) ||
    !isNonEmptyStringArray(row.review_points) ||
    row.review_points.length !== 3 ||
    !isNonEmptyString(row.difficulty) ||
    !isNonEmptyString(row.source_type)
  ) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title,
    chartType: row.chart_type,
    labels: row.labels,
    values: row.values,
    unit: row.unit,
    reviewPoints: row.review_points,
    difficulty: row.difficulty,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
  };
}

export async function listDescribeImageItems(): Promise<DescribeImageItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("describe_image_items")
    .select(selection)
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Unable to load Describe Image practice.");
  }

  return data.flatMap((row) => {
    const item = parseDescribeImageItem(row);
    return item ? [item] : [];
  });
}
