import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatStudyLabel, getStudyItem, safeSourceUrl } from "../content";

type StudyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StudyDetailPage({ params }: StudyDetailPageProps) {
  const { slug } = await params;
  const item = await getStudyItem(slug);

  if (!item) {
    notFound();
  }

  const sourceUrl = safeSourceUrl(item.source_ref);

  return (
    <main className="study-shell study-detail">
      <Link className="study-back" href="/study">
        ← Study library
      </Link>

      <article>
        <header className="study-detail__header">
          <div className="study-card__meta">
            <span>{formatStudyLabel(item.type)}</span>
            {item.skill_code ? <span>{formatStudyLabel(item.skill_code)}</span> : null}
            {item.task_type ? <span>{formatStudyLabel(item.task_type)}</span> : null}
            {item.target_score !== null ? <span>Target {item.target_score}+</span> : null}
          </div>
          <h1>{item.title}</h1>
        </header>

        <div className="study-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body_markdown}</ReactMarkdown>
        </div>

        {item.slug === "reading-fill-in-blanks-dropdown-strategy" ? (
          <p className="study-practice-link">
            <Link href="/practice/reading-fill-in-blanks">
              Practice Reading Fill in the Blanks (Dropdown) →
            </Link>
          </p>
        ) : null}

        {item.slug === "summarize-written-text-strategy" ? (
          <p className="study-practice-link">
            <Link href="/practice/summarize-written-text">
              Practice Summarize Written Text →
            </Link>
          </p>
        ) : null}

        {item.slug === "write-essay-strategy" ? (
          <p className="study-practice-link">
            <Link href="/practice/write-essay">Practice Write Essay →</Link>
          </p>
        ) : null}

        {item.slug === "write-from-dictation-strategy" ? (
          <p className="study-practice-link">
            <Link href="/practice/write-from-dictation">
              Practice Write from Dictation →
            </Link>
          </p>
        ) : null}

        {sourceUrl ? (
          <p className="study-source">
            Reference:{" "}
            <a href={sourceUrl} rel="noreferrer">
              Pearson PTE
            </a>
          </p>
        ) : null}
      </article>
    </main>
  );
}
