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

        <article className="study-card">
          <div className="study-card__meta">
            <span>Writing</span>
          </div>
          <h2>Write Essay</h2>
          <p>
            Draft an original essay under a 20-minute timer, check the local word
            target, and reveal planning ideas for self-review.
          </p>
          <Link href="/practice/write-essay">Open practice →</Link>
        </article>

        <article className="study-card">
          <div className="study-card__meta">
            <span>Listening</span>
            <span>Writing</span>
          </div>
          <h2>Write from Dictation</h2>
          <p>
            Listen once with browser speech, type the sentence from memory, and
            check local word-sequence accuracy.
          </p>
          <Link href="/practice/write-from-dictation">Open practice →</Link>
        </article>

        <article className="study-card">
          <div className="study-card__meta">
            <span>Listening</span>
            <span>Speaking</span>
          </div>
          <h2>Repeat Sentence</h2>
          <p>
            Hear one browser-speech practice prompt, record one response, and
            transcribe it locally with Whisper for content-sequence feedback.
          </p>
          <Link href="/practice/repeat-sentence">Open practice →</Link>
        </article>

        <article className="study-card">
          <div className="study-card__meta">
            <span>Speaking</span>
            <span>Reading</span>
          </div>
          <h2>Read Aloud</h2>
          <p>
            Read a visible original passage once, transcribe it locally with Whisper,
            and review transcript-based content coverage.
          </p>
          <Link href="/practice/read-aloud">Open practice →</Link>
        </article>
      </section>
    </main>
  );
}
