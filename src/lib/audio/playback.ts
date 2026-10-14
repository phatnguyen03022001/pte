import { PLAYBACK_SPEEDS, type PlaybackSpeed, type PlaybackState } from "@/lib/audio/types";

type AudioElement = Pick<
  HTMLAudioElement,
  "currentTime" | "duration" | "playbackRate" | "play" | "pause" | "addEventListener" | "removeEventListener"
>;

export function isPlayableAudioSource(source: unknown): source is string {
  if (typeof source !== "string" || source.trim() !== source || source.length === 0) return false;
  if (/^(?:\/Users\/|\/private\/|[A-Za-z]:[\\/]|file:)/i.test(source)) return false;

  try {
    const url = new URL(source, "https://pte-study.invalid");
    return ["http:", "https:", "blob:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function seekAudio(audio: Pick<AudioElement, "currentTime" | "duration">, seconds: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(audio.duration) || audio.duration <= 0) return audio.currentTime;
  audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
  return audio.currentTime;
}

export function createAudioPlayback(audio: AudioElement) {
  let state: PlaybackState = "idle";
  let disposed = false;
  const listeners = new Set<(nextState: PlaybackState) => void>();

  const setState = (nextState: PlaybackState) => {
    if (disposed || state === nextState) return;
    state = nextState;
    for (const listener of listeners) listener(state);
  };

  const eventStates: Readonly<Record<string, PlaybackState>> = {
    loadstart: "loading",
    waiting: "loading",
    playing: "playing",
    pause: "paused",
    ended: "ended",
    error: "error",
  };
  const handleAudioEvent = (event: Event) => {
    const nextState = eventStates[event.type];
    if (nextState) setState(nextState);
    if ((event.type === "canplay" || event.type === "loadedmetadata") && state === "loading") {
      setState("idle");
    }
  };

  for (const eventName of ["loadstart", "waiting", "canplay", "loadedmetadata", "playing", "pause", "ended", "error"]) {
    audio.addEventListener(eventName, handleAudioEvent);
  }

  return {
    getState: (): PlaybackState => state,
    subscribe(listener: (nextState: PlaybackState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async play(): Promise<void> {
      if (disposed) return;
      setState("loading");
      try {
        await audio.play();
        setState("playing");
      } catch {
        setState("error");
      }
    },
    pause(): void {
      if (disposed) return;
      audio.pause();
      setState("paused");
    },
    async replay(): Promise<void> {
      if (disposed) return;
      audio.currentTime = 0;
      await this.play();
    },
    setPlaybackRate(speed: PlaybackSpeed): void {
      if (disposed) return;
      if (!PLAYBACK_SPEEDS.includes(speed)) throw new RangeError("Unsupported playback speed.");
      audio.playbackRate = speed;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      audio.pause();
      for (const eventName of Object.keys(eventStates).concat(["canplay", "loadedmetadata"])) {
        audio.removeEventListener(eventName, handleAudioEvent);
      }
      listeners.clear();
    },
  };
}
