import { AudioPlayer } from "@/components/audio/audio-player";
import { Button } from "@/components/ui/button";
import { compareAnswers } from "@/lib/study/answer-comparison";
import type { StudyItem } from "@/lib/study/adapters";

type DictationProps = {
  item: StudyItem;
  response: string;
  revealed: boolean;
  onResponse(value: string): void;
  onReveal(): void;
  onSkip(): void;
};

export function Dictation({ item, response, revealed, onResponse, onReveal, onSkip }: DictationProps) {
  const reference = item.reference.join(". ");
  const comparison = revealed && reference ? compareAnswers(response, reference) : null;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-7" aria-label="Listen and write">
      {item.audioUrl ? <AudioPlayer src={item.audioUrl} label="Original audio" /> : (
        <p role="status" className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
          Listen &amp; Write is unavailable for this item because verified playable audio is not available. No audio was generated.
        </p>
      )}
      {!item.audioUrl && <Button type="button" variant="outline" onClick={onSkip}>Skip unavailable item</Button>}
      <label htmlFor="dictation-response" className="block text-sm font-medium">Your response</label>
      <textarea
        id="dictation-response"
        value={response}
        onChange={(event) => onResponse(event.target.value)}
        disabled={!item.audioUrl}
        rows={5}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Type what you hear…"
      />
      {item.audioUrl && !revealed && <Button type="button" variant="outline" onClick={onReveal}>Reveal Reference</Button>}
      {revealed && (
        <div className="space-y-3 rounded-lg border bg-surface p-4" aria-live="polite">
          <h3 className="text-sm font-semibold">Reference</h3>
          {item.referenceAvailable
            ? item.reference.map((line, index) => <p key={`${index}-${line}`} className="whitespace-pre-wrap text-sm leading-relaxed">{line}</p>)
            : <p className="text-sm text-muted-foreground">No reference transcript is available. Review your attempt yourself.</p>}
          {comparison && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Your response</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{response || "No response entered."}</p>
              <p className="text-xs text-muted-foreground">Comparison ignores capitalization and punctuation. It does not estimate pronunciation or a PTE score.</p>
              {comparison.mismatched.map(({ expected, actual }, index) => <p key={`m-${index}`}><span className="text-destructive">Expected: {expected}</span> · <span className="text-brand-text">Entered: {actual}</span></p>)}
              {comparison.missing.map((word, index) => <p key={`missing-${index}`} className="text-destructive">Missing: {word}</p>)}
              {comparison.extra.map((word, index) => <p key={`extra-${index}`} className="text-brand-text">Extra: {word}</p>)}
              {!comparison.missing.length && !comparison.extra.length && !comparison.mismatched.length && <p className="text-muted-foreground">Words match after normalization.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
