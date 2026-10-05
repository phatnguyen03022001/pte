import { NextResponse } from "next/server";

import {
  getAnswerShortQuestionPrompt,
  getAnswerShortQuestionResult,
} from "../content";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("item");
  const reveal = url.searchParams.get("reveal") === "1";

  if (!slug) {
    return NextResponse.json(
      { error: "Missing Answer Short Question item." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const payload = reveal
    ? await getAnswerShortQuestionResult(slug)
    : await getAnswerShortQuestionPrompt(slug);

  if (!payload) {
    return NextResponse.json(
      { error: "Answer Short Question item not found." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(payload, { headers: noStoreHeaders });
}
