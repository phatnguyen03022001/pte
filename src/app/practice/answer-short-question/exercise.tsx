"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { decodeToMono16k, stopMediaTracks } from "@/lib/local-stt/audio";
import {
  LOCAL_STT_MODEL_ID,
  type LocalSttBackend,
  type LocalSttWorkerResponse,
} from "@/lib/local-stt/contract";

import type {
  AnswerShortQuestionItem,
  AnswerShortQuestionPrompt,
  AnswerShortQuestionResult,
} from "./content";
import { normalizeAnswerShortQuestion } from "./normalize";

type ExerciseProps = {
  item: AnswerShortQuestionItem;
};

type PracticeResult = AnswerShortQuestionResult & {
  matched: boolean;
};

const RESPONSE_LIMIT_MS = 10_000;
const PLAYBACK_RATE = 0.92;

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
  for (const language of ["en-AU", "en-GB", "en-US"]) {
    const voice = voices.find(
      (candidate) => candidate.lang.toLowerCase() === language.toLowerCase(),
    );
    if (voice) {
      return voice;
    }
  }

  return voices.find((voice) => voice.lang.toLowerCase().startsWith("en-"));
}

function createAnswerShortQuestionSttWorker(): Worker {
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

function isPromptResponse(value: unknown): value is AnswerShortQuestionPrompt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnswerShortQuestionPrompt>;
  return (
    typeof candidate.questionText === "string" &&
    candidate.questionText.trim().length > 0
  );
}

function isResultResponse(value: unknown): value is AnswerShortQuestionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnswerShortQuestionResult>;
  return (
    typeof candidate.questionText === "string" &&
    candidate.questionText.trim().length > 0 &&
    Array.isArray(candidate.acceptedAnswers) &&
    candidate.acceptedAnswers.length >= 1 &&
    candidate.acceptedAnswers.length <= 4 &&
    candidate.acceptedAnswers.every(
      (answer) => typeof answer === "string" && answer.trim().length > 0,
    )
  );
}

