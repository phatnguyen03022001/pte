import { DatasetPicker } from "@/components/study/dataset-picker";
import { StudyRunner } from "@/components/study/study-runner";
import { resolveVocabularyDataset } from "@/lib/datasets/engine";
import { requireAuthenticatedUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type VocabularyPageProps = {
  searchParams: Promise<{ dataset?: string | string[] }>;
};

export default async function VocabularyPage({ searchParams }: VocabularyPageProps) {
  await requireAuthenticatedUser();
  const query = await searchParams;
  const requestedDatasetId = typeof query.dataset === "string" ? query.dataset : query.dataset ? "" : undefined;
  const resolution = await resolveVocabularyDataset(requestedDatasetId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-brand-text">PTE Study</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Vocabulary</h1>
        <p className="mt-3 text-sm text-muted-foreground">Signed in.</p>
      </section>
      <DatasetPicker
        action="/vocabulary"
        label="Vocabulary"
        noun={{ singular: "entry", plural: "entries" }}
        options={resolution.options}
        dataset={resolution.dataset}
      />
      <StudyRunner
        key={`vocabulary:${resolution.dataset.id}`}
        typeKey="vocabulary"
        datasetId={resolution.dataset.id}
        datasetLabel={resolution.dataset.label}
        datasetCount={resolution.dataset.count}
        available={resolution.dataset.status === "available" || resolution.dataset.status === "empty"}
      />
    </div>
  );
}
