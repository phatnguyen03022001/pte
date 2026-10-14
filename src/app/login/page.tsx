import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

interface LoginPageProps {
  searchParams: Promise<{ notice?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

  return (
    <main className="flex min-h-svh items-center justify-center px-page py-section">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-sm font-medium text-brand-text">PTE Study</p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Continue to your study workspace.
          </p>
        </div>
        <AuthForm mode="login" notice={notice} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link className="underline underline-offset-4" href="/">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
