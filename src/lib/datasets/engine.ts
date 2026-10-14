import "server-only";

import { createHash } from "node:crypto";
import { lstat, open, realpath, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { getQuestionTypeByKey, QUESTION_TYPES } from "@/lib/study/question-types";
import { vocabularyIdentity } from "@/lib/study/item-identity";

export { DATA_PROVIDER, questionIdentity, vocabularyIdentity } from "@/lib/study/item-identity";

export type DatasetStatus = "available" | "empty" | "missing" | "invalid" | "not-found";
export type DatasetKind = "all" | "collection" | "tier" | "list";
export type DatasetErrorCode =
  | "question-bank-missing"
  | "vocabulary-missing"
  | "invalid-json"
  | "invalid-question-bank"
  | "invalid-collection"
  | "invalid-vocabulary"
  | "invalid-path"
  | "dataset-not-found";

export type DatasetOption = {
  id: string;
  label: string;
  kind: DatasetKind;
  status: DatasetStatus;
  count: number;
  errorCode?: DatasetErrorCode;
  message?: string;
};

export type QuestionRecord = Record<string, unknown> & { id: number };
export type VocabularyEntry = Record<string, unknown> & {
  key: string;
  tier: number;
  lists: string[];
};

export type DatasetResolution<T> = {
  dataset: DatasetOption;
  options: DatasetOption[];
  items: T[];
};

export class DatasetEngineError extends Error {
  constructor(
    readonly code: DatasetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DatasetEngineError";
  }
}

type SafePath = { path: string; exists: boolean };
type ParsedJsonCacheEntry = { inode: string; size: string; modifiedAt: string; value: unknown };
type CollectionRecord = { filename: string; id: string; label: string };
type ParsedCollection = Record<string, number[]>;
type BankRead = { status: "available" | "empty" | "missing" | "invalid"; rows: QuestionRecord[]; error?: DatasetEngineError };
type VocabularyRead = { status: "available" | "empty" | "missing" | "invalid"; entries: VocabularyEntry[]; error?: DatasetEngineError };

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const COLLECTION_FILENAME = /^apeuni-[a-z0-9-]+\.json$/i;
const parsedJsonCache = new Map<string, ParsedJsonCacheEntry>();

function genericError(code: DatasetErrorCode): DatasetEngineError {
  const messages: Record<DatasetErrorCode, string> = {
    "question-bank-missing": "The Question Bank is not available.",
    "vocabulary-missing": "The Vocabulary dataset is not available.",
    "invalid-json": "A dataset file contains malformed JSON.",
    "invalid-question-bank": "The Question Bank failed validation.",
    "invalid-collection": "The Collection failed validation or contains unresolved questions.",
    "invalid-vocabulary": "The Vocabulary dataset failed validation.",
    "invalid-path": "The dataset path is unavailable or unsafe.",
    "dataset-not-found": "The selected dataset was not found.",
  };
  return new DatasetEngineError(code, messages[code]);
}

function isMissingError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isInside(rootPath: string, targetPath: string): boolean {
  const pathFromRoot = relative(rootPath, targetPath);
  return pathFromRoot === "" || (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`));
}

async function inspectSafePath(dataRoot: string, segments: string[], expected: "file" | "directory"): Promise<SafePath> {
  const rootPath = resolve(dataRoot);
  let rootStat;

  try {
    rootStat = await lstat(rootPath);
  } catch (error) {
    if (isMissingError(error)) return { path: join(rootPath, ...segments), exists: false };
    throw genericError("invalid-path");
  }

  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw genericError("invalid-path");
  }

  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment) || segment === "." || segment === "..") {
      throw genericError("invalid-path");
    }
  }

  const realRoot = await realpath(rootPath).catch(() => {
    throw genericError("invalid-path");
  });
  let targetPath = rootPath;

  for (const [index, segment] of segments.entries()) {
    targetPath = join(targetPath, segment);
    let targetStat;

    try {
      targetStat = await lstat(targetPath);
    } catch (error) {
      if (isMissingError(error)) return { path: targetPath, exists: false };
      throw genericError("invalid-path");
    }

    if (targetStat.isSymbolicLink()) throw genericError("invalid-path");

    const isFinal = index === segments.length - 1;
    if (!isFinal && !targetStat.isDirectory()) throw genericError("invalid-path");
    if (isFinal && expected === "file" && !targetStat.isFile()) throw genericError("invalid-path");
    if (isFinal && expected === "directory" && !targetStat.isDirectory()) throw genericError("invalid-path");

    const realTarget = await realpath(targetPath).catch(() => {
      throw genericError("invalid-path");
    });
    if (!isInside(realRoot, realTarget)) throw genericError("invalid-path");
  }

  return { path: targetPath, exists: true };
}

export async function resolveWithinDataRoot(
  dataRoot: string,
  segments: string[],
  expected: "file" | "directory" = "file",
): Promise<SafePath> {
  return inspectSafePath(dataRoot, segments, expected);
}

async function readJsonFile(dataRoot: string, segments: string[]): Promise<{ exists: false } | { exists: true; value: unknown }> {
  const safePath = await inspectSafePath(dataRoot, segments, "file");
  if (!safePath.exists) return { exists: false };

  let fileHandle;
  try {
    fileHandle = await open(safePath.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await fileHandle.stat({ bigint: true });
    if (!stats.isFile()) throw genericError("invalid-path");
    const cached = parsedJsonCache.get(safePath.path);
    if (cached && cached.inode === String(stats.ino) && cached.size === String(stats.size) && cached.modifiedAt === String(stats.mtimeNs)) {
      return { exists: true, value: cached.value };
    }
    const contents = await fileHandle.readFile("utf8");
    try {
      const value = freezeJsonValue(JSON.parse(contents) as unknown);
      parsedJsonCache.set(safePath.path, {
        inode: String(stats.ino), size: String(stats.size), modifiedAt: String(stats.mtimeNs), value,
      });
      return { exists: true, value };
    } catch {
      throw genericError("invalid-json");
    }
  } catch (error) {
    if (error instanceof DatasetEngineError) throw error;
    if (isMissingError(error)) return { exists: false };
    if (error instanceof Error && "code" in error && error.code === "ELOOP") {
      throw genericError("invalid-path");
    }
    throw genericError("invalid-path");
  } finally {
    await fileHandle?.close().catch(() => undefined);
  }
}

function freezeJsonValue<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeJsonValue(child);
    Object.freeze(value);
  }
  return value;
}

function questionBankSegments(typeKey: string): string[] {
  const questionType = getQuestionTypeByKey(typeKey);
  if (!questionType || !/^\d{2}-[a-z0-9-]+$/.test(questionType.key)) {
    throw genericError("dataset-not-found");
  }

  const directory = `${String(questionType.number).padStart(2, "0")}-${questionType.code.toUpperCase()}`;
  return [directory, "items.json"];
}

export function validateQuestionBank(value: unknown): QuestionRecord[] {
  if (!Array.isArray(value)) throw genericError("invalid-question-bank");

  const seen = new Set<number>();
  const rows: QuestionRecord[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw genericError("invalid-question-bank");
    }
    const id = (row as Record<string, unknown>).id;
    if (!Number.isSafeInteger(id) || (id as number) <= 0 || seen.has(id as number)) {
      throw genericError("invalid-question-bank");
    }
    seen.add(id as number);
    rows.push(row as QuestionRecord);
  }

  return rows;
}

export async function loadQuestionBank(
  typeKey: string,
  dataRoot = join(process.cwd(), "data"),
): Promise<QuestionRecord[]> {
  const content = await readJsonFile(dataRoot, questionBankSegments(typeKey));
  if (!content.exists) throw genericError("question-bank-missing");
  return validateQuestionBank(content.value);
}

async function inspectQuestionBank(typeKey: string, dataRoot: string): Promise<BankRead> {
  try {
    const rows = await loadQuestionBank(typeKey, dataRoot);
    return { status: rows.length ? "available" : "empty", rows };
  } catch (error) {
    if (!(error instanceof DatasetEngineError)) throw error;
    return {
      status: error.code === "question-bank-missing" ? "missing" : "invalid",
      rows: [],
      error,
    };
  }
}

function datasetHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function collectionLabel(filename: string): string {
  const basename = filename.slice(0, -".json".length);
  if (basename === "apeuni-legacy-wfd") return "Legacy WFD";

  const monthly = /^apeuni-(\d{4})-(\d{2})-p$/i.exec(basename);
  if (monthly) {
    const month = Number(monthly[2]);
    if (month >= 1 && month <= 12) {
      const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(Number(monthly[1]), month - 1, 1)),
      );
      return `${monthName} P`;
    }
  }

  const weekly = /^apeuni-(\d{4})-w(\d{1,2})$/i.exec(basename);
  if (weekly) return `Week ${Number(weekly[2])}, ${weekly[1]}`;

  return basename
    .replace(/^apeuni-/i, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ") || "Collection";
}

async function discoverCollectionFiles(dataRoot: string): Promise<CollectionRecord[]> {
  const collectionDirectory = await inspectSafePath(dataRoot, ["collections"], "directory");
  if (!collectionDirectory.exists) return [];

  let entries;
  try {
    entries = await readdir(collectionDirectory.path, { withFileTypes: true });
  } catch {
    throw genericError("invalid-path");
  }

  return entries
    .filter((entry) => COLLECTION_FILENAME.test(entry.name))
    .map((entry) => ({
      filename: entry.name,
      id: `collection-${datasetHash(entry.name)}`,
      label: collectionLabel(entry.name),
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

function validateCollection(value: unknown): ParsedCollection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw genericError("invalid-collection");
  }

  const allowedKeys = new Set(QUESTION_TYPES.map(({ key }) => key));
  const collection: ParsedCollection = {};
  for (const [typeKey, valueForType] of Object.entries(value)) {
    if (!allowedKeys.has(typeKey) || !Array.isArray(valueForType)) {
      throw genericError("invalid-collection");
    }

    const ids = valueForType as unknown[];
    const seen = new Set<number>();
    for (const id of ids) {
      if (!Number.isSafeInteger(id) || (id as number) <= 0 || seen.has(id as number)) {
        throw genericError("invalid-collection");
      }
      seen.add(id as number);
    }
    collection[typeKey] = ids as number[];
  }
  return collection;
}

export function resolveCollectionMembership(
  typeKey: string,
  collectionValue: unknown,
  bankRows: QuestionRecord[],
): QuestionRecord[] {
  if (!getQuestionTypeByKey(typeKey)) throw genericError("invalid-collection");
  const collection = validateCollection(collectionValue);
  const ids = collection[typeKey];
  if (!ids) throw genericError("invalid-collection");

  const byId = new Map(bankRows.map((question) => [question.id, question]));
  const selected = ids.map((id) => byId.get(id));
  if (selected.some((question) => question === undefined)) {
    throw genericError("invalid-collection");
  }
  return selected as QuestionRecord[];
}

async function readCollection(dataRoot: string, filename: string): Promise<ParsedCollection> {
  if (!COLLECTION_FILENAME.test(filename)) throw genericError("invalid-path");
  const content = await readJsonFile(dataRoot, ["collections", filename]);
  if (!content.exists) throw genericError("invalid-collection");
  return validateCollection(content.value);
}

function optionFromBank(bank: BankRead): DatasetOption {
  return {
    id: "all",
    label: "All Questions",
    kind: "all",
    status: bank.status,
    count: bank.rows.length,
    ...(bank.error ? { errorCode: bank.error.code, message: bank.error.message } : {}),
  };
}

function statusForIds(ids: number[], bank: BankRead): DatasetOption["status"] {
  if (ids.length === 0) return "empty";
  if (bank.status === "missing") return "invalid";
  if (bank.status === "invalid") return "invalid";
  const bankIds = new Set(bank.rows.map(({ id }) => id));
  return ids.every((id) => bankIds.has(id)) ? "available" : "invalid";
}

export function chooseDefaultDataset(options: DatasetOption[]): string | undefined {
  const october = options.find(
    (option) => option.kind === "collection" && option.label === "October P" && option.status === "available" && option.count > 0,
  );
  if (october) return october.id;

  const allQuestions = options.find((option) => option.id === "all");
  if (allQuestions && (allQuestions.status === "available" || allQuestions.status === "empty")) {
    return allQuestions.id;
  }
  return undefined;
}

export async function listQuestionDatasets(
  typeKey: string,
  dataRoot = join(process.cwd(), "data"),
): Promise<DatasetOption[]> {
  const bank = await inspectQuestionBank(typeKey, dataRoot);
  const options: DatasetOption[] = [optionFromBank(bank)];
  const collectionFiles = await discoverCollectionFiles(dataRoot).catch((error: unknown) => {
    if (error instanceof DatasetEngineError) return [];
    throw error;
  });

  for (const file of collectionFiles) {
    try {
      const collection = await readCollection(dataRoot, file.filename);
      if (!Object.hasOwn(collection, typeKey)) continue;
      const ids = collection[typeKey];
      if (file.filename.toLowerCase() === "apeuni-legacy-wfd.json" && ids.length === 0) continue;
      const status = statusForIds(ids, bank);
      const errorCode = status === "invalid" ? "invalid-collection" : undefined;
      options.push({
        id: file.id,
        label: file.label,
        kind: "collection",
        status,
        count: status === "available" ? ids.length : 0,
        ...(errorCode ? { errorCode, message: genericError(errorCode).message } : {}),
      });
    } catch (error) {
      if (!(error instanceof DatasetEngineError)) throw error;
      options.push({
        id: file.id,
        label: file.label,
        kind: "collection",
        status: "invalid",
        count: 0,
        errorCode: error.code,
        message: error.message,
      });
    }
  }

  return options;
}

function notFoundResolution<T>(options: DatasetOption[]): DatasetResolution<T> {
  return {
    dataset: {
      id: "",
      label: "Dataset not found",
      kind: "all",
      status: "not-found",
      count: 0,
      errorCode: "dataset-not-found",
      message: genericError("dataset-not-found").message,
    },
    options,
    items: [],
  };
}

export async function resolveQuestionDataset(
  typeKey: string,
  requestedDatasetId?: string,
  dataRoot = join(process.cwd(), "data"),
): Promise<DatasetResolution<QuestionRecord>> {
  if (!getQuestionTypeByKey(typeKey)) return notFoundResolution<QuestionRecord>([]);

  const options = await listQuestionDatasets(typeKey, dataRoot);
  const selectedId = requestedDatasetId ?? chooseDefaultDataset(options) ?? options[0]?.id;
  const selected = options.find(({ id }) => id === selectedId);
  if (!selected) return notFoundResolution<QuestionRecord>(options);
  if (selected.status !== "available") {
    return { dataset: selected, options, items: [] };
  }

  try {
    const bank = await loadQuestionBank(typeKey, dataRoot);
    if (selected.kind === "all") {
      return { dataset: selected, options, items: bank };
    }

    const filename = (await discoverCollectionFiles(dataRoot)).find(({ id }) => id === selected.id)?.filename;
    if (!filename) return notFoundResolution<QuestionRecord>(options);
    const collection = await readCollection(dataRoot, filename);
    let items: QuestionRecord[];
    try {
      items = resolveCollectionMembership(typeKey, collection, bank);
    } catch (error) {
      if (!(error instanceof DatasetEngineError)) throw error;
      const invalid = { ...selected, status: "invalid" as const, count: 0, errorCode: error.code, message: error.message };
      return { dataset: invalid, options: options.map((option) => option.id === selected.id ? invalid : option), items: [] };
    }

    return { dataset: selected, options, items };
  } catch (error) {
    if (!(error instanceof DatasetEngineError)) throw error;
    const status: DatasetStatus = error.code === "question-bank-missing" ? "missing" : "invalid";
    const invalid = { ...selected, status, count: 0, errorCode: error.code, message: error.message };
    return { dataset: invalid, options: options.map((option) => option.id === selected.id ? invalid : option), items: [] };
  }
}

function validateVocabulary(value: unknown): VocabularyEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw genericError("invalid-vocabulary");
  }
  const entries = (value as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) throw genericError("invalid-vocabulary");

  const seenKeys = new Set<string>();
  const normalized: VocabularyEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw genericError("invalid-vocabulary");
    }
    const record = entry as Record<string, unknown>;
    const key = record.key;
    const tier = record.tier;
    const lists = record.lists;
    if (
      typeof key !== "string" || key.trim() === "" || seenKeys.has(key) ||
      !Number.isInteger(tier) || ![1, 2, 3].includes(tier as number) ||
      !Array.isArray(lists) || lists.some((label) => typeof label !== "string" || label.trim() === "")
    ) {
      throw genericError("invalid-vocabulary");
    }
    if (new Set(lists).size !== lists.length) throw genericError("invalid-vocabulary");
    seenKeys.add(key);
    normalized.push(record as VocabularyEntry);
  }
  return normalized;
}

async function readVocabulary(dataRoot: string): Promise<VocabularyEntry[]> {
  const content = await readJsonFile(dataRoot, ["vocabulary", "items.json"]);
  if (!content.exists) throw genericError("vocabulary-missing");
  return validateVocabulary(content.value);
}

async function inspectVocabulary(dataRoot: string): Promise<VocabularyRead> {
  try {
    const entries = await readVocabulary(dataRoot);
    return { status: entries.length ? "available" : "empty", entries };
  } catch (error) {
    if (!(error instanceof DatasetEngineError)) throw error;
    return {
      status: error.code === "vocabulary-missing" ? "missing" : "invalid",
      entries: [],
      error,
    };
  }
}

function uniqueVocabularyEntries(entries: VocabularyEntry[]): VocabularyEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const identity = vocabularyIdentity(entry.key);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function humanizeListLabel(label: string): string {
  return label
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function vocabularyOptions(read: VocabularyRead): DatasetOption[] {
  const options: DatasetOption[] = [{
    id: "all",
    label: "All Vocabulary",
    kind: "all",
    status: read.status,
    count: read.entries.length,
    ...(read.error ? { errorCode: read.error.code, message: read.error.message } : {}),
  }];
  if (read.status === "missing" || read.status === "invalid") return options;

  const tiers = [...new Set(read.entries.map(({ tier }) => tier))].sort((left, right) => left - right);
  for (const tier of tiers) {
    const count = read.entries.filter((entry) => entry.tier === tier).length;
    options.push({
      id: `tier-${tier}`,
      label: `Tier ${tier}`,
      kind: "tier",
      status: count ? "available" : "empty",
      count,
    });
  }

  const lists = [...new Set(read.entries.flatMap(({ lists: entryLists }) => entryLists))].sort((left, right) => left.localeCompare(right));
  for (const list of lists) {
    const count = uniqueVocabularyEntries(read.entries.filter((entry) => entry.lists.includes(list))).length;
    options.push({
      id: `list-${datasetHash(list)}`,
      label: humanizeListLabel(list),
      kind: "list",
      status: count ? "available" : "empty",
      count,
    });
  }
  return options;
}

export async function listVocabularyDatasets(dataRoot = join(process.cwd(), "data")): Promise<DatasetOption[]> {
  return vocabularyOptions(await inspectVocabulary(dataRoot));
}

export async function resolveVocabularyDataset(
  requestedDatasetId?: string,
  dataRoot = join(process.cwd(), "data"),
): Promise<DatasetResolution<VocabularyEntry>> {
  const read = await inspectVocabulary(dataRoot);
  const options = vocabularyOptions(read);
  const selectedId = requestedDatasetId ?? "all";
  const selected = options.find(({ id }) => id === selectedId);
  if (!selected) return notFoundResolution<VocabularyEntry>(options);
  if (selected.status !== "available") return { dataset: selected, options, items: [] };

  try {
    const entries = await readVocabulary(dataRoot);
    let filtered: VocabularyEntry[];
    if (selected.kind === "all") {
      filtered = entries;
    } else if (selected.kind === "tier") {
      const tier = Number(selected.id.slice("tier-".length));
      filtered = entries.filter((entry) => entry.tier === tier);
    } else if (selected.kind === "list") {
      const list = [...new Set(entries.flatMap(({ lists }) => lists))].find((candidate) => `list-${datasetHash(candidate)}` === selected.id);
      if (!list) return notFoundResolution<VocabularyEntry>(options);
      filtered = entries.filter((entry) => entry.lists.includes(list));
    } else {
      return notFoundResolution<VocabularyEntry>(options);
    }

    const items = uniqueVocabularyEntries(filtered);
    return {
      dataset: { ...selected, count: items.length, status: items.length ? "available" : "empty" },
      options,
      items,
    };
  } catch (error) {
    if (!(error instanceof DatasetEngineError)) throw error;
    const invalid = { ...selected, status: "invalid" as const, count: 0, errorCode: error.code, message: error.message };
    return { dataset: invalid, options: options.map((option) => option.id === selected.id ? invalid : option), items: [] };
  }
}
