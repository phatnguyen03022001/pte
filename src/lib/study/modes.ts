export type StudyMode = "flashcards" | "listen-write" | "listen-repeat";
export type StudyScope = "scheduled" | "all";

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  flashcards: "Flashcards",
  "listen-write": "Listen & Write",
  "listen-repeat": "Listen & Repeat",
};

const MODES_BY_TYPE: Record<string, readonly StudyMode[]> = {
  "01-ra": ["flashcards", "listen-repeat"],
  "02-rs": ["flashcards", "listen-repeat", "listen-write"],
  "03-di": ["flashcards", "listen-repeat"],
  "04-rl": ["flashcards", "listen-repeat", "listen-write"],
  "06-sgd": ["flashcards", "listen-repeat", "listen-write"],
  "07-rts": ["flashcards", "listen-repeat"],
  "08-swt": ["flashcards"],
  "09-we": ["flashcards"],
  "10-fib-r-dropdown": ["flashcards"],
  "12-rop": ["flashcards"],
  "13-fib-r-drag-and-drop": ["flashcards"],
  "15-sst": ["flashcards", "listen-write"],
  "17-fib-l": ["flashcards", "listen-write"],
  "21-hiw": ["flashcards", "listen-write"],
  "22-wfd": ["flashcards", "listen-write"],
};

export function getStudyModes(typeKey: string): StudyMode[] {
  return [...(typeKey === "vocabulary" ? ["flashcards" as const] : MODES_BY_TYPE[typeKey] ?? ["flashcards"] )];
}

export function isStudyMode(value: unknown): value is StudyMode {
  return value === "flashcards" || value === "listen-write" || value === "listen-repeat";
}

export function isStudyScope(value: unknown): value is StudyScope {
  return value === "scheduled" || value === "all";
}
