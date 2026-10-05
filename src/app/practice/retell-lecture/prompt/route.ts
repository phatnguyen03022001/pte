import { NextResponse } from "next/server";

import { getRetellLecturePrompt } from "../content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("item");

  if (!slug) {
    return NextResponse.json(
      { error: "Missing Retell Lecture item." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const prompt = await getRetellLecturePrompt(slug);

  if (!prompt) {
    return NextResponse.json(
      { error: "Retell Lecture item not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(prompt, {
    headers: { "Cache-Control": "no-store" },
  });
}
