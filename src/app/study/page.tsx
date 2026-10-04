import Link from "next/link";

import {
  STUDY_SKILLS,
  STUDY_TYPES,
  formatStudyLabel,
  listStudyItems,
  parseStudySkill,
  parseStudyType,
} from "./content";

type StudyPageProps = {
  searchParams?: Promise<{
    skill?: string | string[];
    type?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudyPage({ searchParams }: StudyPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawSkill = firstValue(resolvedSearchParams?.skill);
  const rawType = firstValue(resolvedSearchParams?.type);
  const skill = parseStudySkill(rawSkill);
  const type = parseStudyType(rawType);
  const invalidFilter = Boolean((rawSkill && !skill) || (rawType && !type));

  const items = await listStudyItems({ skill, type });

  return (
    <main className="study-shell">
      <div className="study-header">
        <Link className="study-back" href="/">
          ← Home
        </Link>
        <p className="study-eyebrow">Study</p>
        <h1>Practical PTE guides for focused preparation.</h1>
        <p className="study-intro">
          Browse concise strategies, templates, playbooks, and plans. Everything here is
          served from the active Study library.
        </p>
      </div>

      <form className="study-filters" action="/study" method="get">
        <label>
          Skill
          <select name="skill" defaultValue={skill ?? ""}>
            <option value="">All skills</option>
            {STUDY_SKILLS.map((value) => (
              <option key={value} value={value}>
                {formatStudyLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Content type
          <select name="type" defaultValue={type ?? ""}>
            <option value="">All types</option>
            {STUDY_TYPES.map((value) => (
              <option key={value} value={value}>
                {formatStudyLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <div className="study-filter-actions">
          <button type="submit">Apply filters</button>
          <Link href="/study">Clear</Link>
        </div>
      </form>

      {invalidFilter ? (
        <p className="study-notice">Unsupported filter values were ignored.</p>
      ) : null}

      <section className="study-grid" aria-label="Study library">
        {items.length === 0 ? (
          <p className="study-empty">No active Study items match these filters.</p>
        ) : (
          items.map((item) => (
            <article className="study-card" key={item.slug}>
              <div className="study-card__meta">
                <span>{formatStudyLabel(item.type)}</span>
                {item.target_score !== null ? <span>Target {item.target_score}+</span> : null}
              </div>
              <h2>
                <Link href={`/study/${item.slug}`}>{item.title}</Link>
              </h2>
              <dl className="study-card__details">
                <div>
                  <dt>Skill</dt>
                  <dd>{item.skill_code ? formatStudyLabel(item.skill_code) : "All skills"}</dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>{item.task_type ? formatStudyLabel(item.task_type) : "General"}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
