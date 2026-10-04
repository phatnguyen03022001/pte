import Link from "next/link";

import { listWriteEssayItems } from "./content";
import WriteEssayExercise from "./exercise";

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

export default async function WriteEssayPracticePage({
  searchParams,
}: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSlug = firstValue(resolvedSearchParams?.item);
  const items = await listWriteEssayItems();

  if (items.length === 0) {
    return (
      <main className="study-shell">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <p className="study-eyebrow">Writing practice</p>
        <h1>Write Essay</h1>
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
        <Link href="/study/write-essay-strategy">Study the strategy</Link>
      </div>

      <header className="practice-header">
        <p className="study-eyebrow">Writing · Write Essay</p>
        <h1 id="practice-item-title">{selectedItem.title}</h1>
        <p className="study-intro">
          Draft a 200–300-word response using the 20-minute practice timer, then
          check only the local word-count target and reveal planning ideas for
          self-review.
        </p>
        <div className="study-card__meta">
          <span>{formatPracticeLabel(selectedItem.difficulty)}</span>
          <span>
            {selectedIndex + 1} of {items.length}
          </span>
        </div>
      </header>

      <article className="write-essay-prompt" aria-label="Essay prompt">
        <h2>Prompt</h2>
        <p>{selectedItem.prompt}</p>
      </article>

      <WriteEssayExercise item={selectedItem} key={selectedItem.slug} />

      <nav className="practice-pager" aria-label="Practice item navigation">
        {previous ? (
          <Link href={`/practice/write-essay?item=${previous.slug}`}>
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/practice/write-essay?item=${next.slug}`}>
            {next.title} →
          </Link>
        ) : null}
      </nav>

      <nav className="practice-item-list" aria-label="All Write Essay items">
        <p>Choose an item</p>
        <div>
          {items.map((item) => (
            <Link
              aria-current={item.slug === selectedItem.slug ? "page" : undefined}
              href={`/practice/write-essay?item=${item.slug}`}
              key={item.slug}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
