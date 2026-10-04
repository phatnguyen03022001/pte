"use client";

import { useEffect, useMemo, useState } from "react";

import type { SummarizeWrittenTextItem } from "./content";

type ExerciseProps = {
  item: SummarizeWrittenTextItem;
};

const TOTAL_SECONDS = 10 * 60;

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SummarizeWrittenTextExercise({ item }: ExerciseProps) {
  const [response, setResponse] = useState("");
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  const wordCount = useMemo(() => countWords(response), [response]);
  const trimmed = response.trim();
  const fullStopCount = (response.match(/\./g) ?? []).length;

  const criteria = {
    wordCount: wordCount >= 5 && wordCount <= 75,
    uppercase: /^[A-Z]/.test(trimmed),
    oneFinalFullStop: fullStopCount === 1 && trimmed.endsWith("."),
  };
  const allPassed =
    criteria.wordCount && criteria.uppercase && criteria.oneFinalFullStop;

  function reset() {
    setResponse("");
    setChecked(false);
    setRevealed(false);
    setRemainingSeconds(TOTAL_SECONDS);
    setRunning(false);
  }

  return (
    <section className="practice-exercise swt-exercise" aria-labelledby="practice-item-title">
      <div className="swt-timer" aria-live="polite">
        <div>
          <span className="swt-timer__label">Practice timer</span>
          <strong>{formatTime(remainingSeconds)}</strong>
        </div>
        <div className="practice-actions swt-timer__actions">
          <button
            disabled={running || remainingSeconds === 0}
            onClick={() => setRunning(true)}
            type="button"
          >
            Start
          </button>
          <button
            className="practice-reset"
            disabled={!running}
            onClick={() => setRunning(false)}
            type="button"
          >
            Pause
          </button>
        </div>
      </div>

      {remainingSeconds === 0 ? (
        <p className="practice-hint" role="status">
          Time is up. Your draft is still available for self-review.
        </p>
      ) : null}

      <label className="swt-response">
        <span>Your one-sentence summary</span>
        <textarea
          aria-describedby="swt-form-note swt-word-count"
          onChange={(event) => {
            setResponse(event.target.value);
            setChecked(false);
          }}
          rows={7}
          value={response}
        />
      </label>

      <p className="swt-word-count" id="swt-word-count">
        Word count: {wordCount}
      </p>
      <p className="practice-hint" id="swt-form-note">
        Practice form checks only. They do not evaluate Content, Grammar, or
        Vocabulary and are not an official Pearson score.
      </p>

      <div className="practice-actions">
        <button onClick={() => setChecked(true)} type="button">
          Check form
        </button>
        <button
          className="practice-reset"
          onClick={() => setRevealed(true)}
          type="button"
        >
          Reveal key ideas
        </button>
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {checked ? (
        <div className="practice-result" aria-live="polite">
          <p className="practice-score">
            {allPassed
              ? "This response meets the local form checks."
              : "Review the local form checks below."}
          </p>
          <ul className="swt-checks">
            <li>
              <strong>{criteria.wordCount ? "Pass" : "Fail"}:</strong> 5–75
              whitespace-delimited words.
            </li>
            <li>
              <strong>{criteria.uppercase ? "Pass" : "Fail"}:</strong> begins
              with an uppercase Latin letter.
            </li>
            <li>
              <strong>{criteria.oneFinalFullStop ? "Pass" : "Fail"}:</strong>{" "}
              exactly one full stop, at the final non-whitespace character.
            </li>
          </ul>
        </div>
      ) : null}

      {revealed ? (
        <div className="practice-result swt-key-ideas">
          <p className="practice-score">Key ideas for self-review</p>
          <p className="practice-hint">
            These project-authored ideas are not an official Pearson answer key.
          </p>
          <ol>
            {item.keyPoints.map((keyPoint) => (
              <li key={keyPoint}>{keyPoint}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
