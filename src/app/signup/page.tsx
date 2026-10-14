import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-page py-section">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-sm font-medium text-brand-text">PTE Study</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign up with your email and a password.
          </p>
        </div>
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link className="underline underline-offset-4" href="/">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
