"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutLocally } from "@/lib/auth/auth-core";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsPending(true);

    try {
      const result = await signOutLocally(createClient().auth);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to sign out right now. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button type="button" variant="outline" onClick={handleSignOut} disabled={isPending}>
        {isPending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
