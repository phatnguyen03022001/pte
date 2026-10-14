import { getQuestionTypeByKey } from "@/lib/study/question-types";

export const DATA_PROVIDER = "apeuni" as const;

export function questionIdentity(typeKey: string, questionId: number): string {
  if (!getQuestionTypeByKey(typeKey) || !Number.isSafeInteger(questionId) || questionId <= 0) {
    throw new TypeError("Invalid canonical question identity.");
  }
  return `${DATA_PROVIDER}:question:${typeKey}:${questionId}`;
}

export function vocabularyIdentity(key: string): string {
  if (!key || key.length > 512 || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new TypeError("Invalid canonical vocabulary identity.");
  }
  return `${DATA_PROVIDER}:vocabulary:${key}`;
}

export function isCanonicalItemIdentity(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 640) return false;

  const vocabularyPrefix = `${DATA_PROVIDER}:vocabulary:`;
  if (value.startsWith(vocabularyPrefix)) {
    const key = value.slice(vocabularyPrefix.length);
    return key.length > 0 && !/[\u0000-\u001f\u007f]/.test(key);
  }

  const match = /^apeuni:question:(\d{2}-[a-z0-9-]+):([1-9]\d*)$/.exec(value);
  if (!match || !getQuestionTypeByKey(match[1])) return false;
  const questionId = Number(match[2]);
  return Number.isSafeInteger(questionId) && questionIdentity(match[1], questionId) === value;
}
