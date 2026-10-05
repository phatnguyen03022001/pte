"use client";

import { useEffect, useRef, useState } from "react";

import { decodeToMono16k, stopMediaTracks } from "@/lib/local-stt/audio";
import { createLocalSttWorker } from "@/lib/local-stt/client";
import {
  type LocalSttBackend,
  type LocalSttWorkerResponse,
} from "@/lib/local-stt/contract";

import type { DescribeImageItem } from "./content";

type ExerciseProps = {
  item: DescribeImageItem;
};

const PREPARATION_SECONDS = 25;
const RESPONSE_LIMIT_MS = 40_000;

export default function DescribeImageExercise({ item }: ExerciseProps) {
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prepRemainingRef = useRef(PREPARATION_SECONDS);
  const requestIdRef = useRef(0);
  const backendRef = useRef<LocalSttBackend | null>(null);

  const [prepUsed, setPrepUsed] = useState(false);
  const [prepRunning, setPrepRunning] = useState(false);
  const [prepRemaining, setPrepRemaining] = useState(PREPARATION_SECONDS);
  const [prepComplete, setPrepComplete] = useState(false);
  const [prepSkipped, setPrepSkipped] = useState(false);
  const [recordingUsed, setRecordingUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sttState, setSttState] = useState<"idle" | "loading" | "ready">("idle");
  const [backend, setBackend] = useState<LocalSttBackend | null>(null);
  const [sttStatus, setSttStatus] = useState("Local STT is not prepared.");
  const [transcript, setTranscript] = useState("");
  const [reviewChecks, setReviewChecks] = useState([false, false, false]);
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
      clearPreparationTimer();
      clearStopTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopMediaTracks(streamRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function prepareLocalStt() {
    setLocalError(null);
    setSttState("loading");
    setSttStatus("Preparing local STT...");
    ensureWorker().postMessage({ type: "prepare" });
  }

  function startPreparation() {
    if (prepUsed || recordingUsed || recording || processing) {
      return;
    }

    setLocalError(null);
    setPrepUsed(true);
    setPrepRunning(true);
    setPrepComplete(false);
    setPrepSkipped(false);
    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepRemaining(PREPARATION_SECONDS);

    clearPreparationTimer();
    prepTimerRef.current = setInterval(() => {
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

  function skipPreparation() {
    if (prepComplete || prepSkipped || recordingUsed || recording || processing) {
      return;
    }

    clearPreparationTimer();
    setPrepUsed(true);
    setPrepRunning(false);
    setPrepComplete(false);
    setPrepSkipped(true);
    prepRemainingRef.current = 0;
    setPrepRemaining(0);
  }

  async function startRecording() {
    const prepReady = prepComplete || prepSkipped;
    if (
      !prepReady ||
      sttState !== "ready" ||
      recordingUsed ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setTranscript("");
    setReviewChecks([false, false, false]);

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
    clearPreparationTimer();
    stopActiveRecording();

    prepRemainingRef.current = PREPARATION_SECONDS;
    setPrepUsed(false);
    setPrepRunning(false);
    setPrepRemaining(PREPARATION_SECONDS);
    setPrepComplete(false);
    setPrepSkipped(false);
    setRecordingUsed(false);
    setProcessing(false);
    setTranscript("");
    setReviewChecks([false, false, false]);
    setLocalError(null);

    if (backendRef.current) {
      setBackend(backendRef.current);
      setSttState("ready");
      setSttStatus(
        backendRef.current === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM",
      );
    }
  }

  const prepReady = prepComplete || prepSkipped;
  const recordingReady =
    prepReady &&
    sttState === "ready" &&
    !recordingUsed &&
    !recording &&
    !processing;
  const reviewCoverage = reviewChecks.filter(Boolean).length;

  return (
    <section
      className="practice-exercise describe-image-exercise"
      aria-labelledby="practice-item-title"
    >
      <div className="describe-image-setup">
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

      <div className="describe-image-setup">
        <div>
          <strong>2. Prepare for 25 seconds</strong>
          <p className="practice-hint">
            Use the chart title, main trend, extremes, and relevant values. You can
            skip the countdown for practice, but recording still requires local STT
            readiness.
          </p>
          {prepRunning ? (
            <p className="practice-status" role="timer">
              Preparation: {prepRemaining} seconds remaining
            </p>
          ) : prepComplete ? (
            <p className="practice-status">Preparation complete.</p>
          ) : prepSkipped ? (
            <p className="practice-status">Preparation skipped for practice.</p>
          ) : null}
        </div>
        <div className="practice-actions">
          <button
            disabled={prepUsed || recordingUsed || recording || processing}
            onClick={startPreparation}
            type="button"
          >
            {prepUsed ? "Preparation started" : "Start 25-second preparation"}
          </button>
          <button
            disabled={
              prepComplete || prepSkipped || recordingUsed || recording || processing
            }
            onClick={skipPreparation}
            type="button"
          >
            Skip preparation for practice
          </button>
        </div>
      </div>

      <div className="describe-image-setup">
        <div>
          <strong>3. Record one response</strong>
          <p className="practice-hint">
            Record once for up to 40 seconds. Audio stays ephemeral in memory and
            recording stops automatically at the cap.
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

      {transcript ? (
        <div className="practice-result describe-image-result" aria-live="polite">
          <p>
            <strong>Local transcript:</strong> {transcript}
          </p>

          <fieldset className="describe-image-review">
            <legend>Self-review against three project-authored key points</legend>
            {item.reviewPoints.map((point, index) => (
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
            Self-review key-point coverage: {reviewCoverage} / 3
          </p>
          <p className="practice-hint">
            The transcript and self-review coverage are practice aids only. They are
            not Pearson Content, Pronunciation, Oral Fluency, a PTE score, or points.
            Local STT errors may affect the transcript. This app does not perform
            automatic semantic, keyword, pronunciation, fluency, pace, or template
            scoring.
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
