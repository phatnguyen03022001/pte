import { NextResponse } from "next/server";

import {
  getSummarizeGroupDiscussionPrompt,
  getSummarizeGroupDiscussionResult,
} from "../content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("item");
  const reveal = url.searchParams.get("reveal") === "1";

  if (!slug) {
    return NextResponse.json(
      { error: "Missing Summarize Group Discussion item." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = reveal
    ? await getSummarizeGroupDiscussionResult(slug)
    : await getSummarizeGroupDiscussionPrompt(slug);

  if (!payload) {
    return NextResponse.json(
      { error: "Summarize Group Discussion item not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
