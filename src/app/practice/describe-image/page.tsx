import Link from "next/link";

import DescribeImageChart from "./chart";
import { listDescribeImageItems } from "./content";
import DescribeImageExercise from "./exercise";

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

export default async function DescribeImagePracticePage({
  searchParams,
}: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSlug = firstValue(resolvedSearchParams?.item);
  const items = await listDescribeImageItems();

  if (items.length === 0) {
    return (
      <main className="study-shell">
        <Link className="study-back" href="/practice">
          ← Practice
        </Link>
        <p className="study-eyebrow">Speaking practice</p>
        <h1>Describe Image</h1>
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
        <Link href="/study/describe-image-template">Study the Describe Image template</Link>
      </div>

      <header className="practice-header">
        <p className="study-eyebrow">Speaking · Describe Image</p>
        <h1 id="practice-item-title">{selectedItem.title}</h1>
        <p className="study-intro">
          Inspect the synthetic chart, prepare for 25 seconds, then record one
          response of up to 40 seconds. Local Whisper provides a transcript for
          self-review only.
        </p>
        <div className="study-card__meta">
          <span>{formatPracticeLabel(selectedItem.difficulty)}</span>
          <span>
            Item {selectedIndex + 1} of {items.length}
          </span>
        </div>
      </header>

      <DescribeImageChart item={selectedItem} />
      <DescribeImageExercise item={selectedItem} key={selectedItem.slug} />

      <nav className="practice-pager" aria-label="Practice item navigation">
        {previous ? (
          <Link href={`/practice/describe-image?item=${previous.slug}`}>
            ← Previous item
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/practice/describe-image?item=${next.slug}`}>
            Next item →
          </Link>
        ) : null}
      </nav>

      <nav className="practice-item-list" aria-label="All Describe Image items">
        <p>Choose an item</p>
        <div>
          {items.map((item, index) => (
            <Link
              aria-current={item.slug === selectedItem.slug ? "page" : undefined}
              href={`/practice/describe-image?item=${item.slug}`}
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
