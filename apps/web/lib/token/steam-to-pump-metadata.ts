import type { SteamAppDetailsData } from "@/lib/steam/store-api";
import { steamLibraryCapsuleUrl } from "@/lib/steam/steam-cover-images";

/**
 * On-chain / metadata ticker length cap (uppercase A–Z0–9 only after sanitization).
 * Pump passes `symbol` as a string; keep a conservative cap for Metaplex-style metadata.
 */
export const PUMP_SYMBOL_MAX_LEN = 10;

/**
 * Pump `create_v2` caps mint `name` at this many **UTF-8 bytes** (not graphemes). `NameTooLong` / 6043 if exceeded.
 * Off-chain metadata (IPFS JSON) can still use the full Steam title via {@link PumpLaunchTokenFields.name}.
 */
export const PUMP_ONCHAIN_NAME_MAX_UTF8_BYTES = 32;

/**
 * Truncate for Pump mint creation only; keeps full title in IPFS `name` when you pass the untruncated field there.
 * Uses ASCII `...` (3 bytes) so the suffix never exceeds the byte budget (unlike Unicode ellipsis `…`).
 */
export function pumpNameForOnChainCreate(raw: string): string {
  const t = raw.trim();
  const enc = new TextEncoder();
  const buf = enc.encode(t);
  const max = PUMP_ONCHAIN_NAME_MAX_UTF8_BYTES;
  if (buf.length <= max) return t;

  const suffix = "...";
  const suffixBytes = enc.encode(suffix);
  const maxBase = max - suffixBytes.length;
  let end = Math.min(maxBase, buf.length);
  while (end > 0 && (buf[end - 1] & 0xc0) === 0x80) {
    end--;
  }
  const base = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, end));
  return `${base}${suffix}`;
}

/** Avoid huge JSON at `uri` if Steam returns a very long HTML description. */
const MAX_DESCRIPTION_CHARS = 4000;

export type PumpLaunchTokenFields = {
  /** Full Steam store title (IPFS metadata, UI). Pump on-chain `name` is capped with {@link pumpNameForOnChainCreate}. */
  name: string;
  /**
   * Token symbol: uppercase alphanumeric form of the game title (e.g. `PORTAL2`),
   * punctuation and spaces stripped — the “GAME NAME” style ticker.
   */
  symbol: string;
  /** Plain-text description from Steam (prefers full store description, else short blurb). */
  description: string;
  /**
   * Cover art URL for UI: Steam library portrait (600×900 CDN). Pinned copy becomes `ipfs://…` in JSON.
   */
  image: string;
  /** Optional wide hero (`banner` in hosted JSON): Steam header / store capsule. */
  banner: string;
  steamAppId: number;
  /** Store `capsule_image` URL for IPFS download fallback when library art is missing. */
  storeCapsuleForFallback?: string | null;
  /** Store `header_image` URL for IPFS download fallback. */
  storeHeaderForFallback?: string | null;
};

/**
 * JSON many launchpads (including Pump-style Metaplex metadata) expect at `image` + extensions.
 * Host this object at your metadata URI (IPFS, etc.) when creating the mint.
 */
export function buildPumpMetadataJson(
  fields: PumpLaunchTokenFields & { externalUrl?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: fields.name,
    symbol: fields.symbol,
    description: fields.description,
    image: fields.image,
    banner: fields.banner,
    extensions: {
      steam_appid: fields.steamAppId,
    },
  };
  const web = fields.externalUrl?.trim();
  if (web) {
    body.external_url = web;
  }
  return body;
}

export function steamAppDetailsToPumpFields(
  appId: number,
  data: SteamAppDetailsData,
): PumpLaunchTokenFields | null {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return null;

  const capsule = data.capsule_image ?? data.capsule_imagev5 ?? null;
  const header = typeof data.header_image === "string" ? data.header_image : null;
  const libraryUrl = steamLibraryCapsuleUrl(appId);
  const banner = header ?? capsule ?? libraryUrl;

  const rawDetailed =
    typeof data.detailed_description === "string" ? data.detailed_description : "";
  const rawShort =
    typeof data.short_description === "string" ? data.short_description : "";
  let description =
    stripHtml(decodeBasicHtmlEntities(rawDetailed)).trim() ||
    stripHtml(decodeBasicHtmlEntities(rawShort)).trim() ||
    name;
  if (description.length > MAX_DESCRIPTION_CHARS) {
    description = `${description.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`;
  }

  return {
    steamAppId: data.steam_appid ?? appId,
    name,
    symbol: steamGameNameToSymbol(name, appId, PUMP_SYMBOL_MAX_LEN),
    description,
    image: libraryUrl,
    banner,
    storeCapsuleForFallback: capsule,
    storeHeaderForFallback: header,
  };
}

/**
 * Uppercase ticker from the game name (A–Z0–9 only), capped length.
 * Falls back to `G` + appId if the title yields fewer than 3 alphanumeric characters.
 */
export function steamGameNameToSymbol(
  name: string,
  steamAppId: number,
  maxLen: number,
): string {
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alphanumeric.length >= 3) {
    return alphanumeric.slice(0, maxLen);
  }
  return `G${steamAppId}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLen);
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}
