import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-page py-section">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-xl border bg-surface p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-brand-text">
            Design system active
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">PTE Study</h1>
          <p className="text-muted-foreground">
            Foundation initialized successfully.
          </p>
        </div>
        <div>
          <Button type="button">Foundation ready</Button>
        </div>
        <Link
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          href="/login"
        >
          Sign in
        </Link>
      </section>
    </main>
  );
}
