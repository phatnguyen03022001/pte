"use client";

import { useState } from "react";

import type {
  ReadingMultipleChoiceMultipleAnswersItem,
  ReadingMultipleChoiceMultipleAnswersResult,
} from "./content";

type ExerciseProps = {
  item: ReadingMultipleChoiceMultipleAnswersItem;
};

function isResultResponse(
  value: unknown,
): value is ReadingMultipleChoiceMultipleAnswersResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReadingMultipleChoiceMultipleAnswersResult>;

  return (
    Array.isArray(candidate.correctIndexes) &&
    candidate.correctIndexes.length === 2 &&
    candidate.correctIndexes.every(
      (index) => Number.isInteger(index) && index >= 0 && index <= 4,
    ) &&
    new Set(candidate.correctIndexes).size === 2 &&
    typeof candidate.explanationText === "string" &&
    candidate.explanationText.trim().length > 0
  );
}

export default function ReadingMultipleChoiceMultipleAnswersExercise({
  item,
}: ExerciseProps) {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [result, setResult] =
    useState<ReadingMultipleChoiceMultipleAnswersResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function toggleOption(index: number) {
    if (result || submitting) {
      return;
    }

    setSelectedIndexes((current) =>
      current.includes(index)
        ? current.filter((candidate) => candidate !== index)
        : [...current, index].sort((left, right) => left - right),
    );
    setLocalError(null);
  }

  function reset() {
    setSelectedIndexes([]);
    setResult(null);
    setSubmitting(false);
    setLocalError(null);
  }

  async function submit() {
    if (selectedIndexes.length === 0 || result || submitting) {
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      const response = await fetch(
        "/practice/reading-multiple-choice-multiple-answers/review",
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: item.slug,
            selectedIndexes,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Review request failed.");
      }

      const payload: unknown = await response.json();
      if (!isResultResponse(payload)) {
        throw new Error("Review contract is invalid.");
      }

      setResult(payload);
    } catch {
      setLocalError(
        "Review could not be loaded. Keep your selections and try Submit again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCorrect =
    result?.correctIndexes.filter((index) => selectedIndexes.includes(index))
      .length ?? 0;
  const selectedIncorrect = result
    ? selectedIndexes.filter((index) => !result.correctIndexes.includes(index))
        .length
    : 0;
  const rawScore = result
    ? Math.max(0, selectedCorrect - selectedIncorrect)
    : null;

  return (
    <section className="practice-exercise" aria-labelledby="practice-item-title">
      <div className="practice-passage">
        <p>{item.passageText}</p>
      </div>

      <fieldset className="practice-mcma">
        <legend>{item.questionText}</legend>
        <div className="practice-mcma__options">
          {item.options.map((option, index) => {
            const selected = selectedIndexes.includes(index);
            const isCorrect = result?.correctIndexes.includes(index) ?? false;
            const feedback = result
              ? selected && isCorrect
                ? "Correct"
                : selected
                  ? "Incorrect"
                  : isCorrect
                    ? "Missed correct option"
                    : null
              : null;

            return (
              <label className="practice-mcma__option" key={option}>
                <input
                  checked={selected}
                  disabled={Boolean(result) || submitting}
                  onChange={() => toggleOption(index)}
                  type="checkbox"
                />
                <span>{option}</span>
                {feedback ? (
                  <strong className="practice-mcma__feedback"> — {feedback}</strong>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="practice-actions">
        <button
          disabled={selectedIndexes.length === 0 || Boolean(result) || submitting}
          onClick={submit}
          type="button"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {selectedIndexes.length === 0 && !result ? (
        <p className="practice-hint">Select at least one option before submitting.</p>
      ) : null}

      {localError ? (
        <p className="practice-error" role="alert">
          {localError}
        </p>
      ) : null}

      {result && rawScore !== null ? (
        <div className="practice-result" aria-live="polite">
          <p className="practice-score">
            Practice raw item score: {rawScore} / 2
          </p>
          <p>
            Scoring here is +1 for each selected correct option and -1 for each
            selected incorrect option, with a minimum item score of 0.
          </p>
          <p>
            This raw item score is not a scaled PTE Reading score, overall score,
            or score prediction.
          </p>
          <p>
            <strong>Explanation:</strong> {result.explanationText}
          </p>
        </div>
      ) : null}
    </section>
  );
}
