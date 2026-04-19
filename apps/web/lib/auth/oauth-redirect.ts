export const OAUTH_POST_LOGIN_REDIRECT_COOKIE = "sv_oauth_redirect";

/** Relative path only — used after Steam OAuth to avoid open redirects. */
export function sanitizePostLoginRedirect(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("\\") || t.includes("@")) return null;
  return t.length > 512 ? null : t;
}
