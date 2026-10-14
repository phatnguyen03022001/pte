export const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "error" | "unavailable";

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "stopping"
  | "ready"
  | "unsupported"
  | "error";

export type RecorderErrorCode =
  | "unsupported-browser"
  | "unsupported-format"
  | "permission-denied"
  | "device-unavailable"
  | "recording-failed"
  | "empty-recording"
  | "recording-too-large";

export type RecorderSnapshot = {
  status: RecorderStatus;
  error: RecorderErrorCode | null;
  durationMs: number;
  recordingUrl: string | null;
};
