import { NavigationItem } from "@/components/layout/navigation-item";
import {
  QUESTION_SECTIONS,
  QUESTION_TYPES,
  VOCABULARY_NAVIGATION,
} from "@/lib/study/question-types";

export function NavigationList() {
  return (
    <nav aria-label="PTE study navigation" className="flex flex-col gap-5">
      {QUESTION_SECTIONS.map((section) => (
        <section key={section.key} aria-labelledby={`nav-${section.key}`}>
          <h2
            id={`nav-${section.key}`}
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {section.label}
          </h2>
          <ul className="flex flex-col gap-1">
            {QUESTION_TYPES.filter((questionType) => questionType.section === section.key).map(
              (questionType) => (
                <li key={questionType.key}>
                  <NavigationItem href={questionType.href}>
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {String(questionType.number).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{questionType.label}</span>
                    <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                      {questionType.priority}
                    </span>
                  </NavigationItem>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}

      <div className="border-t pt-4">
        <NavigationItem href={VOCABULARY_NAVIGATION.href}>
          <span className="min-w-0 flex-1 truncate">{VOCABULARY_NAVIGATION.label}</span>
        </NavigationItem>
      </div>
    </nav>
  );
}
