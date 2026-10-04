import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="landing__content">
        <p className="landing__eyebrow">PTE Academic</p>
        <h1>Practice with a clear path forward.</h1>
        <p className="landing__summary">
          A free-first workspace for focused PTE learning and practice.
        </p>
        <div className="landing__actions">
          <Link className="landing__cta" href="/study">
            Open Study library
          </Link>
          <Link className="landing__cta landing__cta--secondary" href="/practice">
            Start Practice
          </Link>
        </div>
      </section>
    </main>
  );
}
