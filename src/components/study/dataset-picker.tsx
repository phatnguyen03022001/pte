import { Button } from "@/components/ui/button";
import type { DatasetOption } from "@/lib/datasets/engine";

type DatasetPickerProps = {
  action: string;
  label: string;
  noun: { singular: string; plural: string };
  options: DatasetOption[];
  dataset: DatasetOption;
};

function optionLabel(option: DatasetOption, noun: DatasetPickerProps["noun"]): string {
  const quantity = `${option.count} ${option.count === 1 ? noun.singular : noun.plural}`;
  if (option.status === "missing") return `${option.label} — unavailable`;
  if (option.status === "invalid") return `${option.label} — invalid`;
  return `${option.label} — ${quantity}`;
}

export function DatasetPicker({ action, label, noun, options, dataset }: DatasetPickerProps) {
  const selectedId = dataset.status === "not-found" ? "" : dataset.id;
  const statusMessage = dataset.status === "available"
    ? `${dataset.count} ${dataset.count === 1 ? noun.singular : noun.plural} available.`
    : dataset.status === "empty"
      ? `This ${label.toLowerCase()} dataset is empty.`
      : dataset.message ?? "Choose an available dataset.";

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="dataset-heading">
      <h2 id="dataset-heading" className="text-base font-semibold">Dataset</h2>
      <form action={action} method="get" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor="dataset" className="text-sm font-medium">{label} dataset</label>
          <select
            id="dataset"
            name="dataset"
            defaultValue={selectedId}
            aria-describedby="dataset-help"
            className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>Choose a dataset</option>
            {options.map((option) => (
              <option
                key={option.id}
                value={option.id}
                disabled={option.status === "missing" || option.status === "invalid"}
              >
                {optionLabel(option, noun)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={options.every((option) => option.status === "missing" || option.status === "invalid")}>
          Apply dataset
        </Button>
      </form>
      <p id="dataset-help" className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {statusMessage}
      </p>
    </section>
  );
}
