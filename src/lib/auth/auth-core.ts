export type AuthMode = "login" | "signup";

export type AuthOperationResult =
  | { status: "success" }
  | { status: "confirmation-required" }
  | { status: "error"; message: string };

interface AuthErrorLike {
  code?: string;
  message?: string;
}

interface PasswordAuthClient {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data: { session: unknown | null };
    error: AuthErrorLike | null;
  }>;
  signUp(credentials: {
    email: string;
    password: string;
    options: { emailRedirectTo: string };
  }): Promise<{
    data: { session: unknown | null };
    error: AuthErrorLike | null;
  }>;
  signOut(options: { scope: "local" }): Promise<{
    error: AuthErrorLike | null;
  }>;
}

export function validateCredentials(
  email: string,
  password: string,
  mode: AuthMode,
): string | null {
  const normalizedEmail = email.trim();

  if (!normalizedEmail || normalizedEmail.length > 254) {
    return "Enter a valid email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }

  if (password.length === 0) {
    return "Enter your password.";
  }

  if (mode === "signup" && password.length < 8) {
    return "Use a password with at least 8 characters.";
  }

  return null;
}

export async function signInWithPassword(
  auth: Pick<PasswordAuthClient, "signInWithPassword">,
  email: string,
  password: string,
): Promise<AuthOperationResult> {
  const validationError = validateCredentials(email, password, "login");
  if (validationError) {
    return { status: "error", message: validationError };
  }

  try {
    const { data, error } = await auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return {
        status: "error",
        message:
          error.code === "email_not_confirmed"
            ? "Confirm your email address before signing in."
            : "Email or password is incorrect.",
      };
    }

    if (!data.session) {
      return {
        status: "error",
        message: "Sign-in did not create a session. Please try again.",
      };
    }

    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "Unable to sign in right now. Please try again.",
    };
  }
}

export async function signUpWithPassword(
  auth: Pick<PasswordAuthClient, "signUp">,
  email: string,
  password: string,
  emailRedirectTo: string,
): Promise<AuthOperationResult> {
  const validationError = validateCredentials(email, password, "signup");
  if (validationError) {
    return { status: "error", message: validationError };
  }

  try {
    const { data, error } = await auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      return {
        status: "error",
        message: "Unable to create the account. Check your details and try again.",
      };
    }

    return data.session
      ? { status: "success" }
      : { status: "confirmation-required" };
  } catch {
    return {
      status: "error",
      message: "Unable to create the account right now. Please try again.",
    };
  }
}

export async function signOutLocally(
  auth: Pick<PasswordAuthClient, "signOut">,
): Promise<AuthOperationResult> {
  try {
    const { error } = await auth.signOut({ scope: "local" });

    if (error) {
      return {
        status: "error",
        message: "Unable to sign out right now. Please try again.",
      };
    }

    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "Unable to sign out right now. Please try again.",
    };
  }
}

export function hasVerifiedClaimsSubject(
  claims: unknown,
): claims is { sub: string } {
  if (!claims || typeof claims !== "object" || !("sub" in claims)) {
    return false;
  }

  return typeof claims.sub === "string" && claims.sub.length > 0;
}

interface ClaimsAuthClient {
  getClaims(): Promise<{
    data: { claims?: unknown } | null;
    error: unknown | null;
  }>;
}

export async function hasCurrentVerifiedSession(
  auth: Pick<ClaimsAuthClient, "getClaims">,
): Promise<boolean> {
  try {
    const { data, error } = await auth.getClaims();
    return !error && hasVerifiedClaimsSubject(data?.claims);
  } catch {
    return false;
  }
}

export function isProtectedPath(pathname: string): boolean {
  return ["/study", "/vocabulary"].some(
    (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`),
  );
}

export function getProtectedRedirectPath(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  return isProtectedPath(pathname) && !isAuthenticated
    ? "/login?notice=sign-in-required"
    : null;
}

const APP_ORIGIN = "https://pte-study.invalid";
const ALLOWED_REDIRECT_ROOTS = ["/study", "/vocabulary"];

export function getSafeAuthRedirectPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/study";
  }

  try {
    const destination = new URL(value, APP_ORIGIN);

    if (destination.origin !== APP_ORIGIN) {
      return "/study";
    }

    const isAllowed = ALLOWED_REDIRECT_ROOTS.some(
      (root) =>
        destination.pathname === root ||
        destination.pathname.startsWith(`${root}/`),
    );

    return isAllowed ? destination.pathname : "/study";
  } catch {
    return "/study";
  }
}

export function isConfirmationOtpType(value: string | null): boolean {
  return value === "email" || value === "signup";
}
