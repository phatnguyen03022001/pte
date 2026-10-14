import { Button } from "@/components/ui/button";
import { RATING_NAMES, type ReviewRating } from "@/lib/review/types";

type ReviewControlsProps = {
  revealed: boolean;
  submitting: boolean;
  blocked: boolean;
  canContinue: boolean;
  onRate(rating: ReviewRating): void;
  onNext(): void;
};

export function ReviewControls({ revealed, submitting, blocked, canContinue, onRate, onNext }: ReviewControlsProps) {
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">How well did you know it?</p>
      <div className="flex flex-wrap gap-2">
        {RATING_NAMES.map((rating) => (
          <Button key={rating} type="button" variant="outline" disabled={!revealed || submitting || blocked} onClick={() => onRate(rating)}>
            {rating}
          </Button>
        ))}
        <Button type="button" disabled={!canContinue || submitting || blocked} onClick={onNext}>
          {submitting ? "Saving…" : "Next card"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">FSRS ratings describe recall only; they are not PTE scores.</p>
    </div>
  );
}
