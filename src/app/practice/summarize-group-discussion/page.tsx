import Link from "next/link";

import { listSummarizeGroupDiscussionItems } from "./content";
import SummarizeGroupDiscussionExercise from "./exercise";

type PracticePageProps = {
  searchParams?: Promise<{
    item?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatPracticeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function SummarizeGroupDiscussionPracticePage({
  searchParams,
}: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSlug = firstValue(resolvedSearchParams?.item);
  const items = await listSummarizeGroupDiscussionItems();

  if (items.length === 0) {
    return (
      <main className="study-shell">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <p className="study-eyebrow">Listening · Speaking practice</p>
        <h1>Summarize Group Discussion</h1>
        <p className="study-empty">No active practice items are available.</p>
      </main>
    );
  }

  const selectedItem =
    items.find((item) => item.slug === requestedSlug) ?? items[0];
  const selectedIndex = items.findIndex((item) => item.slug === selectedItem.slug);
  const previous = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const next = selectedIndex < items.length - 1 ? items[selectedIndex + 1] : null;

  return (
    <main className="study-shell practice-shell">
      <div className="practice-topbar">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <Link href="/study/summarize-group-discussion-strategy">
          Study the strategy
        </Link>
      </div>

      <header className="practice-header">
        <p className="study-eyebrow">
          Listening · Speaking · Summarize Group Discussion
        </p>
        <h1 id="practice-item-title">{selectedItem.title}</h1>
        <p className="study-intro">
          Pearson plays the discussion automatically. This browser practice waits
          for local STT, then uses one explicit Play discussion action, a 10-second
          preparation window, and one spoken summary of up to 120 seconds.
        </p>
        <div className="study-card__meta">
          <span>{formatPracticeLabel(selectedItem.difficulty)}</span>
          <span>
            Item {selectedIndex + 1} of {items.length}
          </span>
        </div>
      </header>

      <SummarizeGroupDiscussionExercise
        item={selectedItem}
        key={selectedItem.slug}
      />

      <nav className="practice-pager" aria-label="Practice item navigation">
        {previous ? (
          <Link
            href={`/practice/summarize-group-discussion?item=${previous.slug}`}
          >
            ← Previous item
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/practice/summarize-group-discussion?item=${next.slug}`}>
            Next item →
          </Link>
        ) : null}
      </nav>

      <nav
        className="practice-item-list"
        aria-label="All Summarize Group Discussion items"
      >
        <p>Choose an item</p>
        <div>
          {items.map((item, index) => (
            <Link
              aria-current={item.slug === selectedItem.slug ? "page" : undefined}
              href={`/practice/summarize-group-discussion?item=${item.slug}`}
              key={item.slug}
            >
              Item {index + 1}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
