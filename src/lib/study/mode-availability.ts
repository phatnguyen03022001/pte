import type { StudyItem } from "@/lib/study/adapters";
import type { StudyMode } from "@/lib/study/modes";

export function canPracticeMode(mode: StudyMode, typeKey: string, item: StudyItem): boolean {
  if (mode === "flashcards") return true;
  if (mode === "listen-write") return Boolean(item.audioUrl);
  if (mode === "listen-repeat" && typeKey === "01-ra") return item.front.length > 0;
  if (mode === "listen-repeat" && typeKey === "03-di") return Boolean(item.imageUrl);
  return Boolean(item.audioUrl);
}
