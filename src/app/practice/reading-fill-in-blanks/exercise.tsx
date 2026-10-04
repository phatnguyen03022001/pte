"use client";

import { useState } from "react";

import type { ReadingFillInBlanksItem } from "./content";

type ExerciseProps = {
  item: ReadingFillInBlanksItem;
};

export default function ReadingFillInBlanksExercise({ item }: ExerciseProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const allAnswered = item.blanks.every((blank) => Boolean(selections[blank.id]));
  const correctCount = item.blanks.filter(
    (blank) => selections[blank.id] === blank.answer,
  ).length;

  function choose(blankId: string, value: string) {
    setSelections((current) => ({ ...current, [blankId]: value }));
    setChecked(false);
  }

  function reset() {
    setSelections({});
    setChecked(false);
  }

  const passageParts = item.passageTemplate.split(/(\{\{b\d+\}\})/g);

  return (
    <section className="practice-exercise" aria-labelledby="practice-item-title">
      <div className="practice-passage">
        <p>
          {passageParts.map((part, index) => {
            const match = /^\{\{(b\d+)\}\}$/.exec(part);
            if (!match) {
              return <span key={`text-${index}`}>{part}</span>;
            }

            const blank = item.blanks.find((candidate) => candidate.id === match[1]);
            if (!blank) {
              return null;
            }

            const blankNumber = item.blanks.indexOf(blank) + 1;

            return (
              <select
                aria-label={`Blank ${blankNumber}`}
                className="practice-blank"
                key={blank.id}
                onChange={(event) => choose(blank.id, event.target.value)}
                value={selections[blank.id] ?? ""}
              >
                <option value="">Choose…</option>
                {blank.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            );
          })}
        </p>
      </div>

      <div className="practice-actions">
        <button
          disabled={!allAnswered}
          onClick={() => setChecked(true)}
          type="button"
        >
          Check answers
        </button>
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {!allAnswered ? (
        <p className="practice-hint">Choose an answer for all blanks before checking.</p>
      ) : null}

      {checked ? (
        <div className="practice-result" aria-live="polite">
          <p className="practice-score">
            Practice accuracy: {correctCount} / {item.blanks.length}
          </p>
          <ol className="practice-feedback">
            {item.blanks.map((blank, index) => {
              const correct = selections[blank.id] === blank.answer;

              return (
                <li key={blank.id}>
                  <strong>
                    Blank {index + 1}: {correct ? "Correct" : "Incorrect"}
                  </strong>
                  <span>
                    {" "}
                    Correct answer: {blank.answer}. {blank.explanation}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
