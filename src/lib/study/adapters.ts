import type { QuestionRecord, VocabularyEntry } from "@/lib/datasets/engine";
import { isPlayableAudioSource } from "@/lib/audio/playback";
import { questionIdentity, vocabularyIdentity } from "@/lib/study/item-identity";

export type StudyItem = {
  identity: string;
  front: string[];
  reference: string[];
  referenceAvailable: boolean;
  audioUrl: string | null;
  imageUrl: string | null;
  audioExpected: boolean;
  imageExpected: boolean;
  responseLabel?: string;
  responsePlaceholder?: string;
  vocabulary?: {
    word: string;
    meaning: string;
    ipa?: string;
    partsOfSpeech: string[];
    lists: string[];
    tier: number;
  };
};

export type TrustedMedia = { audioUrl?: string | null; imageUrl?: string | null };

function textField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [entry.trim()];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const text = textField(record, "text", "paragraph", "content", "word", "label", "correction", "answer", "correct", "incorrect");
      return text ? [text] : [];
    }
    return [];
  });
}

function optionsByGap(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((options, index) => {
    const choices = strings(options);
    return choices.length ? [`Gap ${index + 1} options: ${choices.join(" · ")}`] : [];
  });
}

function trustedMediaUrl(value: string | null | undefined): string | null {
  if (!value || !isPlayableAudioSource(value)) return null;
  try {
    const url = new URL(value, "https://pte-study.invalid");
    return url.protocol === "https:" && url.origin !== "https://pte-study.invalid" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function questionPrompt(typeKey: string, record: QuestionRecord): string[] {
  if (typeKey === "02-rs") return ["Repeat the sentence after listening to the original audio."];
  if (typeKey === "22-wfd") return ["Listen to the original sentence, then write what you hear."];
  const fields: Record<string, string[]> = {
    "01-ra": ["text"], "02-rs": ["text"], "03-di": ["title", "prompt"],
    "04-rl": ["title", "preview"], "05-asq": ["text"], "06-sgd": ["title"],
    "07-rts": ["title", "prompt"], "08-swt": ["title", "passage"],
    "09-we": ["title", "prompt"], "10-fib-r-dropdown": ["title", "passage"],
    "11-mcma-r": ["title", "prompt", "text", "passage"], "12-rop": ["title"],
    "13-fib-r-drag-and-drop": ["title", "passage"], "14-mcsa-r": ["title", "prompt", "text", "passage"],
    "15-sst": ["title", "preview"], "16-mcma-l": ["title", "prompt", "text"],
    "17-fib-l": ["title", "passage"], "18-hcs": ["title", "prompt", "text"],
    "19-mcsa-l": ["title", "prompt", "text"], "20-smw": ["title", "prompt", "text"],
    "21-hiw": ["title", "transcript"], "22-wfd": ["text"],
  };
  const keys = fields[typeKey] ?? ["title", "prompt", "text", "passage", "transcript"];
  const seen = new Set<string>();
  return keys.flatMap((key) => {
    const value = textField(record, key);
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}

function questionReference(typeKey: string, record: QuestionRecord): string[] {
  const reference: string[] = [];
  const direct = typeKey === "21-hiw" ? textField(record, "answer") : textField(record, "answer", "transcript");
  if (direct) reference.push(direct);
  if (typeKey === "17-fib-l" && textField(record, "transcript")) return reference;
  if (typeKey === "02-rs" || typeKey === "22-wfd") {
    const sentence = textField(record, "text");
    if (sentence) reference.push(sentence);
  }
  reference.push(...strings(record.answers));
  if (typeKey === "12-rop") {
    const paragraphs = strings(record.paragraphs);
    const order = Array.isArray(record.answer_order) ? record.answer_order : [];
    const ordered = order.flatMap((value) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) return [];
      const paragraph = paragraphs[value - 1];
      return paragraph ? [paragraph] : [];
    });
    if (ordered.length === paragraphs.length) reference.push(...ordered);
  }
  if (typeKey === "21-hiw") {
    reference.push(...strings(record.incorrect_words));
    reference.push(...strings(record.corrections));
  }
  return reference;
}

export function adaptQuestionItem(typeKey: string, record: QuestionRecord, media: TrustedMedia = {}): StudyItem {
  const imageUrl = trustedMediaUrl(media.imageUrl);
  const front = questionPrompt(typeKey, record);
  if (typeKey === "12-rop") {
    front.push(...strings(record.paragraphs).map((paragraph, index) => `${index + 1}. ${paragraph}`));
  }
  if (typeKey === "13-fib-r-drag-and-drop") {
    const wordBank = strings(record.word_bank);
    if (wordBank.length) front.push(`Word bank: ${wordBank.join(" · ")}`);
  }
  if (typeKey === "10-fib-r-dropdown") {
    front.push(...optionsByGap(record.options_by_gap));
  }
  if (typeKey === "13-fib-r-drag-and-drop") {
    front.push(...optionsByGap(record.options_by_gap));
  }
  const acceptsResponse = !["03-di", "04-rl", "06-sgd", "vocabulary"].includes(typeKey);
  return {
    identity: questionIdentity(typeKey, record.id),
    front,
    reference: questionReference(typeKey, record),
    referenceAvailable: questionReference(typeKey, record).length > 0,
    audioUrl: trustedMediaUrl(media.audioUrl),
    imageUrl,
    audioExpected: Boolean(record.audio || record.audio_provider_url),
    imageExpected: Boolean(record.image),
    ...(acceptsResponse ? {
      responseLabel: "Your answer",
      responsePlaceholder: typeKey === "12-rop"
        ? "Enter the paragraph order, for example 2, 1, 3…"
        : typeKey.startsWith("10-") || typeKey.startsWith("13-")
          ? "Enter your answers in order…"
          : "Write your attempt before revealing the reference…",
    } : {}),
  };
}

export function adaptVocabularyItem(entry: VocabularyEntry): StudyItem {
  const word = textField(entry, "word") ?? "Vocabulary item";
  const meanings = strings(entry.meanings_vi);
  const meaning = meanings.length ? meanings.join("; ") : textField(entry, "meaning_vi") ?? "";
  const partsOfSpeech = strings(entry.parts_of_speech);
  const extra = [
    ...partsOfSpeech.map((part) => `Part of speech: ${part}`),
    ...(typeof entry.family === "string" && entry.family.trim() ? [`Word family: ${entry.family.trim()}`] : []),
    ...strings(entry.phrases).map((phrase) => `Phrase: ${phrase}`),
  ];
  return {
    identity: vocabularyIdentity(entry.key),
    front: [word],
    reference: meaning ? [meaning, ...extra] : extra,
    referenceAvailable: Boolean(meaning || extra.length),
    audioUrl: null,
    imageUrl: null,
    audioExpected: false,
    imageExpected: false,
    vocabulary: {
      word,
      meaning,
      ...(typeof entry.ipa === "string" && entry.ipa.trim() ? { ipa: entry.ipa.trim() } : {}),
      partsOfSpeech,
      lists: strings(entry.lists),
      tier: Number.isSafeInteger(entry.tier) ? entry.tier : 0,
    },
  };
}

export function adaptStudyItem(typeKey: string, item: QuestionRecord | VocabularyEntry, media: TrustedMedia = {}): StudyItem {
  return typeKey === "vocabulary"
    ? adaptVocabularyItem(item as VocabularyEntry)
    : adaptQuestionItem(typeKey, item as QuestionRecord, media);
}
