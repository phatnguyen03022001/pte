"use client";

import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/audio/audio-player";
import { Button } from "@/components/ui/button";
import { createAudioRecorder, DEFAULT_MAX_RECORDING_DURATION_MS, getBrowserAudioRecorderEnvironment } from "@/lib/audio/recorder";
import type { RecorderErrorCode, RecorderSnapshot } from "@/lib/audio/types";

type AudioRecorderProps = {
  maxDurationMs?: number;
};

const errorMessages: Record<RecorderErrorCode, string> = {
  "unsupported-browser": "Audio recording is not supported in this browser.",
  "unsupported-format": "This browser does not support a compatible audio recording format.",
  "permission-denied": "Microphone permission was denied. Allow microphone access and try again.",
  "device-unavailable": "No microphone is available. Connect a microphone and try again.",
  "recording-failed": "Recording could not be completed. Please try again.",
  "empty-recording": "No audio was captured. Try recording again.",
  "recording-too-large": "This recording reached the browser storage safety limit. Please record a shorter response.",
};

const initialSnapshot: RecorderSnapshot = {
  status: "idle",
  error: null,
  durationMs: 0,
  recordingUrl: null,
};

function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AudioRecorder({ maxDurationMs = DEFAULT_MAX_RECORDING_DURATION_MS }: AudioRecorderProps) {
  const [recorder, setRecorder] = useState<ReturnType<typeof createAudioRecorder> | null>(null);
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>(initialSnapshot);

  useEffect(() => {
    const instance = createAudioRecorder(getBrowserAudioRecorderEnvironment(), { maxDurationMs });
    // Browser media APIs are initialized after hydration to keep server rendering deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecorder(instance);
    const unsubscribe = instance.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      instance.dispose();
    };
  }, [maxDurationMs]);

  const status = snapshot.status;
  const canStart = status === "idle" || status === "ready" || status === "error" || status === "unsupported";

  return (
    <section aria-label="Microphone recorder" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void recorder?.start()} disabled={!recorder || !canStart}>
          {status === "ready" ? "Record again" : "Record"}
        </Button>
        <Button type="button" variant="outline" onClick={() => recorder?.stop()} disabled={status !== "recording"}>
          Stop
        </Button>
        {snapshot.recordingUrl && (
          <Button type="button" variant="ghost" onClick={() => recorder?.discard()}>
            Discard recording
          </Button>
        )}
        <span className="text-sm text-muted-foreground" aria-live="polite" role="status">
          {status === "requesting-permission" && "Waiting for microphone permission…"}
          {status === "recording" && `Recording · ${formatDuration(snapshot.durationMs)}`}
          {status === "stopping" && "Finishing recording…"}
          {status === "ready" && `Recording ready · ${formatDuration(snapshot.durationMs)}`}
          {status === "idle" && "Microphone starts only when you choose Record."}
        </span>
      </div>
      {snapshot.error && <p role="alert" className="text-sm text-destructive">{errorMessages[snapshot.error]}</p>}
      {snapshot.recordingUrl && <AudioPlayer src={snapshot.recordingUrl} label="Play my recording" />}
    </section>
  );
}
