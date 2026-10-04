"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { WriteFromDictationItem } from "./content";

type ExerciseProps = {
  item: WriteFromDictationItem;
};

const ASCII_EDGE_PUNCTUATION =
  /^[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]+|[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]+$/g;

function normalizeWords(value: string): string[] {
  const trimmed = value.toLowerCase().trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\s+/)
    .map((token) => token.replace(ASCII_EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

function longestCommonSubsequence(expected: string[], response: string[]): string[] {
  const lengths = Array.from({ length: expected.length + 1 }, () =>
    Array<number>(response.length + 1).fill(0),
  );

  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    for (
      let responseIndex = 1;
      responseIndex <= response.length;
      responseIndex += 1
    ) {
      if (expected[expectedIndex - 1] === response[responseIndex - 1]) {
        lengths[expectedIndex][responseIndex] =
          lengths[expectedIndex - 1][responseIndex - 1] + 1;
      } else {
        lengths[expectedIndex][responseIndex] = Math.max(
          lengths[expectedIndex - 1][responseIndex],
          lengths[expectedIndex][responseIndex - 1],
        );
      }
    }
  }

  const matched: string[] = [];
  let expectedIndex = expected.length;
  let responseIndex = response.length;

  while (expectedIndex > 0 && responseIndex > 0) {
    if (expected[expectedIndex - 1] === response[responseIndex - 1]) {
      matched.push(expected[expectedIndex - 1]);
      expectedIndex -= 1;
      responseIndex -= 1;
    } else if (
      lengths[expectedIndex - 1][responseIndex] >=
      lengths[expectedIndex][responseIndex - 1]
    ) {
      expectedIndex -= 1;
    } else {
      responseIndex -= 1;
    }
  }

  return matched.reverse();
}

function subscribeToSpeechSupport(): () => void {
  return () => {};
}

function getSpeechSupportSnapshot(): boolean {
  return (
    "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
  );
}

function getSpeechSupportServerSnapshot(): boolean {
  return false;
}

function selectEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const preferredLanguages = ["en-AU", "en-GB", "en-US"];

  for (const language of preferredLanguages) {
    const voice = voices.find(
      (candidate) => candidate.lang.toLowerCase() === language.toLowerCase(),
    );
    if (voice) {
      return voice;
    }
  }

  return voices.find((voice) => voice.lang.toLowerCase().startsWith("en-"));
}

export default function WriteFromDictationExercise({ item }: ExerciseProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  const expectedWords = useMemo(() => normalizeWords(item.sentence), [item.sentence]);
  const responseWords = useMemo(() => normalizeWords(response), [response]);
  const matchedWords = useMemo(
    () =>
      checked ? longestCommonSubsequence(expectedWords, responseWords) : [],
    [checked, expectedWords, responseWords],
  );

  function playSentence() {
    if (!speechSupported || playbackUsed) {
      return;
    }

    setPlaybackError(null);

    try {
      const utterance = new SpeechSynthesisUtterance(item.sentence);
      const voice = selectEnglishVoice(window.speechSynthesis.getVoices());

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
      setPlaybackUsed(true);
    } catch {
      setPlaybackError("Speech playback failed in this browser.");
    }
  }

  function reset() {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setPlaybackUsed(false);
    setPlaybackError(null);
    setResponse("");
    setChecked(false);
    setRevealed(false);
  }

  const interactionDisabled = !speechSupported;

  return (
    <section
      className="practice-exercise wfd-exercise"
      aria-labelledby="practice-item-title"
    >
      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis. Playback and typed practice
          are disabled for this item.
        </p>
      ) : null}

      <div className="practice-actions wfd-playback">
        <button
          disabled={interactionDisabled || playbackUsed}
          onClick={playSentence}
          type="button"
        >
          {playbackUsed ? "Played once" : "Play sentence"}
        </button>
      </div>

      {playbackError ? (
        <p className="practice-hint" role="alert">
          {playbackError}
        </p>
      ) : null}

      <label className="wfd-response">
        <span>Your response</span>
        <textarea
          disabled={interactionDisabled}
          onChange={(event) => {
            setResponse(event.target.value);
            setChecked(false);
            setRevealed(false);
          }}
          placeholder="Type the sentence you heard."
          rows={4}
          value={response}
        />
      </label>

      <p className="practice-hint">
        Local practice accuracy only — not a Pearson score or points. Browser TTS
        does not reproduce Pearson voice, accent, or acoustic conditions.
      </p>

      <div className="practice-actions">
        <button
          disabled={interactionDisabled || !playbackUsed}
          onClick={() => {
            setChecked(true);
            setRevealed(true);
          }}
          type="button"
        >
          Check
        </button>
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {checked ? (
        <div className="practice-result" aria-live="polite">
          <p className="practice-score">
            Practice word accuracy: {matchedWords.length} / {expectedWords.length}
          </p>

          {revealed ? (
            <div className="wfd-comparison">
              <p>
                <strong>Expected sentence:</strong> {item.sentence}
              </p>
              <p>
                <strong>Your normalized words:</strong>{" "}
                {responseWords.length > 0 ? responseWords.join(" ") : "(none)"}
              </p>
              <p>
                <strong>Matched in order:</strong>{" "}
                {matchedWords.length > 0 ? matchedWords.join(" ") : "(none)"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
