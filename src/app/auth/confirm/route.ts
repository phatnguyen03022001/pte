import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  getSafeAuthRedirectPath,
  isConfirmationOtpType,
} from "@/lib/auth/auth-core";
import { SupabaseConfigurationError } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const PRIVATE_NO_STORE = "private, no-store, max-age=0, must-revalidate";

function redirectToLogin(request: NextRequest, notice: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("notice", notice);

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type");
  const destination = getSafeAuthRedirectPath(searchParams.get("next"));

  if (!code && (!tokenHash || !isConfirmationOtpType(otpType))) {
    return redirectToLogin(request, "confirmation-failed");
  }

  try {
    const supabase = await createClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash as string,
          type: otpType as EmailOtpType,
        });

    if (result.error) {
      return redirectToLogin(request, "confirmation-failed");
    }

    const response = NextResponse.redirect(new URL(destination, request.url));
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    return response;
  } catch (error) {
    return redirectToLogin(
      request,
      error instanceof SupabaseConfigurationError
        ? "auth-unavailable"
        : "confirmation-failed",
    );
  }
}
