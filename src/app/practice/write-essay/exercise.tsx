"use client";

import { useEffect, useMemo, useState } from "react";

import type { WriteEssayItem } from "./content";

type ExerciseProps = {
  item: WriteEssayItem;
};

const TOTAL_SECONDS = 20 * 60;

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function WriteEssayExercise({ item }: ExerciseProps) {
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
  const withinTarget = wordCount >= 200 && wordCount <= 300;

  function reset() {
    setResponse("");
    setChecked(false);
    setRevealed(false);
    setRemainingSeconds(TOTAL_SECONDS);
    setRunning(false);
  }

  return (
    <section
      className="practice-exercise write-essay-exercise"
      aria-labelledby="practice-item-title"
    >
      <div className="write-essay-timer" aria-live="polite">
        <div>
          <span className="write-essay-timer__label">Practice timer</span>
          <strong>{formatTime(remainingSeconds)}</strong>
        </div>
        <div className="practice-actions write-essay-timer__actions">
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

      <label className="write-essay-response">
        <span>Your essay</span>
        <textarea
          aria-describedby="write-essay-form-note write-essay-word-count"
          onChange={(event) => {
            setResponse(event.target.value);
            setChecked(false);
          }}
          rows={16}
          value={response}
        />
      </label>

      <p className="write-essay-word-count" id="write-essay-word-count">
        Word count: {wordCount}
      </p>
      <p className="practice-hint" id="write-essay-form-note">
        Local practice form guidance only. It checks the 200–300-word range,
        does not assess writing quality, and does not produce a score.
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
          Reveal planning ideas
        </button>
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {checked ? (
        <div className="practice-result" aria-live="polite">
          <p className="practice-score">
            {withinTarget
              ? "Pass: draft is within the 200–300-word practice target."
              : wordCount < 200
                ? `Below target: ${wordCount} words. Aim for at least 200 words.`
                : `Above target: ${wordCount} words. Aim for no more than 300 words.`}
          </p>
        </div>
      ) : null}

      {revealed ? (
        <div className="practice-result write-essay-planning">
          <p className="practice-score">Planning ideas for self-review</p>
          <p className="practice-hint">
            These project-authored prompts are for self-review, not an official
            Pearson answer or model essay.
          </p>
          <ol>
            {item.planningPoints.map((planningPoint) => (
              <li key={planningPoint}>{planningPoint}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
