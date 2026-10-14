import "server-only";

import {
  proxyAuthenticatedCloudinaryMedia,
} from "@/lib/media/cloudinary-delivery";
import type { AuthenticatedMediaAsset } from "@/lib/media/resolver";

export type MediaRole = "audio" | "image";

type MediaEndpointDependencies = {
  authenticate: () => Promise<boolean>;
  resolve: (identity: string, role: MediaRole) => Promise<AuthenticatedMediaAsset | null>;
  cloudinaryUrl?: () => string | undefined;
  fetcher?: typeof fetch;
};

function privateResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Range",
    },
  });
}

export function createAuthenticatedMediaHandler(dependencies: MediaEndpointDependencies) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "private, no-store" } });
    }

    let authenticated = false;
    try {
      authenticated = await dependencies.authenticate();
    } catch {
      authenticated = false;
    }
    if (!authenticated) return privateResponse("Authentication required.", 401);

    const url = new URL(request.url);
    const identities = url.searchParams.getAll("identity");
    const roles = url.searchParams.getAll("role");
    if ([...url.searchParams.keys()].some((key) => key !== "identity" && key !== "role") ||
      identities.length !== 1 || roles.length !== 1 ||
      !/^apeuni:question:\d{2}-[a-z0-9-]+:[1-9]\d*$/.test(identities[0]) ||
      (roles[0] !== "audio" && roles[0] !== "image")) return privateResponse("Media is unavailable.", 404);

    const identity = identities[0];
    const role = roles[0] as MediaRole;
    let asset: AuthenticatedMediaAsset | null;
    try {
      asset = await dependencies.resolve(identity, role);
    } catch {
      asset = null;
    }
    if (!asset) return privateResponse("Media is unavailable.", 404);

    return proxyAuthenticatedCloudinaryMedia(
      request,
      asset,
      dependencies.cloudinaryUrl?.(),
      dependencies.fetcher,
    );
  };
}
