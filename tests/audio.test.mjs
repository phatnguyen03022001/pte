import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function loadTs(path, replacements = []) {
  let source = transpile(await readFile(new URL(path, import.meta.url), "utf8"));
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const types = await loadTs("../src/lib/audio/types.ts");
const typesUrl = `data:text/javascript;base64,${Buffer.from(transpile(await readFile(new URL("../src/lib/audio/types.ts", import.meta.url), "utf8"))).toString("base64")}`;
const playback = await loadTs("../src/lib/audio/playback.ts", [['from "@/lib/audio/types"', `from "${typesUrl}"`]]);
const recorder = await loadTs("../src/lib/audio/recorder.ts", [['from "@/lib/audio/types"', `from "${typesUrl}"`]]);

class FakeAudio {
  currentTime = 0;
  duration = 20;
  playbackRate = 1;
  listeners = new Map();
  paused = true;
  async play() { this.paused = false; this.emit("playing"); }
  pause() { this.paused = true; this.emit("pause"); }
  addEventListener(name, listener) {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener);
    this.listeners.set(name, set);
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name) { for (const listener of this.listeners.get(name) ?? []) listener({ type: name }); }
}

function createRecorderHarness({ supported = ["audio/webm;codecs=opus"], permissionError, deferredPermission = false, maxDurationMs = 1000, maxRecordingBytes = 1000 } = {}) {
  const tracks = [{ stopped: 0, stop() { this.stopped += 1; } }];
  const stream = { getTracks: () => tracks };
  const urls = new Map();
  const revoked = [];
  const timers = new Map();
  let timerId = 0;
  let clock = 100;
  let getUserMediaCalls = 0;
  let resolvePermission;
  let recorderInstance;
  class FakeMediaRecorder {
    static isTypeSupported(type) { return supported.includes(type); }
    mimeType = supported[0] ?? "";
    state = "inactive";
    ondataavailable = null;
    onerror = null;
    onstop = null;
    start(timeslice) { this.state = "recording"; this.timeslice = timeslice; }
    stop() {
      if (this.state !== "recording") return;
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["captured audio"], { type: this.mimeType }) });
      this.onstop?.();
    }
    push(data) { this.ondataavailable?.({ data }); }
    fail() { this.onerror?.({ type: "error" }); }
  }
  const environment = {
    mediaDevices: {
      async getUserMedia(constraints) {
        getUserMediaCalls += 1;
        assert.deepEqual(constraints, { audio: true, video: false });
        if (permissionError) throw Object.assign(new Error("private browser detail"), { name: permissionError });
        if (deferredPermission) return new Promise((resolve) => { resolvePermission = () => resolve(stream); });
        return stream;
      },
    },
    MediaRecorder: new Proxy(FakeMediaRecorder, { construct(target, args) { recorderInstance = Reflect.construct(target, args); return recorderInstance; } }),
    Blob,
    URL: {
      createObjectURL(blob) { const url = `blob:test-${urls.size + 1}`; urls.set(url, blob); return url; },
      revokeObjectURL(url) { revoked.push(url); urls.delete(url); },
    },
    setTimer(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    now() { return clock; },
  };
  const controller = recorder.createAudioRecorder(environment, { maxDurationMs, maxRecordingBytes });
  return {
    controller,
    tracks,
    urls,
    revoked,
    timers,
    getRecorder: () => recorderInstance,
    getUserMediaCalls: () => getUserMediaCalls,
    resolvePermission: () => resolvePermission?.(),
    advance(ms) { clock += ms; },
    fireTimer() { [...timers.values()][0]?.callback(); },
  };
}

test("playback supports play, pause, replay, speed selection, and state transitions", async () => {
  const audio = new FakeAudio();
  const player = playback.createAudioPlayback(audio);
  const seen = [];
  player.subscribe((state) => seen.push(state));
  await player.play();
  assert.equal(player.getState(), "playing");
  player.pause();
  assert.equal(player.getState(), "paused");
  audio.currentTime = 19;
  await player.replay();
  assert.equal(audio.currentTime, 0);
  assert.equal(player.getState(), "playing");
  player.setPlaybackRate(1.25);
  assert.equal(audio.playbackRate, 1.25);
  assert.deepEqual(seen, ["loading", "playing", "paused", "loading", "playing"]);
  assert.throws(() => player.setPlaybackRate(2), RangeError);
  player.dispose();
});

test("seeking clamps positions to the media duration and ignores invalid values", () => {
  const audio = new FakeAudio();
  assert.equal(playback.seekAudio(audio, 8.5), 8.5);
  assert.equal(playback.seekAudio(audio, -3), 0);
  assert.equal(playback.seekAudio(audio, 50), 20);
  audio.duration = Number.NaN;
  audio.currentTime = 4;
  assert.equal(playback.seekAudio(audio, 8), 4);
  assert.equal(playback.seekAudio(audio, Number.NaN), 4);
});

