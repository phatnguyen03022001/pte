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
          Start with Reading Fill in the Blanks (Dropdown), then use the linked Study
          strategy to review how each choice works in context.
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
      </section>
    </main>
  );
}
