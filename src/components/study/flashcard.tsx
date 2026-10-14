import { Button } from "@/components/ui/button";
import type { StudyItem } from "@/lib/study/adapters";
import { compareAnswers } from "@/lib/study/answer-comparison";

type FlashcardProps = {
  item: StudyItem;
  revealed: boolean;
  response: string;
  onReveal(): void;
  onResponse(value: string): void;
};

export function Flashcard({ item, revealed, response, onReveal, onResponse }: FlashcardProps) {
  const referenceText = item.reference.join(". ");
  const hasComparableReference = !item.identity.includes(":12-rop:") && !item.identity.includes(":21-hiw:");
  const comparison = revealed && response && referenceText && hasComparableReference ? compareAnswers(response, referenceText) : null;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-7" aria-label="Flashcard">
      {item.vocabulary && <p className="text-xs font-semibold uppercase tracking-wide text-brand-text">Tier {item.vocabulary.tier}</p>}
      {item.imageUrl ? (
        // The URL is supplied only by a trusted media resolver.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="Question prompt" className="max-h-80 w-full rounded-lg border object-contain" />
      ) : item.imageExpected ? (
        <p className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">Verified image media is unavailable.</p>
      ) : null}
      <div className="space-y-3">
        {item.front.length ? item.front.map((line, index) => (
          <p key={`${index}-${line}`} className={index === 0 ? "text-lg font-medium leading-relaxed" : "whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"}>{line}</p>
        )) : <p className="text-sm text-muted-foreground">This item has no displayable prompt.</p>}
      </div>
      {item.vocabulary?.ipa && <p className="text-sm text-muted-foreground">IPA: {item.vocabulary.ipa}</p>}
      {item.responseLabel && (
        <label className="block space-y-2 text-sm font-medium" htmlFor="study-response">
          <span>{item.responseLabel}</span>
          <textarea
            id="study-response"
            value={response}
            onChange={(event) => onResponse(event.target.value)}
            disabled={revealed}
            rows={typeRows(item)}
            placeholder={item.responsePlaceholder}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70"
          />
        </label>
      )}
      {revealed ? (
        <div className="space-y-2 rounded-lg border bg-surface p-4" aria-live="polite">
          <h3 className="text-sm font-semibold">Reference</h3>
          {item.referenceAvailable
            ? item.reference.map((line, index) => <p key={`${index}-${line}`} className="whitespace-pre-wrap text-sm leading-relaxed">{line}</p>)
            : <p className="text-sm text-muted-foreground">No reference answer is available. Review your attempt against the prompt yourself.</p>}
          {response && <p className="whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Your response: </span>{response}</p>}
          {comparison && (
            <div className="space-y-1 text-xs" aria-label="Text differences">
              {comparison.mismatched.map(({ expected, actual }, index) => <p key={`m-${index}`}>Expected <span className="text-destructive">{expected}</span>; entered <span className="text-brand-text">{actual}</span></p>)}
              {comparison.missing.map((word, index) => <p key={`missing-${index}`} className="text-destructive">Missing: {word}</p>)}
              {comparison.extra.map((word, index) => <p key={`extra-${index}`} className="text-brand-text">Extra: {word}</p>)}
              {!comparison.missing.length && !comparison.extra.length && !comparison.mismatched.length && <p className="text-muted-foreground">Words match after case and punctuation normalization.</p>}
            </div>
          )}
        </div>
      ) : <Button type="button" variant="outline" onClick={onReveal}>Reveal Answer</Button>}
    </section>
  );
}

function typeRows(item: StudyItem): number {
  return item.identity.includes(":08-swt:") ? 4 : item.identity.includes(":09-we:") ? 8 : 3;
}