test("missing or unsafe audio sources are rejected and audio load failures are surfaced", async () => {
  assert.equal(playback.isPlayableAudioSource(null), false);
  assert.equal(playback.isPlayableAudioSource("/Users/private/audio.mp3"), false);
  assert.equal(playback.isPlayableAudioSource("file:///private/audio.mp3"), false);
  assert.equal(playback.isPlayableAudioSource("javascript:alert(1)"), false);
  assert.equal(playback.isPlayableAudioSource("https://user:secret@example.test/audio.mp3"), false);
  const audio = new FakeAudio();
  const player = playback.createAudioPlayback(audio);
  audio.emit("error");
  assert.equal(player.getState(), "error");
  const failing = new FakeAudio();
  failing.play = async () => { throw new Error("load failed"); };
  const second = playback.createAudioPlayback(failing);
  await second.play();
  assert.equal(second.getState(), "error");
  player.dispose();
  second.dispose();
});

test("unsupported recorder APIs and unsupported MIME types fail safely", async () => {
  const unsupported = recorder.createAudioRecorder(null);
  assert.equal(unsupported.getSnapshot().status, "unsupported");
  assert.equal(unsupported.getSnapshot().error, "unsupported-browser");
  const harness = createRecorderHarness({ supported: [] });
  await harness.controller.start();
  assert.equal(harness.controller.getSnapshot().error, "unsupported-format");
  assert.equal(harness.getUserMediaCalls(), 0);
});

test("permission denial is mapped to a controlled error without leaking internals", async () => {
  const harness = createRecorderHarness({ permissionError: "NotAllowedError" });
  await harness.controller.start();
  assert.equal(harness.controller.getSnapshot().status, "error");
  assert.equal(harness.controller.getSnapshot().error, "permission-denied");
  assert.equal(JSON.stringify(harness.controller.getSnapshot()).includes("private browser detail"), false);
});

test("recording starts only after interaction, stops tracks, and creates a local playable Blob URL", async () => {
  const harness = createRecorderHarness();
  assert.equal(harness.getUserMediaCalls(), 0);
  await harness.controller.start();
  assert.equal(harness.controller.getSnapshot().status, "recording");
  assert.equal(harness.getRecorder().timeslice, 1000);
  harness.advance(2100);
  harness.controller.stop();
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.durationMs, 1000);
  assert.ok(snapshot.recordingUrl.startsWith("blob:test-"));
  assert.ok(harness.urls.get(snapshot.recordingUrl) instanceof Blob);
  assert.equal(harness.tracks[0].stopped, 1);
});

test("discarding and replacing recordings revoke their previous object URLs", async () => {
  const harness = createRecorderHarness();
  await harness.controller.start();
  harness.controller.stop();
  const firstUrl = harness.controller.getSnapshot().recordingUrl;
  await harness.controller.start();
  assert.ok(harness.revoked.includes(firstUrl));
  harness.controller.stop();
  const secondUrl = harness.controller.getSnapshot().recordingUrl;
  harness.controller.discard();
  assert.ok(harness.revoked.includes(secondUrl));
  assert.equal(harness.controller.getSnapshot().recordingUrl, null);
  assert.equal(harness.urls.size, 0);
});

test("unmount cleanup stops the microphone and revokes a recording URL", async () => {
  const harness = createRecorderHarness();
  await harness.controller.start();
  harness.controller.stop();
  const url = harness.controller.getSnapshot().recordingUrl;
  harness.controller.dispose();
  assert.equal(harness.tracks[0].stopped, 1);
  assert.ok(harness.revoked.includes(url));
  assert.equal(harness.urls.size, 0);
});

test("concurrent start requests cannot create multiple microphone captures", async () => {
  const harness = createRecorderHarness();
  await Promise.all([harness.controller.start(), harness.controller.start()]);
  assert.equal(harness.getUserMediaCalls(), 1);
  assert.equal(harness.controller.getSnapshot().status, "recording");
});

test("empty recordings, duration limits, and memory limits are handled", async () => {
  const empty = createRecorderHarness();
  await empty.controller.start();
  empty.getRecorder().ondataavailable({ data: new Blob([]) });
  empty.getRecorder().onstop();
  assert.equal(empty.controller.getSnapshot().error, "empty-recording");

  const timed = createRecorderHarness({ maxDurationMs: 500 });
  await timed.controller.start();
  timed.advance(500);
  timed.fireTimer();
  assert.equal(timed.controller.getSnapshot().status, "ready");
  assert.equal(timed.controller.getSnapshot().durationMs, 500);

  const bounded = createRecorderHarness({ maxRecordingBytes: 2 });
  await bounded.controller.start();
  bounded.getRecorder().push(new Blob(["too large"]));
  assert.equal(bounded.controller.getSnapshot().error, "recording-too-large");
});

test("discarding while permission is pending stops the late stream", async () => {
  const harness = createRecorderHarness({ deferredPermission: true });
  const start = harness.controller.start();
  assert.equal(harness.controller.getSnapshot().status, "requesting-permission");
  harness.controller.discard();
  harness.resolvePermission();
  await start;
  assert.equal(harness.tracks[0].stopped, 1);
  assert.equal(harness.controller.getSnapshot().status, "idle");
});

test("audio engine contains no persistence or upload integration", async () => {
  const source = await readFile(new URL("../src/lib/audio/recorder.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|indexedDB|supabase|cloudinary/i);
  assert.equal(types.PLAYBACK_SPEEDS.join(","), "0.75,1,1.25");
});
