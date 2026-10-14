"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createAudioPlayback, isPlayableAudioSource } from "@/lib/audio/playback";
import { PLAYBACK_SPEEDS, type PlaybackSpeed, type PlaybackState } from "@/lib/audio/types";

type AudioPlayerProps = {
  src: string | null | undefined;
  label?: string;
};

const stateLabels: Record<PlaybackState, string> = {
  idle: "Ready to play",
  loading: "Loading audio…",
  playing: "Playing",
  paused: "Paused",
  ended: "Playback finished",
  error: "Audio could not be played. Check the source and try again.",
  unavailable: "Audio is unavailable.",
};

export function AudioPlayer({ src, label = "Audio player" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<PlaybackState>(isPlayableAudioSource(src) ? "idle" : "unavailable");
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlayableAudioSource(src)) {
      setState("unavailable");
      return;
    }

    const playback = createAudioPlayback(audio);
    const unsubscribe = playback.subscribe(setState);
    setState(playback.getState());
    return () => {
      unsubscribe();
      playback.dispose();
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const available = isPlayableAudioSource(src);
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === "playing") audio.pause();
    else void audio.play().catch(() => setState("error"));
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => setState("error"));
  };

  return (
    <section aria-label={label} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      {available && <audio ref={audioRef} src={src} preload="metadata" onError={() => setState("error")} />}
      <Button type="button" onClick={togglePlayback} disabled={!available || state === "loading"}>
        {state === "playing" ? "Pause" : "Play"}
      </Button>
      <Button type="button" variant="outline" onClick={replay} disabled={!available}>
        Replay
      </Button>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <span>Speed</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          value={speed}
          onChange={(event) => {
            const next = Number(event.target.value) as PlaybackSpeed;
            setSpeed(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }}
          disabled={!available}
          aria-label="Playback speed"
        >
          {PLAYBACK_SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}
        </select>
      </label>
      <p role="status" aria-live="polite" className="basis-full text-sm text-muted-foreground">
        {stateLabels[available ? state : "unavailable"]}
      </p>
    </section>
  );
}
