import { AudioPlayer } from "@/components/audio/audio-player";
import { AudioRecorder } from "@/components/audio/audio-recorder";
import { Button } from "@/components/ui/button";
import type { StudyItem } from "@/lib/study/adapters";
import { canPracticeMode } from "@/lib/study/mode-availability";

type SpeakingPracticeProps = {
  item: StudyItem;
  typeKey: string;
  revealed: boolean;
  onReveal(): void;
  onSkip(): void;
};

export function SpeakingPractice({ item, typeKey, revealed, onReveal, onSkip }: SpeakingPracticeProps) {
  const recordFromPrompt = item.identity.startsWith("apeuni:question:01-ra:") || item.identity.startsWith("apeuni:question:03-di:");
  const available = canPracticeMode("listen-repeat", typeKey, item);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-7" aria-label="Listen and repeat">
      {item.audioUrl ? <AudioPlayer src={item.audioUrl} label="Original audio" /> : recordFromPrompt ? (
        <p role="status" className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
          This speaking activity uses the visible prompt and microphone; original audio is not required.
        </p>
      ) : (
        <p role="status" className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
          This audio-dependent speaking activity is unavailable because verified original audio is missing.
        </p>
      )}
      {item.front.map((line, index) => <p key={`${index}-${line}`} className="whitespace-pre-wrap text-sm leading-relaxed">{line}</p>)}
      {item.imageUrl ? (
        // The URL is supplied only by a trusted media resolver.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="Speaking prompt" className="max-h-80 w-full rounded-lg border object-contain" />
      ) : item.imageExpected ? (
        <p role="status" className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">Verified image media is unavailable; no image was fabricated.</p>
      ) : null}
      {!available ? (
        <div className="space-y-2" role="status">
          <p className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">This audio-dependent speaking activity is unavailable because verified original audio is missing.</p>
          <Button type="button" variant="outline" onClick={onSkip}>Skip unavailable item</Button>
        </div>
      ) : <AudioRecorder key={item.identity} maxDurationMs={180_000} />}
      {available && !revealed && <Button type="button" variant="outline" onClick={onReveal}>{item.referenceAvailable ? "Reveal Reference" : "Mark self-review complete"}</Button>}
      {available && revealed && <div className="rounded-lg border bg-surface p-4" aria-live="polite">
        <h3 className="text-sm font-semibold">Reference</h3>
        {item.referenceAvailable
          ? item.reference.map((line, index) => <p key={`${index}-${line}`} className="mt-2 whitespace-pre-wrap text-sm">{line}</p>)
          : <p className="mt-2 text-sm text-muted-foreground">No reference answer is available. Review your response yourself.</p>}
      </div>}
    </section>
  );
}
