"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { decodeToMono16k, stopMediaTracks } from "@/lib/local-stt/audio";
import { createLocalSttWorker } from "@/lib/local-stt/client";
import {
  type LocalSttBackend,
  type LocalSttWorkerResponse,
} from "@/lib/local-stt/contract";

import type { RetellLectureItem, RetellLecturePrompt } from "./content";

type ExerciseProps = {
  item: RetellLectureItem;
};

const PREPARATION_SECONDS = 10;
const RESPONSE_LIMIT_MS = 40_000;
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

function isPromptResponse(value: unknown): value is RetellLecturePrompt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RetellLecturePrompt>;
  return (
    typeof candidate.lectureText === "string" &&
    candidate.lectureText.trim().length > 0 &&
    Array.isArray(candidate.reviewPoints) &&
    candidate.reviewPoints.length === 4 &&
    candidate.reviewPoints.every(
      (point) => typeof point === "string" && point.trim().length > 0,
    )
  );
}

export default function RetellLectureExercise({ item }: ExerciseProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );

  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prepRemainingRef = useRef(PREPARATION_SECONDS);
  const requestIdRef = useRef(0);
  const playbackRunRef = useRef(0);
  const promptRequestRef = useRef<AbortController | null>(null);
  const backendRef = useRef<LocalSttBackend | null>(null);

  const [prompt, setPrompt] = useState<RetellLecturePrompt | null>(null);
  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [prepRunning, setPrepRunning] = useState(false);
  const [prepRemaining, setPrepRemaining] = useState(PREPARATION_SECONDS);
  const [prepComplete, setPrepComplete] = useState(false);
  const [recordingUsed, setRecordingUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sttState, setSttState] = useState<"idle" | "loading" | "ready">("idle");
  const [backend, setBackend] = useState<LocalSttBackend | null>(null);
  const [sttStatus, setSttStatus] = useState("Local STT is not prepared.");
  const [transcript, setTranscript] = useState("");
  const [reviewChecks, setReviewChecks] = useState([false, false, false, false]);
  const [localError, setLocalError] = useState<string | null>(null);

  function clearPreparationTimer() {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
  }

  function clearStopTimer() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function cancelPromptRequest() {
    promptRequestRef.current?.abort();
    promptRequestRef.current = null;
  }

  function stopActiveRecording() {
    clearStopTimer();
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

  function ensureWorker(): Worker {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = createLocalSttWorker();

    worker.onmessage = (event: MessageEvent<LocalSttWorkerResponse>) => {
      const message = event.data;

      if (message.type === "status") {
        setSttStatus(message.message);
        return;
      }

      if (message.type === "ready") {
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
        backendRef.current = message.backend;
        setBackend(message.backend);
        setSttState("ready");
        setSttStatus(
          message.backend === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM",
        );
        setTranscript(message.transcript);
        setProcessing(false);
        if (!message.transcript) {
          setLocalError(
            "Local STT returned an empty transcript. Reset this item to try again.",
          );
        }
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
      cancelPromptRequest();
      clearPreparationTimer();
      clearStopTimer();
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

  async function playLecture() {
    if (
      !speechSupported ||
      playbackUsed ||
      playbackLoading ||
      playbackRunning ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setPlaybackUsed(true);
    setPlaybackLoading(true);
    setPlaybackComplete(false);
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
        `/practice/retell-lecture/prompt?item=${encodeURIComponent(item.slug)}`,
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

      setPrompt(payload);
      const utterance = new SpeechSynthesisUtterance(payload.lectureText);
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
          "Lecture playback failed. Reset this item before trying again.",
        );
      };

      setPlaybackLoading(false);
      setPlaybackRunning(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      setPlaybackLoading(false);
      setPlaybackRunning(false);
      setPlaybackComplete(false);
      setLocalError(
        "Lecture playback could not start. Reset this item before trying again.",
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
    setReviewChecks([false, false, false, false]);

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
        clearStopTimer();
        stopMediaTracks(streamRef.current);
        streamRef.current = null;
        setRecording(false);
        setProcessing(false);
        setLocalError(
          "Microphone capture failed. Reset this item before trying again.",
        );
      };

      recorder.onstop = () => {
        clearStopTimer();
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
    cancelPromptRequest();
    clearPreparationTimer();
    stopActiveRecording();

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    setPrompt(null);
    setPlaybackUsed(false);
    setPlaybackLoading(false);
    setPlaybackRunning(false);
    setPlaybackComplete(false);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRunning(false);
    setPrepRemaining(PREPARATION_SECONDS);
    setPrepComplete(false);
    setRecordingUsed(false);
    setProcessing(false);
    setTranscript("");
    setReviewChecks([false, false, false, false]);
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
  const resultReady = Boolean(transcript && prompt);

  return (
    <section
      className="practice-exercise retell-lecture-exercise"
      aria-labelledby="practice-item-title"
    >
      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis. Lecture playback is disabled.
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
          <strong>2. Listen once</strong>
          <p className="practice-hint">
            PTE plays the lecture automatically. This practice requires one explicit
            Play lecture action because browsers may require a user gesture for
            speech playback. The lecture text stays hidden until your result.
          </p>
          {playbackRunning ? (
            <p className="practice-status" role="status">
              Lecture is playing. Take short notes.
            </p>
          ) : playbackComplete ? (
            <p className="practice-status">Lecture playback complete.</p>
          ) : null}
        </div>
        <button
          disabled={
            !speechSupported ||
            playbackUsed ||
            playbackLoading ||
            playbackRunning ||
            recording ||
            processing
          }
          onClick={playLecture}
          type="button"
        >
          {playbackLoading
            ? "Loading lecture..."
            : playbackUsed
              ? "Lecture played once"
              : "Play lecture"}
        </button>
      </div>

      <div className="retell-lecture-step">
        <div>
          <strong>3. Prepare for 10 seconds</strong>
          <p className="practice-hint">
            Preparation starts automatically after playback. Group your notes into a
            main topic, connected supporting ideas, and a conclusion or result.
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
            Recording unlocks only after lecture playback, the full 10-second
            preparation, and local STT readiness. Record once for up to 40 seconds.
          </p>
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

      {resultReady && prompt ? (
        <div className="practice-result retell-lecture-result" aria-live="polite">
          <p>
            <strong>Local transcript:</strong> {transcript}
          </p>

          <div className="retell-lecture-original">
            <h2>Original project-authored lecture</h2>
            <p>{prompt.lectureText}</p>
          </div>

          <fieldset className="retell-lecture-review">
            <legend>Self-review against four project-authored key points</legend>
            {prompt.reviewPoints.map((point, index) => (
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
            Self-review key-point coverage: {reviewCoverage} / 4
          </p>
          <p className="practice-hint">
            The transcript and self-review coverage are practice aids only. They are
            not Pearson Content, Pronunciation, Oral Fluency, a PTE score, or points.
            Local STT errors may affect the transcript. This app does not perform
            automatic keyword, semantic, content, pronunciation, fluency, pace, or
            memorized-template scoring.
          </p>
        </div>
      ) : null}

      <div className="practice-actions">
        <button className="practice-reset" onClick={reset} type="button">
          Reset
        </button>
      </div>
    </section>
  );
}
