import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getProtectedRedirectPath,
  hasCurrentVerifiedSession,
  isProtectedPath,
} from "@/lib/auth/auth-core";
import { getSupabasePublicConfigOrNull } from "@/lib/supabase/config";

const PRIVATE_NO_STORE = "private, no-store, max-age=0, must-revalidate";

export async function updateSession(request: NextRequest) {
  const isProtectedRequest = isProtectedPath(request.nextUrl.pathname);
  let supabaseResponse = NextResponse.next({ request });
  const config = getSupabasePublicConfigOrNull();

  if (!config) {
    if (isProtectedRequest) {
      supabaseResponse.headers.set("Cache-Control", PRIVATE_NO_STORE);
    }

    return supabaseResponse;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const isAuthenticated = await hasCurrentVerifiedSession(supabase.auth);

  const redirectPath = getProtectedRedirectPath(
    request.nextUrl.pathname,
    isAuthenticated,
  );

  if (!isProtectedRequest || !redirectPath) {
    return supabaseResponse;
  }

  supabaseResponse.headers.set("Cache-Control", PRIVATE_NO_STORE);

  if (!isAuthenticated) {
    const loginUrl = new URL(redirectPath, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);

    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) {
        redirectResponse.headers.set(header, value);
      }
    }

    redirectResponse.headers.set("Cache-Control", PRIVATE_NO_STORE);
    return redirectResponse;
  }

  return supabaseResponse;
}
