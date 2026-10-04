import Link from "next/link";

export default function PracticePage() {
  return (
    <main className="study-shell">
      <div className="study-header">
        <Link className="study-back" href="/">
          ← Home
        </Link>
        <p className="study-eyebrow">Practice</p>
        <h1>Focused drills for current PTE task types.</h1>
        <p className="study-intro">
          Practice focused PTE task types with original project-authored content and
          task-specific self-review.
        </p>
      </div>

      <section className="study-grid" aria-label="Practice task types">
        <article className="study-card">
          <div className="study-card__meta">
            <span>Reading</span>
          </div>
          <h2>Fill in the Blanks (Dropdown)</h2>
          <p>
            Complete short original passages, check all blanks, and review per-blank
            feedback.
          </p>
          <Link href="/practice/reading-fill-in-blanks">Open practice →</Link>
        </article>

        <article className="study-card">
          <div className="study-card__meta">
            <span>Writing</span>
          </div>
          <h2>Summarize Written Text</h2>
          <p>
            Write one sentence from an original passage, check local form rules, and
            reveal key ideas for self-review.
          </p>
          <Link href="/practice/summarize-written-text">Open practice →</Link>
        </article>
      </section>
    </main>
  );
}
