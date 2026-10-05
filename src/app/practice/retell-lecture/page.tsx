import Link from "next/link";

import { listRetellLectureItems } from "./content";
import RetellLectureExercise from "./exercise";

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

export default async function RetellLecturePracticePage({
  searchParams,
}: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSlug = firstValue(resolvedSearchParams?.item);
  const items = await listRetellLectureItems();

  if (items.length === 0) {
    return (
      <main className="study-shell">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <p className="study-eyebrow">Listening · Speaking practice</p>
        <h1>Retell Lecture</h1>
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
        <Link href="/study/retell-lecture-strategy">Study the strategy</Link>
      </div>

      <header className="practice-header">
        <p className="study-eyebrow">Listening · Speaking · Retell Lecture</p>
        <h1 id="practice-item-title">{selectedItem.title}</h1>
        <p className="study-intro">
          In PTE the lecture starts automatically. This browser practice requires one
          Play lecture action, then gives 10 seconds to prepare and one response of
          up to 40 seconds.
        </p>
        <div className="study-card__meta">
          <span>{formatPracticeLabel(selectedItem.difficulty)}</span>
          <span>
            Item {selectedIndex + 1} of {items.length}
          </span>
        </div>
      </header>

      <RetellLectureExercise item={selectedItem} key={selectedItem.slug} />

      <nav className="practice-pager" aria-label="Practice item navigation">
        {previous ? (
          <Link href={`/practice/retell-lecture?item=${previous.slug}`}>
            ← Previous item
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/practice/retell-lecture?item=${next.slug}`}>
            Next item →
          </Link>
        ) : null}
      </nav>

      <nav className="practice-item-list" aria-label="All Retell Lecture items">
        <p>Choose an item</p>
        <div>
          {items.map((item, index) => (
            <Link
              aria-current={item.slug === selectedItem.slug ? "page" : undefined}
              href={`/practice/retell-lecture?item=${item.slug}`}
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
