import Link from "next/link";

import { listReadingMultipleChoiceMultipleAnswersItems } from "./content";
import ReadingMultipleChoiceMultipleAnswersExercise from "./exercise";

type PracticePageProps = {
  searchParams?: Promise<{ item?: string | string[] }>;
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

export default async function ReadingMultipleChoiceMultipleAnswersPracticePage({
  searchParams,
}: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSlug = firstValue(resolvedSearchParams?.item);
  const items = await listReadingMultipleChoiceMultipleAnswersItems();

  if (items.length === 0) {
    return (
      <main className="study-shell">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <p className="study-eyebrow">Reading practice</p>
        <h1>Multiple Choice, Multiple Answers</h1>
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
        <Link href="/study/reading-mcma-strategy">Study the strategy</Link>
      </div>

      <header className="practice-header">
        <p className="study-eyebrow">Reading · Multiple Choice, Multiple Answers</p>
        <h1 id="practice-item-title">{selectedItem.title}</h1>
        <p className="study-intro">
          Select only statements supported by the passage. This practice raw item
          score mirrors the fixed-answer marking logic for this item; it is not a
          scaled PTE Reading score, overall score, or score prediction.
        </p>
        <div className="study-card__meta">
          <span>{formatPracticeLabel(selectedItem.difficulty)}</span>
          <span>
            Item {selectedIndex + 1} of {items.length}
          </span>
        </div>
      </header>

      <ReadingMultipleChoiceMultipleAnswersExercise
        item={selectedItem}
        key={selectedItem.slug}
      />

      <nav className="practice-pager" aria-label="Practice item navigation">
        {previous ? (
          <Link
            href={`/practice/reading-multiple-choice-multiple-answers?item=${previous.slug}`}
          >
            ← Previous item
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/practice/reading-multiple-choice-multiple-answers?item=${next.slug}`}
          >
            Next item →
          </Link>
        ) : null}
      </nav>

      <nav
        className="practice-item-list"
        aria-label="All Reading Multiple Choice, Multiple Answers items"
      >
        <p>Choose an item</p>
        <div>
          {items.map((item, index) => (
            <Link
              aria-current={item.slug === selectedItem.slug ? "page" : undefined}
              href={`/practice/reading-multiple-choice-multiple-answers?item=${item.slug}`}
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
