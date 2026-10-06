import { NextResponse } from "next/server";

import { getRespondToASituationResult } from "../content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("item");

  if (!slug) {
    return NextResponse.json(
      { error: "Missing Respond to a Situation item." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await getRespondToASituationResult(slug);

  if (!result) {
    return NextResponse.json(
      { error: "Respond to a Situation item not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
