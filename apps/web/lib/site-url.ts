/**
 * Canonical browser-facing origin for links in token metadata (`external_url`) and similar.
 * Set `NEXT_PUBLIC_SITE_URL` (e.g. https://steamfund.com) in deploy; falls back for local/dev.
 */
export function getPublicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "");
  if (raw) return raw.replace(/\/$/, "");
  return "https://steamfund.com";
}

/** Game detail page on this product (linked from Pump metadata). */
export function getGamePageUrl(steamAppId: number): string {
  return `${getPublicSiteOrigin()}/games/${steamAppId}`;
}
