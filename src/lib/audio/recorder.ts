import type { RecorderErrorCode, RecorderSnapshot } from "@/lib/audio/types";

export const DEFAULT_MAX_RECORDING_DURATION_MS = 180_000;
export const MAX_RECORDING_DURATION_MS = 600_000;
export const DEFAULT_MAX_RECORDING_BYTES = 25 * 1024 * 1024;
export const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
export const RECORDER_TIMESLICE_MS = 1_000;

const SUPPORTED_AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
] as const;

type MediaTrackLike = { stop(): void };
type MediaStreamLike = { getTracks(): MediaTrackLike[] };
type MediaRecorderLike = {
  mimeType: string;
  state: "inactive" | "recording" | "paused";
  ondataavailable: ((event: BlobEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstop: (() => void) | null;
  start(timeslice?: number): void;
  stop(): void;
};
type MediaRecorderConstructor = {
  new (stream: MediaStreamLike, options?: { mimeType: string; audioBitsPerSecond: number }): MediaRecorderLike;
  isTypeSupported(mimeType: string): boolean;
};

export type AudioRecorderEnvironment = {
  mediaDevices: {
    getUserMedia(constraints: { audio: true; video: false }): Promise<MediaStreamLike>;
  };
  MediaRecorder: MediaRecorderConstructor;
  Blob: new (parts: BlobPart[], options?: BlobPropertyBag) => Blob;
  URL: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(timer: unknown): void;
  now(): number;
};

export type AudioRecorderOptions = {
  maxDurationMs?: number;
  maxRecordingBytes?: number;
};

export function selectSupportedAudioMimeType(recorder: Pick<MediaRecorderConstructor, "isTypeSupported">): string | null {
  try {
    return SUPPORTED_AUDIO_MIME_CANDIDATES.find((mimeType) => recorder.isTypeSupported(mimeType)) ?? null;
  } catch {
    return null;
  }
}

export function getBrowserAudioRecorderEnvironment(): AudioRecorderEnvironment | null {
  if (typeof navigator === "undefined" || typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia || typeof URL.createObjectURL !== "function") return null;

  return {
    mediaDevices: navigator.mediaDevices as AudioRecorderEnvironment["mediaDevices"],
    MediaRecorder: MediaRecorder as unknown as MediaRecorderConstructor,
    Blob,
    URL,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timer) => window.clearTimeout(timer as number),
    now: () => performance.now(),
  };
}

export function createAudioRecorder(
  environment: AudioRecorderEnvironment | null,
  options: AudioRecorderOptions = {},
) {
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_RECORDING_DURATION_MS;
  const maxRecordingBytes = options.maxRecordingBytes ?? DEFAULT_MAX_RECORDING_BYTES;
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > MAX_RECORDING_DURATION_MS) {
    throw new RangeError(`maxDurationMs must be between 1 and ${MAX_RECORDING_DURATION_MS}.`);
  }
  if (!Number.isSafeInteger(maxRecordingBytes) || maxRecordingBytes < 1 || maxRecordingBytes > MAX_RECORDING_BYTES) {
    throw new RangeError(`maxRecordingBytes must be between 1 and ${MAX_RECORDING_BYTES}.`);
  }

  let snapshot: RecorderSnapshot = environment
    ? { status: "idle", error: null, durationMs: 0, recordingUrl: null }
    : { status: "unsupported", error: "unsupported-browser", durationMs: 0, recordingUrl: null };
  let disposed = false;
  let operationId = 0;
  let stream: MediaStreamLike | null = null;
  let recorder: MediaRecorderLike | null = null;
  let selectedMimeType: string | null = null;
  let timer: unknown;
  let startedAt = 0;
  let chunkBytes = 0;
  let chunks: Blob[] = [];
  let pendingError: RecorderErrorCode | null = null;
  const listeners = new Set<(nextSnapshot: RecorderSnapshot) => void>();

  const publish = (nextSnapshot: RecorderSnapshot) => {
    if (disposed) return;
    snapshot = nextSnapshot;
    for (const listener of listeners) listener(snapshot);
  };

  const clearDurationTimer = () => {
    if (timer !== undefined && environment) environment.clearTimer(timer);
    timer = undefined;
  };

  const stopTracks = (target: MediaStreamLike | null) => {
    if (!target) return;
    for (const track of target.getTracks()) {
      try {
        track.stop();
      } catch {
        // Continue stopping remaining tracks if one browser track fails to stop.
      }
    }
  };

  const releaseStream = () => {
    const currentStream = stream;
    stream = null;
    stopTracks(currentStream);
  };

  const clearRecordingUrl = () => {
    if (snapshot.recordingUrl && environment) environment.URL.revokeObjectURL(snapshot.recordingUrl);
    snapshot = { ...snapshot, recordingUrl: null };
  };

  const detachRecorder = (target: MediaRecorderLike) => {
    target.ondataavailable = null;
    target.onerror = null;
    target.onstop = null;
  };

  const clearRecorder = () => {
    const currentRecorder = recorder;
    recorder = null;
    if (currentRecorder) detachRecorder(currentRecorder);
  };

  const clearMedia = () => {
    chunks = [];
    chunkBytes = 0;
    selectedMimeType = null;
  };

  const finishWithError = (error: RecorderErrorCode) => {
    clearDurationTimer();
    const currentRecorder = recorder;
    clearRecorder();
    if (currentRecorder?.state === "recording") {
      try {
        currentRecorder.stop();
      } catch {
        // Cleanup below is still required if the browser rejects stop().
      }
    }
    releaseStream();
    clearMedia();
    clearRecordingUrl();
    publish({ status: "error", error, durationMs: elapsedDuration(), recordingUrl: null });
  };

  const handleStopped = (currentRecorder: MediaRecorderLike) => {
    clearDurationTimer();
    recorder = null;
    releaseStream();
    detachRecorder(currentRecorder);
    if (disposed) return;
    if (pendingError) {
      const error = pendingError;
      pendingError = null;
      clearMedia();
      clearRecordingUrl();
      publish({ status: "error", error, durationMs: elapsedDuration(), recordingUrl: null });
      return;
    }

    const durationMs = elapsedDuration();
    const finalChunks = chunks;
    const finalBytes = chunkBytes;
    const mimeType = currentRecorder.mimeType || selectedMimeType || "";
    clearMedia();
    if (finalBytes === 0 || finalChunks.length === 0) {
      clearRecordingUrl();
      publish({ status: "error", error: "empty-recording", durationMs, recordingUrl: null });
      return;
    }

    try {
      const blob = new environment!.Blob(finalChunks, mimeType ? { type: mimeType } : undefined);
      if (blob.size === 0) {
        clearRecordingUrl();
        publish({ status: "error", error: "empty-recording", durationMs, recordingUrl: null });
        return;
      }
      clearRecordingUrl();
      const recordingUrl = environment!.URL.createObjectURL(blob);
      publish({ status: "ready", error: null, durationMs, recordingUrl });
    } catch {
      clearRecordingUrl();
      publish({ status: "error", error: "recording-failed", durationMs, recordingUrl: null });
    }
  };

  const elapsedDuration = () => Math.max(0, Math.min(maxDurationMs, environment ? environment.now() - startedAt : 0));

  const stopForLimit = () => {
    if (snapshot.status !== "recording") return;
    if (recorder?.state === "recording") stop();
  };

  async function start(): Promise<void> {
    if (disposed || snapshot.status === "requesting-permission" || snapshot.status === "recording" || snapshot.status === "stopping") return;
    if (!environment) {
      publish({ status: "unsupported", error: "unsupported-browser", durationMs: 0, recordingUrl: null });
      return;
    }

    const mimeType = selectSupportedAudioMimeType(environment.MediaRecorder);
    if (!mimeType) {
      publish({ status: "unsupported", error: "unsupported-format", durationMs: 0, recordingUrl: null });
      return;
    }

    clearDurationTimer();
    clearRecordingUrl();
    clearMedia();
    pendingError = null;
    selectedMimeType = mimeType;
    const currentOperationId = ++operationId;
    publish({ status: "requesting-permission", error: null, durationMs: 0, recordingUrl: null });

    let requestedStream: MediaStreamLike;
    try {
      requestedStream = await environment.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      if (currentOperationId !== operationId || disposed) return;
      publish({ status: "error", error: getMicrophoneErrorCode(error), durationMs: 0, recordingUrl: null });
      return;
    }

    if (disposed || currentOperationId !== operationId) {
      stopTracks(requestedStream);
      return;
    }

    stream = requestedStream;
    try {
      const createdRecorder = new environment.MediaRecorder(requestedStream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      recorder = createdRecorder;
      createdRecorder.ondataavailable = ({ data }) => {
        if (disposed || (snapshot.status !== "recording" && snapshot.status !== "stopping") || data.size === 0) return;
        if (chunkBytes + data.size > maxRecordingBytes) {
          pendingError = "recording-too-large";
          stopForLimit();
          return;
        }
        chunks.push(data);
        chunkBytes += data.size;
        publish({ ...snapshot, durationMs: elapsedDuration() });
      };
      createdRecorder.onerror = () => finishWithError("recording-failed");
      createdRecorder.onstop = () => handleStopped(createdRecorder);
      createdRecorder.start(RECORDER_TIMESLICE_MS);
      startedAt = environment.now();
      publish({ status: "recording", error: null, durationMs: 0, recordingUrl: null });
      timer = environment.setTimer(stopForLimit, maxDurationMs);
    } catch {
      releaseStream();
      clearRecorder();
      clearMedia();
      publish({ status: "error", error: "recording-failed", durationMs: 0, recordingUrl: null });
    }
  }

  function stop(): void {
    if (disposed || snapshot.status !== "recording" || !recorder) return;
    clearDurationTimer();
    publish({ ...snapshot, status: "stopping", durationMs: elapsedDuration() });
    try {
      recorder.stop();
    } catch {
      finishWithError("recording-failed");
    }
  }

  function discard(): void {
    if (disposed) return;
    operationId += 1;
    clearDurationTimer();
    const currentRecorder = recorder;
    clearRecorder();
    if (currentRecorder?.state === "recording") {
      try {
        currentRecorder.stop();
      } catch {
        // Discard continues to release tracks and object URLs.
      }
    }
    releaseStream();
    clearMedia();
    pendingError = null;
    clearRecordingUrl();
    publish({ status: "idle", error: null, durationMs: 0, recordingUrl: null });
  }

  function dispose(): void {
    if (disposed) return;
    operationId += 1;
    clearDurationTimer();
    const currentRecorder = recorder;
    clearRecorder();
    if (currentRecorder?.state === "recording") {
      try {
        currentRecorder.stop();
      } catch {
        // Unmount cleanup must continue even if stop() throws.
      }
    }
    releaseStream();
    clearMedia();
    pendingError = null;
    clearRecordingUrl();
    disposed = true;
    listeners.clear();
  }

  function subscribe(listener: (nextSnapshot: RecorderSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getSnapshot: () => snapshot, subscribe, start, stop, discard, dispose };
}

function getMicrophoneErrorCode(error: unknown): RecorderErrorCode {
  if (error && typeof error === "object" && "name" in error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permission-denied";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "device-unavailable";
  }
  return "recording-failed";
}
