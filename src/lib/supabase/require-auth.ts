import { redirect } from "next/navigation";

import { hasCurrentVerifiedSession, hasVerifiedClaimsSubject } from "@/lib/auth/auth-core";
import { createClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser(): Promise<void> {
  const supabase = await createClient();
  if (!(await hasCurrentVerifiedSession(supabase.auth))) {
    redirect("/login?notice=sign-in-required");
  }
}

export async function requireAuthenticatedUserId(): Promise<string> {
  let subject: string | undefined;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error && hasVerifiedClaimsSubject(data?.claims)) subject = data.claims.sub;
  } catch {
    subject = undefined;
  }
  if (!subject) redirect("/login?notice=sign-in-required");
  return subject;
}
