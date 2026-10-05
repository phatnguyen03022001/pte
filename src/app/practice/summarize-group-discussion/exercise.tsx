"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { decodeToMono16k, stopMediaTracks } from "@/lib/local-stt/audio";
import {
  LOCAL_STT_MODEL_ID,
  type LocalSttBackend,
  type LocalSttWorkerResponse,
} from "@/lib/local-stt/contract";

import type {
  DiscussionSpeaker,
  DiscussionTurn,
  SummarizeGroupDiscussionItem,
  SummarizeGroupDiscussionPrompt,
  SummarizeGroupDiscussionResult,
} from "./content";

type ExerciseProps = {
  item: SummarizeGroupDiscussionItem;
};

const PREPARATION_SECONDS = 10;
const RESPONSE_LIMIT_SECONDS = 120;
const RESPONSE_LIMIT_MS = RESPONSE_LIMIT_SECONDS * 1_000;
const PLAYBACK_RATE = 0.94;

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

function voicePriority(language: string): number {
  const normalized = language.toLowerCase();

  if (normalized === "en-au") {
    return 0;
  }
  if (normalized === "en-gb") {
    return 1;
  }
  if (normalized === "en-us") {
    return 2;
  }
  return 3;
}

function selectEnglishVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  const sorted = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("en-"))
    .toSorted(
      (left, right) =>
        voicePriority(left.lang) - voicePriority(right.lang) ||
        left.lang.localeCompare(right.lang) ||
        left.name.localeCompare(right.name) ||
        left.voiceURI.localeCompare(right.voiceURI),
    );

  const seen = new Set<string>();
  const distinct: SpeechSynthesisVoice[] = [];

  for (const voice of sorted) {
    const identity = voice.voiceURI || `${voice.name}|${voice.lang}`;
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    distinct.push(voice);

    if (distinct.length === 3) {
      break;
    }
  }

  return distinct;
}

function speakerVoiceIndex(speaker: DiscussionSpeaker): number {
  if (speaker === "A") {
    return 0;
  }
  if (speaker === "B") {
    return 1;
  }
  return 2;
}

function createSummarizeGroupDiscussionSttWorker(): Worker {
  return new Worker(new URL("./stt.worker.ts", import.meta.url), {
    type: "module",
  });
}

async function removeUnpinnedModelConfigCache(): Promise<void> {
  if (!("caches" in window)) {
    return;
  }

  const cache = await caches.open("transformers-cache");
  await cache.delete(
    `https://huggingface.co/${LOCAL_STT_MODEL_ID}/resolve/main/config.json`,
  );
}

function isTurn(value: unknown): value is DiscussionTurn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DiscussionTurn>;
  return (
    (candidate.speaker === "A" ||
      candidate.speaker === "B" ||
      candidate.speaker === "C") &&
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0
  );
}

function hasExpectedTurnOrder(turns: DiscussionTurn[]): boolean {
  const expected: DiscussionSpeaker[] = ["A", "B", "C", "A", "B", "C"];

  return (
    turns.length === expected.length &&
    turns.every((turn, index) => turn.speaker === expected[index])
  );
}

function isPromptResponse(
  value: unknown,
): value is SummarizeGroupDiscussionPrompt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SummarizeGroupDiscussionPrompt>;
  return (
    Array.isArray(candidate.turns) &&
    candidate.turns.every(isTurn) &&
    hasExpectedTurnOrder(candidate.turns)
  );
}

function isResultResponse(
  value: unknown,
): value is SummarizeGroupDiscussionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SummarizeGroupDiscussionResult>;
  return (
    Array.isArray(candidate.turns) &&
    candidate.turns.every(isTurn) &&
    hasExpectedTurnOrder(candidate.turns) &&
    Array.isArray(candidate.reviewPoints) &&
    candidate.reviewPoints.length === 5 &&
    candidate.reviewPoints.every(
      (point) => typeof point === "string" && point.trim().length > 0,
    )
  );
}

function sameTurns(left: DiscussionTurn[], right: DiscussionTurn[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (turn, index) =>
        turn.speaker === right[index]?.speaker && turn.text === right[index]?.text,
    )
  );
}

