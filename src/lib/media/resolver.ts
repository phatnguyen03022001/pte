import "server-only";

import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join } from "node:path";
import { resolveQuestionDataset, type QuestionRecord } from "@/lib/datasets/engine";
import { questionIdentity } from "@/lib/study/item-identity";
import { getQuestionTypeByKey } from "@/lib/study/question-types";
import type { TrustedMedia } from "@/lib/study/adapters";

type RegistryAsset = {
  asset_id: string;
  owner?: { provider?: string; question_type?: string; question_id?: number };
  role?: string;
  source_path?: string;
  target_path?: string;
  expected_public_id?: string;
  expected_delivery_type?: string;
  resource_type?: string;
  source_sha256?: string;
  format?: string;
  association_status?: string;
  target_identity_conflict?: boolean;
};

type RemoteAsset = {
  asset_id?: string;
  registry_asset_id?: string;
  cloudinary_asset_id?: string;
  cloud_name?: string;
  delivery_type?: string;
  public_id?: string;
  remote_status?: string;
  resource_type?: string;
  format?: string;
  remote_bytes?: number;
  version?: number;
  source_sha256?: string;
  delivery_url?: string;
  verification_evidence?: {
    asset_id?: string;
    bytes?: number;
    cloud_name?: string;
    delivery_type?: string;
    etag_matches_source_md5?: boolean;
    public_id?: string;
    resource_type?: string;
    format?: string;
    source_md5?: string;
    status?: string;
    version?: number;
    etag?: string;
    delivery_url?: string;
    identity_conflicts?: unknown[];
  };
};

type MediaRole = "audio" | "image";
export type MediaIndex = { registry: RegistryAsset[]; remote: Record<string, RemoteAsset>; cloudName?: string };
export type AuthenticatedMediaAsset = {
  cloudName: string;
  format: string;
  publicId: string;
  remoteBytes: number;
  resourceType: "image" | "video";
  version: number;
};

const DATA_ROOT = join(process.cwd(), "data");
let mediaIndexPromise: Promise<MediaIndex> | undefined;

async function readDataJson<T>(name: "media-registry.json" | "cloudinary-assets.json"): Promise<T> {
  const rootStat = await lstat(DATA_ROOT).catch(() => null);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Media metadata is unavailable.");
  const realRoot = await realpath(DATA_ROOT);
  const syncPath = join(DATA_ROOT, ".sync");
  const syncStat = await lstat(syncPath).catch(() => null);
  if (!syncStat?.isDirectory() || syncStat.isSymbolicLink() || await realpath(syncPath) !== join(realRoot, ".sync")) {
    throw new Error("Media metadata is unavailable.");
  }
  const metadataPath = join(syncPath, name);
  const metadataStat = await lstat(metadataPath).catch(() => null);
  if (!metadataStat?.isFile() || metadataStat.isSymbolicLink() || await realpath(metadataPath) !== join(realRoot, ".sync", name)) {
    throw new Error("Media metadata is unavailable.");
  }
  const file = await open(metadataPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Media metadata is invalid.");
    return JSON.parse(await file.readFile("utf8")) as T;
  } finally {
    await file.close();
  }
}

async function loadMediaIndex(): Promise<MediaIndex> {
  const [registryDocument, remoteDocument] = await Promise.all([
    readDataJson<{ assets?: unknown }>("media-registry.json"),
    readDataJson<{ assets?: unknown; cloud_name?: unknown }>("cloudinary-assets.json"),
  ]);
  if (!Array.isArray(registryDocument.assets) || !remoteDocument.assets ||
    typeof remoteDocument.assets !== "object" || Array.isArray(remoteDocument.assets) ||
    typeof remoteDocument.cloud_name !== "string" || !SAFE_CLOUD_NAME.test(remoteDocument.cloud_name)) {
    throw new Error("Media metadata is invalid.");
  }
  return {
    registry: registryDocument.assets as RegistryAsset[],
    remote: remoteDocument.assets as Record<string, RemoteAsset>,
    cloudName: remoteDocument.cloud_name,
  };
}

function getMediaIndex(): Promise<MediaIndex> {
  mediaIndexPromise ??= loadMediaIndex();
  return mediaIndexPromise;
}

function isSafeRelativeReference(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 500 || value.includes("\\") || value.startsWith("/")) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".." && /^[A-Za-z0-9._-]+$/.test(segment));
}

