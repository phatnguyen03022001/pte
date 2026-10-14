"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  signInWithPassword,
  signUpWithPassword,
  validateCredentials,
  type AuthMode,
} from "@/lib/auth/auth-core";
import { SupabaseConfigurationError } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: AuthMode;
  notice?: string;
}

const AUTH_NOTICES: Record<string, string> = {
  "sign-in-required": "Sign in to access that page.",
  "confirmation-failed":
    "That confirmation link is invalid or expired. Request a new one and try again.",
  "auth-unavailable":
    "Authentication is temporarily unavailable. Check the app configuration and try again.",
};

export function AuthForm({ mode, notice }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "status";
    text: string;
  } | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validationError = validateCredentials(email, password, mode);
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    setIsPending(true);

    try {
      const supabase = createClient();
      const result = isSignup
        ? await signUpWithPassword(
            supabase.auth,
            email,
            password,
            new URL("/auth/confirm", window.location.origin).toString(),
          )
        : await signInWithPassword(supabase.auth, email, password);

      if (result.status === "error") {
        setMessage({ kind: "error", text: result.message });
        return;
      }

      if (result.status === "confirmation-required") {
        setMessage({
          kind: "status",
          text: "Check your email and follow the confirmation link to finish signing up.",
        });
        return;
      }

      router.replace("/study");
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof SupabaseConfigurationError
            ? error.message
            : "Authentication could not be completed. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  const noticeMessage = notice ? AUTH_NOTICES[notice] : undefined;

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {noticeMessage ? (
        <p
          className="rounded-md border bg-surface px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {noticeMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor={`${mode}-email`}>
          Email
        </label>
        <Input
          id={`${mode}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          aria-invalid={message?.kind === "error"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor={`${mode}-password`}>
          Password
        </label>
        <Input
          id={`${mode}-password`}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          aria-invalid={message?.kind === "error"}
        />
        {isSignup ? (
          <p className="text-xs text-muted-foreground">
            Use at least 8 characters.
          </p>
        ) : null}
      </div>

      {message ? (
        <p
          className={
            message.kind === "error"
              ? "text-sm text-destructive"
              : "rounded-md border bg-surface px-3 py-2 text-sm text-muted-foreground"
          }
          role={message.kind === "error" ? "alert" : "status"}
          aria-live={message.kind === "error" ? "assertive" : "polite"}
        >
          {message.text}
        </p>
      ) : null}

      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending
          ? isSignup
            ? "Creating account…"
            : "Signing in…"
          : isSignup
            ? "Create account"
            : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New to PTE Study? "}
        <Link
          className="font-medium text-foreground underline underline-offset-4 hover:text-brand-text"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