export default function SummarizeGroupDiscussionExercise({
  item,
}: ExerciseProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );

  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responseStartedAtRef = useRef(0);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prepRemainingRef = useRef(PREPARATION_SECONDS);
  const requestIdRef = useRef(0);
  const playbackRunRef = useRef(0);
  const promptRequestRef = useRef<AbortController | null>(null);
  const revealRequestRef = useRef<AbortController | null>(null);
  const backendRef = useRef<LocalSttBackend | null>(null);
  const promptRef = useRef<SummarizeGroupDiscussionPrompt | null>(null);

  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [speakingSpeaker, setSpeakingSpeaker] =
    useState<DiscussionSpeaker | null>(null);
  const [prepRunning, setPrepRunning] = useState(false);
  const [prepRemaining, setPrepRemaining] = useState(PREPARATION_SECONDS);
  const [prepComplete, setPrepComplete] = useState(false);
  const [recordingUsed, setRecordingUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [responseRemaining, setResponseRemaining] = useState(
    RESPONSE_LIMIT_SECONDS,
  );
  const [processing, setProcessing] = useState(false);
  const [sttState, setSttState] = useState<"idle" | "loading" | "ready">("idle");
  const [backend, setBackend] = useState<LocalSttBackend | null>(null);
  const [sttStatus, setSttStatus] = useState("Local STT is not prepared.");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] =
    useState<SummarizeGroupDiscussionResult | null>(null);
  const [reviewChecks, setReviewChecks] = useState([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [localError, setLocalError] = useState<string | null>(null);

  function clearPreparationTimer() {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
  }

  function clearResponseTimers() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (responseTimerRef.current) {
      clearInterval(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }

  function cancelRequests() {
    promptRequestRef.current?.abort();
    promptRequestRef.current = null;
    revealRequestRef.current?.abort();
    revealRequestRef.current = null;
  }

  function stopActiveRecording() {
    clearResponseTimers();

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    recorderRef.current = null;
    stopMediaTracks(streamRef.current);
    streamRef.current = null;
    setRecording(false);
  }

  function startPreparation(runId: number) {
    if (runId !== playbackRunRef.current) {
      return;
    }

    clearPreparationTimer();
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRemaining(PREPARATION_SECONDS);
    setPrepRunning(true);
    setPrepComplete(false);

    prepTimerRef.current = setInterval(() => {
      if (runId !== playbackRunRef.current) {
        clearPreparationTimer();
        return;
      }

      const next = Math.max(0, prepRemainingRef.current - 1);
      prepRemainingRef.current = next;
      setPrepRemaining(next);

      if (next === 0) {
        clearPreparationTimer();
        setPrepRunning(false);
        setPrepComplete(true);
      }
    }, 1_000);
  }

  function beginResponseCountdown() {
    responseStartedAtRef.current = Date.now();
    setResponseRemaining(RESPONSE_LIMIT_SECONDS);

    responseTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - responseStartedAtRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((RESPONSE_LIMIT_MS - elapsed) / 1_000),
      );
      setResponseRemaining(remaining);

      if (remaining === 0 && responseTimerRef.current) {
        clearInterval(responseTimerRef.current);
        responseTimerRef.current = null;
      }
    }, 200);
  }

  async function revealResult(transcriptText: string, requestId: number) {
    const controller = new AbortController();
    revealRequestRef.current?.abort();
    revealRequestRef.current = controller;

    try {
      const response = await fetch(
        `/practice/summarize-group-discussion/prompt?item=${encodeURIComponent(
          item.slug,
        )}&reveal=1`,
        { cache: "no-store", signal: controller.signal },
      );

      if (!response.ok) {
        throw new Error("Result request failed.");
      }

      const payload: unknown = await response.json();
      if (!isResultResponse(payload)) {
        throw new Error("Result contract is invalid.");
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (
        !promptRef.current ||
        !sameTurns(payload.turns, promptRef.current.turns)
      ) {
        throw new Error("Discussion changed during the response.");
      }

      setTranscript(transcriptText);
      setResult(payload);
      setProcessing(false);

      if (!transcriptText.trim()) {
        setLocalError(
          "Local STT returned an empty transcript. Reset this item to try again.",
        );
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      setProcessing(false);
      setLocalError(
        "The local transcript finished, but the discussion review could not be revealed. Reset this item and try again.",
      );
    } finally {
      if (revealRequestRef.current === controller) {
        revealRequestRef.current = null;
      }
    }
  }

  function ensureWorker(): Worker {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = createSummarizeGroupDiscussionSttWorker();

    worker.onmessage = async (event: MessageEvent<LocalSttWorkerResponse>) => {
      const message = event.data;

      if (message.type === "status") {
        setSttStatus(message.message);
        return;
      }

      if (message.type === "ready") {
        try {
          await removeUnpinnedModelConfigCache();
        } catch {
          backendRef.current = null;
          setBackend(null);
          setSttState("idle");
          setSttStatus("Local STT is not prepared.");
          setLocalError(
            "Local STT prepared, but the exact-revision cache boundary could not be verified. Try again.",
          );
          return;
        }

        backendRef.current = message.backend;
        setBackend(message.backend);
        setSttState("ready");
        setSttStatus(
          message.backend === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM",
        );
        return;
      }

      if (
        "requestId" in message &&
        message.requestId !== undefined &&
        message.requestId !== requestIdRef.current
      ) {
        return;
      }

      if (message.type === "result") {
        try {
          await removeUnpinnedModelConfigCache();
        } catch {
          setProcessing(false);
          setLocalError(
            "Local transcription finished, but the exact-revision cache boundary could not be verified. Reset and try again.",
          );
          return;
        }

        backendRef.current = message.backend;
        setBackend(message.backend);
        setSttState("ready");
        setSttStatus(
          message.backend === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM",
        );
        void revealResult(message.transcript, message.requestId);
        return;
      }

      setProcessing(false);
      setLocalError(message.message);

      if (message.requestId === undefined) {
        backendRef.current = null;
        setBackend(null);
        setSttState("idle");
        setSttStatus("Local STT is not prepared.");
      }
    };

    worker.onerror = () => {
      backendRef.current = null;
      setProcessing(false);
      setBackend(null);
      setSttState("idle");
      setSttStatus("Local STT is not prepared.");
      setLocalError(
        "Local STT worker failed. Reset this item and prepare local STT again.",
      );
    };

    workerRef.current = worker;
    return worker;
  }

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      playbackRunRef.current += 1;
      cancelRequests();
      clearPreparationTimer();
      clearResponseTimers();

      if (speechSupported) {
        window.speechSynthesis.cancel();
      }

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      stopMediaTracks(streamRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [speechSupported]);

  function prepareLocalStt() {
    if (sttState !== "idle") {
      return;
    }

    setLocalError(null);
    setSttState("loading");
    setSttStatus("Preparing local STT...");
    ensureWorker().postMessage({ type: "prepare" });
  }

  async function playDiscussion() {
    if (
      !speechSupported ||
      sttState !== "ready" ||
      playbackUsed ||
      playbackLoading ||
      playbackRunning ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setResult(null);
    setTranscript("");
    setReviewChecks([false, false, false, false, false]);
    setPlaybackLoading(true);
    setPlaybackComplete(false);
    setSpeakingSpeaker(null);
    setPrepRunning(false);
    setPrepComplete(false);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRemaining(PREPARATION_SECONDS);

    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    const controller = new AbortController();
    promptRequestRef.current = controller;

    try {
      const response = await fetch(
        `/practice/summarize-group-discussion/prompt?item=${encodeURIComponent(
          item.slug,
        )}`,
        { cache: "no-store", signal: controller.signal },
      );

      if (!response.ok) {
        throw new Error("Prompt request failed.");
      }

      const payload: unknown = await response.json();
      if (!isPromptResponse(payload)) {
        throw new Error("Prompt contract is invalid.");
      }

      if (runId !== playbackRunRef.current) {
        return;
      }

      promptRef.current = payload;
      const voices = selectEnglishVoices(window.speechSynthesis.getVoices());

      const speakTurn = (index: number) => {
        if (runId !== playbackRunRef.current) {
          return;
        }

        if (index >= payload.turns.length) {
          setSpeakingSpeaker(null);
          setPlaybackRunning(false);
          setPlaybackComplete(true);
          startPreparation(runId);
          return;
        }

        const turn = payload.turns[index];
        const utterance = new SpeechSynthesisUtterance(turn.text);
        const voice =
          voices.length > 0
            ? voices[speakerVoiceIndex(turn.speaker) % voices.length]
            : undefined;

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-AU";
        }

        utterance.rate = PLAYBACK_RATE;
        utterance.onend = () => {
          if (runId !== playbackRunRef.current) {
            return;
          }

          speakTurn(index + 1);
        };
        utterance.onerror = () => {
          if (runId !== playbackRunRef.current) {
            return;
          }

          window.speechSynthesis.cancel();
          setSpeakingSpeaker(null);
          setPlaybackRunning(false);
          setPlaybackComplete(false);
          setLocalError(
            "Discussion playback failed. Reset this item before trying again.",
          );
        };

        setSpeakingSpeaker(turn.speaker);
        window.speechSynthesis.speak(utterance);
      };

      setPlaybackUsed(true);
      setPlaybackLoading(false);
      setPlaybackRunning(true);
      speakTurn(0);
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      promptRef.current = null;
      setPlaybackLoading(false);
      setPlaybackRunning(false);
      setPlaybackComplete(false);
      setSpeakingSpeaker(null);
      setPlaybackUsed(false);
      setLocalError(
        "Discussion loading failed before playback. The one-play attempt was not consumed.",
      );
    } finally {
      if (promptRequestRef.current === controller) {
        promptRequestRef.current = null;
      }
    }
  }

  async function startRecording() {
    if (
      !playbackComplete ||
      !prepComplete ||
      sttState !== "ready" ||
      recordingUsed ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setTranscript("");
    setResult(null);
    setReviewChecks([false, false, false, false, false]);
    setResponseRemaining(RESPONSE_LIMIT_SECONDS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        clearResponseTimers();
        stopMediaTracks(streamRef.current);
        streamRef.current = null;
        setRecording(false);
        setProcessing(false);
        setLocalError(
          "Microphone capture failed. Reset this item before trying again.",
        );
      };

      recorder.onstop = () => {
        clearResponseTimers();
        stopMediaTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);

        if (requestId !== requestIdRef.current) {
          chunks.length = 0;
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType });
        chunks.length = 0;
        setProcessing(true);
        setSttStatus(
          backendRef.current === "webgpu"
            ? "Local STT: WebGPU · transcribing..."
            : "Local STT: WASM · transcribing...",
        );

        void blob
          .arrayBuffer()
          .then(decodeToMono16k)
          .then((audio) => {
            if (requestId !== requestIdRef.current) {
              audio.fill(0);
              setProcessing(false);
              return;
            }

            ensureWorker().postMessage(
              { type: "transcribe", requestId, audio },
              [audio.buffer],
            );
          })
          .catch(() => {
            setProcessing(false);
            setLocalError(
              "Audio decode or 16 kHz conversion failed. Reset this item and try again.",
            );
          });
      };

      recorder.start();
      setRecordingUsed(true);
      setRecording(true);
      beginResponseCountdown();

      stopTimerRef.current = setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, RESPONSE_LIMIT_MS);
    } catch {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setLocalError(
        "Microphone permission or capture failed. Reset this item and try again.",
      );
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function toggleReview(index: number) {
    setReviewChecks((current) =>
      current.map((checked, currentIndex) =>
        currentIndex === index ? !checked : checked,
      ),
    );
  }

  function reset() {
    requestIdRef.current += 1;
    playbackRunRef.current += 1;
    cancelRequests();
    clearPreparationTimer();
    stopActiveRecording();

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    promptRef.current = null;
    setPlaybackUsed(false);
    setPlaybackLoading(false);
    setPlaybackRunning(false);
    setPlaybackComplete(false);
    setSpeakingSpeaker(null);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRunning(false);
    setPrepRemaining(PREPARATION_SECONDS);
    setPrepComplete(false);
    setRecordingUsed(false);
    setRecording(false);
    setResponseRemaining(RESPONSE_LIMIT_SECONDS);
    setProcessing(false);
    setTranscript("");
    setResult(null);
    setReviewChecks([false, false, false, false, false]);
    setLocalError(null);

    if (backendRef.current) {
      setBackend(backendRef.current);
      setSttState("ready");
      setSttStatus(
        backendRef.current === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM",
      );
    } else {
      setBackend(null);
      setSttState("idle");
      setSttStatus("Local STT is not prepared.");
    }
  }

  const playDisabled =
    !speechSupported ||
    sttState !== "ready" ||
    playbackUsed ||
    playbackLoading ||
    playbackRunning ||
    recording ||
    processing;

  const recordingReady =
    playbackComplete &&
    prepComplete &&
    sttState === "ready" &&
    !recordingUsed &&
    !recording &&
    !processing;

  const reviewCoverage = reviewChecks.filter(Boolean).length;

  return (
    <section
      className="practice-exercise sgd-exercise"
      aria-labelledby="practice-item-title"
    >
      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis. Discussion playback is
          disabled.
        </p>
      ) : null}

      <div className="sgd-step">
        <div>
          <strong>1. Prepare local STT</strong>
          <p className="practice-hint">
            The public Whisper model may download once. Inference stays in this
            browser; no Hugging Face token or remote speech service is used.
          </p>
        </div>
        <button
          disabled={sttState === "loading" || sttState === "ready"}
          onClick={prepareLocalStt}
          type="button"
        >
          {sttState === "idle"
            ? "Prepare local STT"
            : sttState === "loading"
              ? "Preparing..."
              : "Local STT ready"}
        </button>
      </div>

      <p className="practice-status" role="status">
        {sttStatus}
      </p>

      <div className="sgd-step">
        <div>
          <strong>2. Listen to the discussion once</strong>
          <p className="practice-hint">
            PTE plays the discussion automatically. This practice requires one
            explicit Play discussion action because browsers may require a user
            gesture. The six speaker turns stay hidden until your result.
          </p>
          {playbackRunning && speakingSpeaker ? (
            <p className="practice-status" role="status">
              Speaker {speakingSpeaker} is speaking.
            </p>
          ) : playbackComplete ? (
            <p className="practice-status">Discussion playback complete.</p>
          ) : null}
        </div>
        <button disabled={playDisabled} onClick={playDiscussion} type="button">
          {playbackLoading
            ? "Loading discussion..."
            : playbackUsed
              ? "Discussion played once"
              : "Play discussion"}
        </button>
      </div>

      <div className="sgd-step">
        <div>
          <strong>3. Prepare for 10 seconds</strong>
          <p className="practice-hint">
            Preparation starts automatically after the final speaker turn. Organize
            the common topic, each speaker&apos;s contribution, and how their ideas
            relate.
          </p>
          {prepRunning ? (
            <p className="practice-status" role="timer">
              Preparation: {prepRemaining} seconds remaining
            </p>
          ) : prepComplete ? (
            <p className="practice-status">Preparation complete.</p>
          ) : (
            <p className="practice-status">Preparation has not started.</p>
          )}
        </div>
      </div>

      <div className="sgd-step">
        <div>
          <strong>4. Record one summary</strong>
          <p className="practice-hint">
            Recording unlocks only after all six turns, the full 10-second
            preparation, and local STT readiness. Record once for up to 120 seconds.
          </p>
          {recording ? (
            <p className="practice-status" role="timer">
              Recording response · {responseRemaining}s remaining
            </p>
          ) : null}
        </div>
        {recording ? (
          <button onClick={stopRecording} type="button">
            Stop response
          </button>
        ) : (
          <button disabled={!recordingReady} onClick={startRecording} type="button">
            {recordingUsed ? "Response recorded" : "Start response"}
          </button>
        )}
      </div>

      {processing ? (
        <p className="practice-status" role="status">
          Transcribing locally...
        </p>
      ) : null}

      {localError ? (
        <p className="practice-hint" role="alert">
          {localError}
        </p>
      ) : null}

      <p className="practice-hint">
        The transcript and self-review are practice aids only. They are not Pearson
        Content, Pronunciation, Fluency, a PTE score, or points. Local STT may
        mishear your response. This app does not perform automatic semantic,
        keyword, speaker-attribution, pronunciation, fluency, pace, template, or
        content scoring.
      </p>

      {result ? (
        <div className="practice-result sgd-result" aria-live="polite">
          <p>
            <strong>Local transcript:</strong>{" "}
            {transcript.trim() ? transcript : "(empty)"}
          </p>

          <div className="sgd-discussion">
            <h2>Original project-authored discussion</h2>
            <ol>
              {result.turns.map((turn, index) => (
                <li key={`${turn.speaker}-${index}`}>
                  <strong>Speaker {turn.speaker}:</strong> {turn.text}
                </li>
              ))}
            </ol>
          </div>

          <fieldset className="sgd-review">
            <legend>Self-review against five project-authored points</legend>
            {result.reviewPoints.map((point, index) => (
              <label key={point}>
                <input
                  checked={reviewChecks[index]}
                  onChange={() => toggleReview(index)}
                  type="checkbox"
                />
                <span>{point}</span>
              </label>
            ))}
          </fieldset>

          <p className="practice-score">
            Self-review coverage: {reviewCoverage} / 5
          </p>
        </div>
      ) : null}

      <div className="practice-actions">
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {backend ? (
        <span className="visually-hidden">Local STT backend: {backend}</span>
      ) : null}
    </section>
  );
}
