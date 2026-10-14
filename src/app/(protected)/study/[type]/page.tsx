import { notFound } from "next/navigation";

import { DatasetPicker } from "@/components/study/dataset-picker";
import { StudyRunner } from "@/components/study/study-runner";
import { resolveQuestionDataset } from "@/lib/datasets/engine";
import { requireAuthenticatedUser } from "@/lib/supabase/require-auth";
import { getQuestionTypeByKey } from "@/lib/study/question-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuestionTypePageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ dataset?: string | string[] }>;
};

export default async function QuestionTypePage({ params, searchParams }: QuestionTypePageProps) {
  await requireAuthenticatedUser();

  const [{ type }, query] = await Promise.all([params, searchParams]);
  const questionType = getQuestionTypeByKey(type);

  if (!questionType) notFound();

  const requestedDatasetId = typeof query.dataset === "string" ? query.dataset : query.dataset ? "" : undefined;
  const resolution = await resolveQuestionDataset(questionType.key, requestedDatasetId);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-brand-text">
          Question {String(questionType.number).padStart(2, "0")} · {questionType.code.toUpperCase()}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{questionType.label}</h1>
          <span className="rounded-md border bg-surface px-2 py-1 text-xs font-semibold text-muted-foreground">
            Priority: {questionType.priority}
          </span>
        </div>
      </section>
      <DatasetPicker
        action={questionType.href}
        label={questionType.label}
        noun={{ singular: "question", plural: "questions" }}
        options={resolution.options}
        dataset={resolution.dataset}
      />
      <StudyRunner
        key={`${questionType.key}:${resolution.dataset.id}`}
        typeKey={questionType.key}
        datasetId={resolution.dataset.id}
        datasetLabel={resolution.dataset.label}
        datasetCount={resolution.dataset.count}
        available={resolution.dataset.status === "available" || resolution.dataset.status === "empty"}
      />
    </div>
  );
}
