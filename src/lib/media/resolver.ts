import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { resolveWithinDataRoot } from "@/lib/datasets/engine";
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
  association_status?: string;
  target_identity_conflict?: boolean;
};

type RemoteAsset = {
  asset_id?: string;
  cloud_name?: string;
  delivery_type?: string;
  public_id?: string;
  remote_status?: string;
  resource_type?: string;
  source_sha256?: string;
  delivery_url?: string;
  verification_evidence?: {
    asset_id?: string;
    cloud_name?: string;
    delivery_type?: string;
    etag_matches_source_md5?: boolean;
    public_id?: string;
    resource_type?: string;
    delivery_url?: string;
    identity_conflicts?: unknown[];
  };
};

type MediaRole = "audio" | "image";
export type MediaIndex = { registry: RegistryAsset[]; remote: Record<string, RemoteAsset> };

const DATA_ROOT = join(process.cwd(), "data");
let mediaIndexPromise: Promise<MediaIndex> | undefined;

async function readDataJson<T>(segments: string[]): Promise<T> {
  const safePath = await resolveWithinDataRoot(DATA_ROOT, segments, "file");
  if (!safePath.exists) throw new Error("Media metadata is unavailable.");
  const file = await open(safePath.path, constants.O_RDONLY | constants.O_NOFOLLOW);
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
    readDataJson<{ assets?: unknown }>([".sync", "media-registry.json"]),
    readDataJson<{ assets?: unknown }>([".sync", "cloudinary-assets.json"]),
  ]);
  if (!Array.isArray(registryDocument.assets) || !remoteDocument.assets ||
    typeof remoteDocument.assets !== "object" || Array.isArray(remoteDocument.assets)) {
    throw new Error("Media metadata is invalid.");
  }
  return {
    registry: registryDocument.assets as RegistryAsset[],
    remote: remoteDocument.assets as Record<string, RemoteAsset>,
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
    !evidence.asset_id || evidence.cloud_name !== remote.cloud_name ||
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

function canonicalOwnerMatches(asset: RegistryAsset, typeKey: string, itemId: number, role: MediaRole, targetPath: string): boolean {
  return asset.owner?.provider === "apeuni" && asset.owner.question_type === typeKey &&
    asset.owner.question_id === itemId && asset.role === role && asset.target_path === targetPath &&
    asset.association_status === "EXPLICIT_REFERENCE" && asset.target_identity_conflict !== true &&
    typeof asset.source_path === "string" && asset.asset_id === `apeuni:${typeKey}:${itemId}::${role}:${asset.source_path}`;
}

/** Returns only directly evidenced public URLs. Authenticated assets stay unavailable unless signing is configured. */
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
    if (!remote || remote.delivery_type === "authenticated") continue;
    const url = verifiedPublicUrl(remote, registry);
    if (url) result[role === "audio" ? "audioUrl" : "imageUrl"] = url;
  }
  return result;
}
