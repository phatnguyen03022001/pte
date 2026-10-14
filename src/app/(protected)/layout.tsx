import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { SupabaseConfigurationError } from "@/lib/supabase/config";
import { requireAuthenticatedUser } from "@/lib/supabase/require-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (!(error instanceof SupabaseConfigurationError)) {
      throw error;
    }

    return (
      <main className="flex min-h-svh items-center justify-center px-page py-section">
        <section
          className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm sm:p-8"
          role="alert"
        >
          <h1 className="text-xl font-semibold">Authentication unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set the Supabase project URL and publishable key to open protected
            pages.
          </p>
        </section>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
