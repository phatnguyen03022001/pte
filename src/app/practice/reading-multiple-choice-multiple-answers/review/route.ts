import { NextResponse } from "next/server";

import { getReadingMultipleChoiceMultipleAnswersResult } from "../content";

type ReviewRequest = {
  item?: unknown;
  selectedIndexes?: unknown;
};

export async function POST(request: Request) {
  let payload: ReviewRequest;

  try {
    payload = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid Reading MCMA review request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const slug = typeof payload.item === "string" ? payload.item : null;
  const selectedIndexes = Array.isArray(payload.selectedIndexes)
    ? payload.selectedIndexes
    : null;
  const validSelection =
    selectedIndexes !== null &&
    selectedIndexes.length >= 1 &&
    selectedIndexes.length <= 5 &&
    selectedIndexes.every(
      (index) => Number.isInteger(index) && index >= 0 && index <= 4,
    ) &&
    new Set(selectedIndexes).size === selectedIndexes.length;

  if (!slug || !validSelection) {
    return NextResponse.json(
      { error: "Reading MCMA Submit requires at least one valid selection." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await getReadingMultipleChoiceMultipleAnswersResult(slug);

  if (!result) {
    return NextResponse.json(
      { error: "Reading MCMA item not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
