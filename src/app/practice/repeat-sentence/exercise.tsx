"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  longestCommonSubsequence,
  normalizeWords,
} from "@/lib/word-sequence";

import type { RepeatSentenceItem } from "./content";

type ExerciseProps = {
  item: RepeatSentenceItem;
};

type Backend = "webgpu" | "wasm";
type WorkerResponse =
  | { type: "status"; message: string }
  | { type: "ready"; backend: Backend }
  | { type: "result"; requestId: number; backend: Backend; transcript: string }
  | { type: "error"; requestId?: number; message: string };

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

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function resampleMono(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16_000,
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = sourcePosition - left;
    output[index] =
      input[left] * (1 - fraction) + input[right] * fraction;
  }

  return output;
}

async function decodeToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const context = new AudioContext();

  try {
    const decoded = await context.decodeAudioData(arrayBuffer);
    const mono = new Float32Array(decoded.length);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelData = decoded.getChannelData(channel);
      for (let index = 0; index < decoded.length; index += 1) {
        mono[index] += channelData[index] / decoded.numberOfChannels;
      }
    }

    return resampleMono(mono, decoded.sampleRate);
  } finally {
    await context.close();
  }
}

export default function RepeatSentenceExercise({ item }: ExerciseProps) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [playbackUsed, setPlaybackUsed] = useState(false);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  const [recordingUsed, setRecordingUsed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sttState, setSttState] = useState<"idle" | "loading" | "ready">("idle");
  const [backend, setBackend] = useState<Backend | null>(null);
  const [sttStatus, setSttStatus] = useState("Local STT is not prepared.");
  const [transcript, setTranscript] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const expectedWords = useMemo(() => normalizeWords(item.sentence), [item.sentence]);
  const transcriptWords = useMemo(() => normalizeWords(transcript), [transcript]);
  const matchedWords = useMemo(
    () => longestCommonSubsequence(expectedWords, transcriptWords),
    [expectedWords, transcriptWords],
  );

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
      recorder.stop();
    }
    recorderRef.current = null;
    stopTracks(streamRef.current);
    streamRef.current = null;
    setRecording(false);
  }

  function ensureWorker(): Worker {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(new URL("./stt.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "status") {
        setSttStatus(message.message);
        return;
      }

      if (message.type === "ready") {
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
        setSttState("idle");
        setBackend(null);
      }
    };

    worker.onerror = () => {
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
      clearStopTimer();
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopTracks(streamRef.current);
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

  function playSentence() {
    if (!speechSupported || playbackUsed) {
      return;
    }

    setLocalError(null);
    setPlaybackUsed(true);
    setPlaybackComplete(false);

    try {
      const utterance = new SpeechSynthesisUtterance(item.sentence);
      const voice = selectEnglishVoice(window.speechSynthesis.getVoices());

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.rate = 0.92;
      utterance.onend = () => {
        setPlaybackComplete(true);
      };
      utterance.onerror = () => {
        setPlaybackComplete(false);
        setLocalError(
          "Speech playback failed. Reset this item before trying again.",
        );
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlaybackComplete(false);
      setLocalError("Speech playback failed. Reset this item before trying again.");
    }
  }

  async function startRecording() {
    if (
      !playbackComplete ||
      sttState !== "ready" ||
      recordingUsed ||
      recording ||
      processing
    ) {
      return;
    }

    setLocalError(null);
    setTranscript("");

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
        stopTracks(streamRef.current);
        streamRef.current = null;
        setRecording(false);
        setProcessing(false);
        setLocalError(
          "Microphone capture failed. Reset this item before trying again.",
        );
      };

      recorder.onstop = () => {
        clearStopTimer();
        stopTracks(streamRef.current);
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
      }, 15_000);
    } catch {
      stopTracks(streamRef.current);
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

  function reset() {
    requestIdRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    stopActiveRecording();
    setPlaybackUsed(false);
    setPlaybackComplete(false);
    setRecordingUsed(false);
    setProcessing(false);
    setTranscript("");
    setLocalError(null);
    if (backend) {
      setSttState("ready");
      setSttStatus(backend === "webgpu" ? "Local STT: WebGPU" : "Local STT: WASM");
    }
  }

  const recordingReady =
    speechSupported &&
    playbackComplete &&
    sttState === "ready" &&
    !recordingUsed &&
    !recording &&
    !processing;

  return (
    <section
      className="practice-exercise repeat-sentence-exercise"
      aria-labelledby="practice-item-title"
    >
      {!speechSupported ? (
        <p className="practice-hint" role="status">
          This browser does not support SpeechSynthesis, so this practice item is
          unavailable.
        </p>
      ) : null}

      <div className="repeat-sentence-setup">
        <div>
          <strong>1. Prepare local STT</strong>
          <p className="practice-hint">
            The public Whisper model may download once, then inference stays in this
            browser. No Hugging Face token is used.
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

      <div className="repeat-sentence-setup">
        <div>
          <strong>2. Hear the prompt once</strong>
          <p className="practice-hint">
            Browser speech is a practice approximation, not Pearson test audio.
          </p>
        </div>
        <button
          disabled={!speechSupported || playbackUsed}
          onClick={playSentence}
          type="button"
        >
          {playbackUsed ? "Played once" : "Play sentence"}
        </button>
      </div>

      <div className="repeat-sentence-setup">
        <div>
          <strong>3. Record one response</strong>
          <p className="practice-hint">
            Recording unlocks after playback finishes and local STT is ready. Maximum
            15 seconds; audio stays ephemeral in memory.
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
        <div className="practice-result" aria-live="polite">
          <p>
            <strong>Local transcript:</strong> {transcript}
          </p>
          <p>
            <strong>Expected sentence:</strong> {item.sentence}
          </p>
          <p className="practice-score">
            Practice content accuracy: {matchedWords.length} / {expectedWords.length}
          </p>
          <p className="practice-hint">
            This is a local transcript/content proxy only. It is not Pearson Content,
            Pronunciation, Oral Fluency, a PTE score, or points. STT errors can affect
            the result.
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
