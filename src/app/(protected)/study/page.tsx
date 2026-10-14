import { requireAuthenticatedUser } from "@/lib/supabase/require-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudyPage() {
  await requireAuthenticatedUser();

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-brand-text">PTE Study</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Study</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Choose a question type from the navigation to open its practice placeholder.
      </p>
      <p className="mt-5 text-xs text-muted-foreground">Signed in.</p>
    </section>
  );
}
