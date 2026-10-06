"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { decodeToMono16k, stopMediaTracks } from "@/lib/local-stt/audio";
import {
  LOCAL_STT_MODEL_ID,
  type LocalSttBackend,
  type LocalSttWorkerResponse,
} from "@/lib/local-stt/contract";

import type {
  RespondToASituationItem,
  RespondToASituationResult,
} from "./content";

type ExerciseProps = {
  item: RespondToASituationItem;
};

const PREPARATION_SECONDS = 10;
const RESPONSE_LIMIT_SECONDS = 40;
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

function createRespondToASituationSttWorker(): Worker {
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

function isResultResponse(value: unknown): value is RespondToASituationResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RespondToASituationResult>;
  return (
    Array.isArray(candidate.reviewPoints) &&
    candidate.reviewPoints.length === 5 &&
    candidate.reviewPoints.every(
      (point) => typeof point === "string" && point.trim().length > 0,
    )
  );
}

export default function RespondToASituationExercise({ item }: ExerciseProps) {
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
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prepRemainingRef = useRef(PREPARATION_SECONDS);
  const responseStartedAtRef = useRef(0);
  const requestIdRef = useRef(0);
  const playbackRunRef = useRef(0);
  const reviewRequestRef = useRef<AbortController | null>(null);
  const backendRef = useRef<LocalSttBackend | null>(null);

  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
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
  const [result, setResult] = useState<RespondToASituationResult | null>(null);
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

  function cancelReviewRequest() {
    reviewRequestRef.current?.abort();
    reviewRequestRef.current = null;
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

  async function revealReview(transcriptText: string, requestId: number) {
    const controller = new AbortController();
    reviewRequestRef.current?.abort();
    reviewRequestRef.current = controller;

    try {
      const response = await fetch(
        `/practice/respond-to-a-situation/review?item=${encodeURIComponent(
          item.slug,
        )}`,
        { cache: "no-store", signal: controller.signal },
      );

      if (!response.ok) {
        throw new Error("Review request failed.");
      }

      const payload: unknown = await response.json();
      if (!isResultResponse(payload)) {
        throw new Error("Review contract is invalid.");
      }

      if (requestId !== requestIdRef.current) {
        return;
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
        "The local transcript finished, but self-review could not be revealed. Reset this item and try again.",
      );
    } finally {
      if (reviewRequestRef.current === controller) {
        reviewRequestRef.current = null;
      }
    }
  }

  function ensureWorker(): Worker {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = createRespondToASituationSttWorker();

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
        void revealReview(message.transcript, message.requestId);
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
      playbackRunRef.current += 1;
      cancelReviewRequest();
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
    setLocalError(null);
    setSttState("loading");
    setSttStatus("Preparing local STT...");
    ensureWorker().postMessage({ type: "prepare" });
  }

  function playSituation() {
    if (
      !speechSupported ||
      sttState !== "ready" ||
      playbackUsed ||
      playbackRunning ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setPlaybackUsed(true);
    setPlaybackComplete(false);
    setPrepRunning(false);
    setPrepComplete(false);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRemaining(PREPARATION_SECONDS);

    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;

    const utterance = new SpeechSynthesisUtterance(item.situationText);
    const voice = selectEnglishVoice(window.speechSynthesis.getVoices());

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.rate = PLAYBACK_RATE;
    utterance.onend = () => {
      if (runId !== playbackRunRef.current) {
        return;
      }
      setPlaybackRunning(false);
      setPlaybackComplete(true);
      startPreparation(runId);
    };
    utterance.onerror = () => {
      if (runId !== playbackRunRef.current) {
        return;
      }
      setPlaybackRunning(false);
      setPlaybackComplete(false);
      setLocalError(
        "Situation playback failed. Reset this item before trying again.",
      );
    };

    setPlaybackRunning(true);
    window.speechSynthesis.speak(utterance);
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
          backend === "webgpu"
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
    cancelReviewRequest();
    clearPreparationTimer();
    stopActiveRecording();

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    setPlaybackUsed(false);
    setPlaybackRunning(false);
    setPlaybackComplete(false);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRunning(false);
    setPrepRemaining(PREPARATION_SECONDS);
    setPrepComplete(false);
    setRecordingUsed(false);
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
    }
  }

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
      className="practice-exercise retell-lecture-exercise"
      aria-labelledby="practice-item-title"
    >
      <div className="retell-lecture-original">
        <h2>Situation</h2>
        <p>{item.situationText}</p>
      </div>

      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis. Situation playback is
          disabled.
        </p>
      ) : null}

      <div className="retell-lecture-step">
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

      <div className="retell-lecture-step">
        <div>
          <strong>2. Listen to the situation once</strong>
          <p className="practice-hint">
            PTE plays the situation automatically. This browser practice requires
            one explicit Play situation action after local STT is ready.
          </p>
          {playbackRunning ? (
            <p className="practice-status" role="status">
              Situation is playing.
            </p>
          ) : playbackComplete ? (
            <p className="practice-status">Situation playback complete.</p>
          ) : null}
        </div>
        <button
          disabled={
            !speechSupported ||
            sttState !== "ready" ||
            playbackUsed ||
            playbackRunning ||
            recording ||
            processing
          }
          onClick={playSituation}
          type="button"
        >
          {playbackUsed ? "Situation played once" : "Play situation"}
        </button>
      </div>

      <div className="retell-lecture-step">
        <div>
          <strong>3. Prepare for 10 seconds</strong>
          <p className="practice-hint">
            Preparation starts automatically only after playback ends. Identify the
            person, your goal, the key facts, and a context-appropriate tone.
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

      <div className="retell-lecture-step">
        <div>
          <strong>4. Record one response</strong>
          <p className="practice-hint">
            Recording unlocks only after playback, the full 10-second preparation,
            and local STT readiness. Record once for up to 40 seconds.
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
        Content, Pronunciation, Oral Fluency, a PTE score, or points. Local STT may
        mishear your response. This app does not perform automatic semantic,
        keyword, tone, pronunciation, fluency, pace, template, or content scoring.
      </p>

      {result ? (
        <div className="practice-result retell-lecture-result" aria-live="polite">
          <p>
            <strong>Local transcript:</strong>{" "}
            {transcript.trim() ? transcript : "(empty)"}
          </p>

          <fieldset className="retell-lecture-review">
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
