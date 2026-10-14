"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client can only run in a browser.");
  }

  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
