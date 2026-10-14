import "server-only";

import { createHash } from "node:crypto";

import type { AuthenticatedMediaAsset } from "@/lib/media/resolver";

type CloudinaryConfiguration = { apiSecret: string; cloudName: string };

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Range",
};

function parseCloudinaryConfiguration(value: string | undefined): CloudinaryConfiguration | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "cloudinary:" || parsed.username.length === 0 || parsed.password.length === 0 ||
      !/^[a-z0-9-]+$/.test(parsed.hostname) || parsed.port || parsed.search || parsed.hash) return null;
    return { apiSecret: decodeURIComponent(parsed.password), cloudName: parsed.hostname };
  } catch {
    return null;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function buildAuthenticatedCloudinaryUrl(
  asset: AuthenticatedMediaAsset,
  cloudinaryUrl: string | undefined = process.env.CLOUDINARY_URL,
): string | null {
  const configuration = parseCloudinaryConfiguration(cloudinaryUrl);
  if (!configuration || configuration.cloudName !== asset.cloudName || !CONTENT_TYPES[asset.format] ||
    ((asset.format === "mp3" || asset.format === "wav" || asset.format === "m4a") && asset.resourceType !== "video") ||
    ((asset.format === "png" || asset.format === "jpg" || asset.format === "jpeg") && asset.resourceType !== "image") ||
    !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(asset.publicId) ||
    !Number.isSafeInteger(asset.version) || asset.version <= 0 ||
    (asset.resourceType !== "image" && asset.resourceType !== "video")) return null;
  const deliveryPath = `v${asset.version}/${asset.publicId}.${asset.format}`;
  const signature = createHash("sha1").update(`${deliveryPath}${configuration.apiSecret}`).digest("base64url").slice(0, 8);
  const encodedPublicId = asset.publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${asset.cloudName}/${asset.resourceType}/authenticated/s--${signature}--/v${asset.version}/${encodedPublicId}.${asset.format}`;
}

export function mediaContentType(format: string): string | null {
  return CONTENT_TYPES[format] ?? null;
}

export function isSingleByteRange(value: string): boolean {
  return value.length <= 100 && /^bytes=(?:\d+-\d*|-\d+)$/.test(value);
}

function safeContentRange(value: string | null): string | null {
  if (!value || !/^bytes (?:\d+-\d+|\*)\/(?:\d+|\*)$/.test(value)) return null;
  return value;
}

function unavailable(status: number): Response {
  return new Response("Media is unavailable.", { status, headers: PRIVATE_HEADERS });
}

/** Fetches a verified original asset server-side and exposes only a private same-origin stream. */
export async function proxyAuthenticatedCloudinaryMedia(
  request: Request,
  asset: AuthenticatedMediaAsset,
  cloudinaryUrl: string | undefined = process.env.CLOUDINARY_URL,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const contentType = mediaContentType(asset.format);
  const signedUrl = buildAuthenticatedCloudinaryUrl(asset, cloudinaryUrl);
  if (!contentType || !signedUrl) return unavailable(503);

  const range = request.headers.get("range");
  if (range && !isSingleByteRange(range)) {
    return new Response(null, {
      status: 416,
      headers: { ...PRIVATE_HEADERS, "Content-Range": `bytes */${asset.remoteBytes}`, "Accept-Ranges": "bytes" },
    });
  }

  try {
    const upstream = await fetcher(signedUrl, {
      method: request.method,
      headers: range ? { Range: range } : undefined,
      redirect: "follow",
      signal: request.signal,
    });
    if (![200, 206, 416].includes(upstream.status)) return unavailable(502);

    const headers = new Headers(PRIVATE_HEADERS);
    headers.set("Content-Type", contentType);
    const acceptsRanges = upstream.headers.get("accept-ranges");
    if (acceptsRanges?.toLowerCase() === "bytes") headers.set("Accept-Ranges", "bytes");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength)) headers.set("Content-Length", contentLength);

    if (upstream.status === 206 || upstream.status === 416) {
      const contentRange = safeContentRange(upstream.headers.get("content-range"));
      if (!contentRange) return unavailable(502);
      if (upstream.status === 206) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
        if (!match || Number(match[3]) !== asset.remoteBytes || Number(match[1]) > Number(match[2]) || Number(match[2]) >= asset.remoteBytes) {
          return unavailable(502);
        }
        if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) !== Number(match[2]) - Number(match[1]) + 1) {
          return unavailable(502);
        }
      } else {
        const match = /^bytes \*\/(\d+)$/.exec(contentRange);
        if (!match || Number(match[1]) !== asset.remoteBytes) return unavailable(502);
      }
      headers.set("Content-Range", contentRange);
    }

    if (upstream.status === 200 && contentLength && /^\d+$/.test(contentLength) && Number(contentLength) !== asset.remoteBytes) {
      return unavailable(502);
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return unavailable(502);
  }
}
