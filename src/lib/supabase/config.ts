export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
    this.name = "SupabaseConfigurationError";
  }
}

export function resolveSupabasePublicConfig(
  url: string | undefined,
  publishableKey: string | undefined,
): SupabasePublicConfig {
  const normalizedUrl = url?.trim();
  const normalizedKey = publishableKey?.trim();

  if (!normalizedUrl || !normalizedKey) {
    throw new SupabaseConfigurationError();
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new SupabaseConfigurationError();
  }

  const isLocalHttp =
    parsedUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);

  if (
    (parsedUrl.protocol !== "https:" && !isLocalHttp) ||
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0 ||
    parsedUrl.search.length > 0 ||
    parsedUrl.hash.length > 0 ||
    (parsedUrl.pathname !== "/" && parsedUrl.pathname.length > 0)
  ) {
    throw new SupabaseConfigurationError();
  }

  return { url: parsedUrl.origin, publishableKey: normalizedKey };
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return resolveSupabasePublicConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabasePublicConfigOrNull(): SupabasePublicConfig | null {
  try {
    return getSupabasePublicConfig();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return null;
    }

    throw error;
  }
}