export default function AnswerShortQuestionExercise({ item }: ExerciseProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );

  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responseStartedAtRef = useRef(0);
  const requestIdRef = useRef(0);
  const runIdRef = useRef(0);
  const promptRequestRef = useRef<AbortController | null>(null);
  const revealRequestRef = useRef<AbortController | null>(null);
  const backendRef = useRef<LocalSttBackend | null>(null);
  const promptRef = useRef<AnswerShortQuestionPrompt | null>(null);

  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [recordingUsed, setRecordingUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [responseRemaining, setResponseRemaining] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [sttState, setSttState] = useState<"idle" | "loading" | "ready">("idle");
  const [backend, setBackend] = useState<LocalSttBackend | null>(null);
  const [sttStatus, setSttStatus] = useState("Local STT is not prepared.");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function clearResponseTimers() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
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

  async function revealResult(transcriptText: string, requestId: number) {
    const controller = new AbortController();
    revealRequestRef.current?.abort();
    revealRequestRef.current = controller;

    try {
      const response = await fetch(
        `/practice/answer-short-question/prompt?item=${encodeURIComponent(
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
        promptRef.current &&
        payload.questionText !== promptRef.current.questionText
      ) {
        throw new Error("Prompt changed during the response.");
      }

      const normalizedTranscript = normalizeAnswerShortQuestion(transcriptText);
      const matched = payload.acceptedAnswers.some(
        (answer) =>
          normalizedTranscript === normalizeAnswerShortQuestion(answer),
      );

      setResult({ ...payload, matched });
      setProcessing(false);

      if (!transcriptText.trim()) {
        setLocalError(
          "Local STT returned an empty transcript. The practice answer match is No; reset to try again.",
        );
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      setProcessing(false);
      setLocalError(
        "The local transcript finished, but accepted answers could not be revealed. Reset this item and try again.",
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

    const worker = createAnswerShortQuestionSttWorker();

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
        setTranscript(message.transcript);
        void revealResult(message.transcript, message.requestId);
        return;
      }

      setProcessing(false);
      setLocalError(message.message);
      if (message.requestId === undefined) {
        backendRef.current = null;
        setSttState("idle");
        setBackend(null);
      }
    };

    worker.onerror = () => {
      backendRef.current = null;
      setProcessing(false);
      setSttState("idle");
      setBackend(null);
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
      runIdRef.current += 1;
      cancelRequests();
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

  function beginCountdown() {
    responseStartedAtRef.current = Date.now();
    setResponseRemaining(10);

    countdownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - responseStartedAtRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((RESPONSE_LIMIT_MS - elapsed) / 1_000),
      );
      setResponseRemaining(remaining);

      if (remaining === 0 && countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 200);
  }

  function startRecording(runId: number) {
    if (
      runId !== runIdRef.current ||
      recordingUsed ||
      recording ||
      processing
    ) {
      return;
    }

    const stream = streamRef.current;
    if (!stream || !stream.getTracks().some((track) => track.readyState === "live")) {
      stopMediaTracks(stream);
      streamRef.current = null;
      setLocalError(
        "The microphone stream ended before the response window opened. Reset this item and try again.",
      );
      return;
    }

    const chunks: Blob[] = [];

    try {
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
      beginCountdown();
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
        "The response recorder could not start. Reset this item and try again.",
      );
    }
  }

  async function playQuestion() {
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
    setPlaybackLoading(true);

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const controller = new AbortController();
    promptRequestRef.current = controller;
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (runId !== runIdRef.current) {
        stopMediaTracks(stream);
        return;
      }

      streamRef.current = stream;

      const response = await fetch(
        `/practice/answer-short-question/prompt?item=${encodeURIComponent(
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

      if (runId !== runIdRef.current) {
        stopMediaTracks(streamRef.current);
        streamRef.current = null;
        return;
      }

      promptRef.current = payload;
      const utterance = new SpeechSynthesisUtterance(payload.questionText);
      const voice = selectEnglishVoice(window.speechSynthesis.getVoices());

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.rate = PLAYBACK_RATE;
      utterance.onend = () => {
        if (runId !== runIdRef.current) {
          return;
        }

        setPlaybackRunning(false);
        startRecording(runId);
      };
      utterance.onerror = () => {
        if (runId !== runIdRef.current) {
          return;
        }

        setPlaybackRunning(false);
        stopMediaTracks(streamRef.current);
        streamRef.current = null;
        setLocalError(
          "Question playback failed. Reset this item before trying again.",
        );
      };

      setPlaybackLoading(false);
      setPlaybackRunning(true);
      window.speechSynthesis.speak(utterance);
      setPlaybackUsed(true);
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      stopMediaTracks(stream ?? streamRef.current);
      streamRef.current = null;
      promptRef.current = null;
      setPlaybackLoading(false);
      setPlaybackRunning(false);
      setPlaybackUsed(false);
      setLocalError(
        "Microphone permission/capture or question loading failed before playback. The one-play attempt was not consumed.",
      );
    } finally {
      if (promptRequestRef.current === controller) {
        promptRequestRef.current = null;
      }
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function reset() {
    requestIdRef.current += 1;
    runIdRef.current += 1;
    cancelRequests();
    clearResponseTimers();
    stopActiveRecording();

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    promptRef.current = null;
    setPlaybackUsed(false);
    setPlaybackLoading(false);
    setPlaybackRunning(false);
    setRecordingUsed(false);
    setRecording(false);
    setResponseRemaining(10);
    setProcessing(false);
    setTranscript("");
    setResult(null);
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

  return (
    <section className="practice-exercise" aria-labelledby="practice-item-title">
      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis. This practice item is
          unavailable.
        </p>
      ) : null}

      <p className="practice-hint">{sttStatus}</p>

      <div className="practice-actions">
        <button
          disabled={!speechSupported || sttState !== "idle"}
          onClick={prepareLocalStt}
          type="button"
        >
          {sttState === "idle" ? "Prepare local STT" : "Local STT prepared"}
        </button>
        <button disabled={playDisabled} onClick={playQuestion} type="button">
          {playbackUsed
            ? "Question played once"
            : playbackLoading
              ? "Preparing microphone..."
              : "Play question"}
        </button>
      </div>

      <p className="practice-hint">
        The microphone is acquired before playback. Recording starts automatically
        only after the question finishes and is capped at 10 seconds.
      </p>

      {playbackRunning ? (
        <p className="practice-hint" role="status">
          Question is playing. Recording has not started.
        </p>
      ) : null}

      {recording ? (
        <div className="practice-actions">
          <p className="practice-hint" role="status">
            Recording response · {responseRemaining}s remaining
          </p>
          <button onClick={stopRecording} type="button">
            Stop answer
          </button>
        </div>
      ) : null}

      {processing ? (
        <p className="practice-hint" role="status">
          Transcribing locally and checking the accepted aliases...
        </p>
      ) : null}

      {localError ? (
        <p className="practice-hint" role="alert">
          {localError}
        </p>
      ) : null}

      <p className="practice-hint">
        Practice match only — not an official Pearson score or result. Answer Short
        Question contributes to Listening, not Speaking. Local STT may mishear a
        correct spoken answer.
      </p>

      <div className="practice-actions">
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>

      {result ? (
        <div className="practice-result" aria-live="polite">
          <p>
            <strong>Question:</strong> {result.questionText}
          </p>
          <p>
            <strong>Your transcript:</strong>{" "}
            {transcript.trim() ? transcript : "(empty)"}
          </p>
          <p className="practice-score">
            Practice answer match: {result.matched ? "Yes" : "No"}
          </p>
          <p>
            <strong>Accepted answer aliases:</strong>{" "}
            {result.acceptedAnswers.join(", ")}
          </p>
        </div>
      ) : null}

      {backend ? (
        <span className="visually-hidden">Local STT backend: {backend}</span>
      ) : null}
    </section>
  );
}