function verifiedPublicUrl(remote: RemoteAsset, registry: RegistryAsset): string | null {
  const evidence = remote.verification_evidence;
  const value = remote.delivery_url;
  if (remote.delivery_type !== "upload" || registry.expected_delivery_type !== "upload" ||
    remote.remote_status !== "REMOTE_VERIFIED" || evidence?.etag_matches_source_md5 !== true ||
    evidence.delivery_url !== value || !value || !remote.cloud_name || !remote.public_id ||
    remote.asset_id !== registry.asset_id || remote.public_id !== registry.expected_public_id ||
    remote.resource_type !== registry.resource_type || remote.source_sha256 !== registry.source_sha256 ||
    !remote.cloudinary_asset_id || evidence.asset_id !== remote.cloudinary_asset_id || evidence.cloud_name !== remote.cloud_name ||
    evidence.delivery_type !== "upload" || evidence.public_id !== remote.public_id ||
    evidence.resource_type !== remote.resource_type || (evidence.identity_conflicts?.length ?? 0) > 0) return null;
  try {
    const url = new URL(value);
    const expectedType = registry.role === "audio" ? "video" : "image";
    const publicIdPath = registry.expected_public_id?.split("/").map(encodeURIComponent).join("/");
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password ||
      url.search || !publicIdPath || !url.pathname.includes(`/${remote.cloud_name}/${expectedType}/upload/`) ||
      !url.pathname.endsWith(`/${publicIdPath}.${encodeURIComponent((registry.source_path ?? "").split(".").pop() ?? "")}`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const SAFE_PUBLIC_ID = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;
const SAFE_CLOUD_NAME = /^[a-z0-9-]+$/;
const VERIFIED_FORMATS: Record<MediaRole, ReadonlySet<string>> = {
  audio: new Set(["mp3", "wav", "m4a"]),
  image: new Set(["png", "jpg", "jpeg"]),
};

function verifiedAuthenticatedAsset(
  registry: RegistryAsset,
  remote: RemoteAsset | undefined,
  role: MediaRole,
  targetPath: string,
  verifiedCloudName: string | undefined,
): AuthenticatedMediaAsset | null {
  const evidence = remote?.verification_evidence;
  if (!remote || !evidence || registry.association_status !== "EXPLICIT_REFERENCE" || registry.target_identity_conflict === true ||
    remote.remote_status !== "REMOTE_VERIFIED" || remote.delivery_type !== "authenticated" || registry.expected_delivery_type !== "authenticated" ||
    !registry.source_sha256 || !/^[a-f0-9]{64}$/.test(registry.source_sha256) || remote.source_sha256 !== registry.source_sha256 ||
    !registry.expected_public_id || remote.public_id !== registry.expected_public_id || !SAFE_PUBLIC_ID.test(remote.public_id) ||
    remote.resource_type !== (role === "audio" ? "video" : "image") || registry.resource_type !== remote.resource_type ||
    !remote.format || registry.format !== remote.format || !VERIFIED_FORMATS[role].has(remote.format) ||
    !verifiedCloudName || remote.cloud_name !== verifiedCloudName || !remote.cloud_name || !SAFE_CLOUD_NAME.test(remote.cloud_name) || !remote.cloudinary_asset_id ||
    remote.asset_id !== registry.asset_id || remote.registry_asset_id !== registry.asset_id ||
    (remote.version !== undefined && (!Number.isSafeInteger(remote.version) || remote.version <= 0)) ||
    typeof remote.remote_bytes !== "number" || !Number.isSafeInteger(remote.remote_bytes) || remote.remote_bytes <= 0 ||
    evidence.asset_id !== remote.cloudinary_asset_id ||
    evidence.delivery_type !== "authenticated" || evidence.public_id !== remote.public_id ||
    evidence.resource_type !== remote.resource_type || evidence.format !== remote.format ||
    typeof evidence.version !== "number" || !Number.isSafeInteger(evidence.version) || evidence.version <= 0 ||
    (remote.version !== undefined && remote.version !== evidence.version) ||
    evidence.bytes !== remote.remote_bytes || evidence.status !== "active" || evidence.etag_matches_source_md5 !== true ||
    !evidence.source_md5 || evidence.source_md5 !== evidence.etag || (evidence.identity_conflicts?.length ?? 0) !== 0 ||
    registry.target_path !== targetPath || registry.expected_public_id !== `pte/${targetPath.replace(/\.[^.]+$/, "")}` ||
    !registry.source_path || registry.asset_id !== `apeuni:${registry.owner?.question_type}:${registry.owner?.question_id}::${role}:${registry.source_path}` ||
    remote.format !== registry.source_path.split(".").at(-1)?.toLowerCase()) return null;
  return {
    cloudName: remote.cloud_name,
    format: remote.format,
    publicId: remote.public_id,
    remoteBytes: remote.remote_bytes,
    resourceType: remote.resource_type,
    version: evidence.version,
  };
}

function canonicalOwnerMatches(asset: RegistryAsset, typeKey: string, itemId: number, role: MediaRole, targetPath: string): boolean {
  return asset.owner?.provider === "apeuni" && asset.owner.question_type === typeKey &&
    asset.owner.question_id === itemId && asset.role === role && asset.target_path === targetPath &&
    asset.association_status === "EXPLICIT_REFERENCE" && asset.target_identity_conflict !== true &&
    typeof asset.source_path === "string" && asset.asset_id === `apeuni:${typeKey}:${itemId}::${role}:${asset.source_path}`;
}

/** Returns verified public URLs or an authenticated same-origin delivery endpoint. */
export async function resolveQuestionMedia(typeKey: string, item: Record<string, unknown>): Promise<TrustedMedia> {
  const itemId = item.id;
  if (typeof itemId !== "number" || !Number.isSafeInteger(itemId) || itemId <= 0) return {};
  try {
    questionIdentity(typeKey, itemId);
  } catch {
    return {};
  }

  const index = await getMediaIndex().catch(() => null);
  if (!index) return {};
  return resolveQuestionMediaFromIndex(typeKey, item, index);
}

export function resolveQuestionMediaFromIndex(typeKey: string, item: Record<string, unknown>, index: MediaIndex): TrustedMedia {
  const itemId = item.id;
  if (typeof itemId !== "number" || !Number.isSafeInteger(itemId) || itemId <= 0) return {};
  try {
    questionIdentity(typeKey, itemId);
  } catch {
    return {};
  }
  const result: TrustedMedia = {};
  const questionType = getQuestionTypeByKey(typeKey);
  if (!questionType) return result;
  const directory = `${String(questionType.number).padStart(2, "0")}-${questionType.code.toUpperCase()}`;
  for (const role of ["audio", "image"] as const) {
    const sourcePath = item[role];
    if (!isSafeRelativeReference(sourcePath)) continue;
    const matches = index.registry.filter((asset) => canonicalOwnerMatches(asset, typeKey, itemId, role, `data/${directory}/${sourcePath}`));
    if (matches.length !== 1) continue;
    const [registry] = matches;
    const remote = index.remote[registry.asset_id];
    const key = role === "audio" ? "audioUrl" : "imageUrl";
    if (remote?.delivery_type === "authenticated") {
      const asset = verifiedAuthenticatedAsset(registry, remote, role, `data/${directory}/${sourcePath}`, index.cloudName);
      if (asset) {
        const identity = questionIdentity(typeKey, itemId);
        result[key] = `/api/media?identity=${encodeURIComponent(identity)}&role=${role}`;
      }
      continue;
    }
    const url = remote ? verifiedPublicUrl(remote, registry) : null;
    if (url) result[key] = url;
  }
  return result;
}

/** Resolves an authenticated asset again from the canonical dataset for every media request. */
export async function resolveAuthenticatedQuestionMedia(
  identity: string,
  role: MediaRole,
): Promise<AuthenticatedMediaAsset | null> {
  const match = /^apeuni:question:(\d{2}-[a-z0-9-]+):([1-9]\d*)$/.exec(identity);
  if (!match || (role !== "audio" && role !== "image")) return null;
  const typeKey = match[1];
  const itemId = Number(match[2]);
  if (!Number.isSafeInteger(itemId) || questionIdentity(typeKey, itemId) !== identity) return null;
  const dataset = await resolveQuestionDataset(typeKey, "all").catch(() => null);
  const item = dataset?.dataset.status === "available"
    ? dataset.items.find((candidate) => candidate.id === itemId) as QuestionRecord | undefined
    : undefined;
  if (!item) return null;
  const sourcePath = item[role];
  if (!isSafeRelativeReference(sourcePath)) return null;
  const questionType = getQuestionTypeByKey(typeKey);
  if (!questionType) return null;
  const directory = `${String(questionType.number).padStart(2, "0")}-${questionType.code.toUpperCase()}`;
  const targetPath = `data/${directory}/${sourcePath}`;
  const index = await getMediaIndex().catch(() => null);
  if (!index) return null;
  const matches = index.registry.filter((asset) => canonicalOwnerMatches(asset, typeKey, itemId, role, targetPath));
  if (matches.length !== 1) return null;
  return verifiedAuthenticatedAsset(matches[0], index.remote[matches[0].asset_id], role, targetPath, index.cloudName);
}
