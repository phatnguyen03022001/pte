"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dictation } from "@/components/study/dictation";
import { Flashcard } from "@/components/study/flashcard";
import { ReviewControls } from "@/components/study/review-controls";
import { SpeakingPractice } from "@/components/study/speaking-practice";
import type { StudyItem } from "@/lib/study/adapters";
import type { ReviewRating } from "@/lib/review/types";
import { getStudyModes, STUDY_MODE_LABELS, type StudyMode, type StudyScope } from "@/lib/study/modes";
import { canPracticeMode } from "@/lib/study/mode-availability";
import { loadStudyItem, startStudySession, submitStudyReview } from "@/app/(protected)/study/[type]/actions";

type StudyRunnerProps = {
  typeKey: string;
  datasetId: string;
  datasetLabel: string;
  datasetCount: number;
  available: boolean;
};

type Session = {
  queue: string[];
  index: number;
  item: StudyItem | null;
  persistenceAvailable: boolean;
  mode: StudyMode;
};

export function StudyRunner({ typeKey, datasetId, datasetLabel, datasetCount, available }: StudyRunnerProps) {
  const modes = getStudyModes(typeKey);
  const [mode, setMode] = useState<StudyMode>(modes[0] ?? "flashcards");
  const [scope, setScope] = useState<StudyScope>("scheduled");
  const [session, setSession] = useState<Session | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [response, setResponse] = useState("");
  const [rated, setRated] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);

  async function withBusy(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      setMessage("The study request failed. Check the service and try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function resetSession() {
    setSession(null);
    setRevealed(false);
    setResponse("");
    setRated(false);
    setConflicted(false);
    setMessage("");
  }

  async function start() {
    await withBusy(async () => {
      resetSession();
      const result = await startStudySession(typeKey, datasetId, mode, scope);
      if (result.status !== "ok") {
        setMessage(result.message);
        return;
      }
      setSession({ queue: result.queue, index: 0, item: result.item, persistenceAvailable: result.persistenceAvailable, mode: result.mode });
      setMessage(result.queue.length ? "" : result.dataset.count === 0
        ? "This selected dataset is empty. Choose another dataset to study."
        : scope === "scheduled"
        ? "No new or due items are available. Choose All selected items to revisit the dataset without resetting FSRS history."
        : "This dataset has no usable items.");
    });
  }

  async function next() {
    if (!session) return;
    if (conflicted) return;
    await withBusy(async () => {
      const nextIndex = session.index + 1;
      if (nextIndex >= session.queue.length) {
        setSession({ ...session, index: nextIndex, item: null });
        setMessage("Session complete.");
        return;
      }
      const result = await loadStudyItem(typeKey, datasetId, session.queue[nextIndex], session.mode);
      if (result.status !== "ok") {
        setMessage(result.message);
        return;
      }
      setSession({ ...session, index: nextIndex, item: result.item });
      setRevealed(false);
      setResponse("");
      setRated(false);
      setMessage("");
    });
  }

  async function rate(rating: ReviewRating) {
    const item = session?.item;
    if (!session || !item || !revealed || rated || conflicted) return;
    await withBusy(async () => {
      const result = await submitStudyReview(typeKey, datasetId, item.identity, rating);
      if (result.status === "saved") {
        setRated(true);
        setMessage(`Review saved. Next review is scheduled for ${new Date(result.nextDueAt).toLocaleString()}.`);
      } else if (result.status === "not-saved") {
        setRated(true);
        setMessage(`${result.message} Practice can continue, but FSRS history was not saved.`);
      } else {
        if (result.status === "conflict") setConflicted(true);
        setMessage(result.message);
      }
    });
  }

  async function skipUnavailable() {
    setRated(true);
    setMessage("This item was skipped because verified media is unavailable. No FSRS review was submitted.");
    await next();
  }

  const activeItem = session?.item ?? null;
  const activeMode = session?.mode ?? mode;
  const activeItemAvailable = activeItem ? canPracticeMode(activeMode, typeKey, activeItem) : false;

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="study-runner-heading">
      <div className="space-y-1">
        <h2 id="study-runner-heading" className="text-lg font-semibold">Study session</h2>
        <p className="text-sm text-muted-foreground">Dataset: {datasetLabel} · {datasetCount} {datasetCount === 1 ? "item" : "items"}</p>
      </div>

      {!session && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Learning mode
            <select value={mode} onChange={(event) => { setMode(event.target.value as StudyMode); resetSession(); }} disabled={!available || busy}
              className="min-h-10 rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {modes.map((value) => <option key={value} value={value}>{STUDY_MODE_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Queue
            <select value={scope} onChange={(event) => { setScope(event.target.value as StudyScope); resetSession(); }} disabled={!available || busy}
              className="min-h-10 rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="scheduled">New and due items</option>
              <option value="all">All selected items</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button type="button" onClick={() => void start()} disabled={!available || busy || datasetCount === 0}>
              {busy ? "Preparing…" : "Start studying"}
            </Button>
          </div>
        </div>
      )}

      {session && !session.persistenceAvailable && (
        <p role="status" className="rounded-md border border-orange-500/40 bg-orange-50 p-3 text-sm text-foreground dark:bg-orange-950/20">
          Review history is unavailable. You can practice temporarily, but FSRS history is not saved.
        </p>
      )}

      {session && activeItem && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Item {session.index + 1} of {session.queue.length}</span>
            <span className="rounded-md border px-2 py-1 text-xs font-medium">{STUDY_MODE_LABELS[session.mode]}</span>
          </div>
          {session.mode === "flashcards" && <Flashcard key={activeItem.identity} item={activeItem} revealed={revealed} response={response} onResponse={setResponse} onReveal={() => setRevealed(true)} />}
          {session.mode === "listen-write" && <Dictation key={activeItem.identity} item={activeItem} response={response} revealed={revealed} onResponse={setResponse} onReveal={() => setRevealed(true)} onSkip={() => void skipUnavailable()} />}
          {session.mode === "listen-repeat" && <SpeakingPractice key={activeItem.identity} item={activeItem} typeKey={typeKey} revealed={revealed} onReveal={() => setRevealed(true)} onSkip={() => void skipUnavailable()} />}
          {activeItemAvailable && (
            <ReviewControls revealed={revealed} submitting={busy} blocked={conflicted} canContinue={rated} onRate={(value) => void rate(value)} onNext={() => void next()} />
          )}
          {conflicted && <Button type="button" variant="outline" onClick={() => void start()}>Reload session</Button>}
        </div>
      )}

      {session && !activeItem && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-4">
          <p className="text-sm">{message || "No new or due items are available in this session."}</p>
          <Button type="button" variant="outline" onClick={resetSession}>Choose another session</Button>
        </div>
      )}

      {message && activeItem && <p role="status" aria-live="polite" className="rounded-md border bg-surface p-3 text-sm">{message}</p>}
    </section>
  );
}
