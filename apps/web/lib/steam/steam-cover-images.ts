/**
 * Steam client–style vertical library art (≈2:3). CDN pattern used by the Steam library grid.
 * Falls back to store API capsule/header URLs when a title has no library asset.
 */

const CLOUDFLARE_APP_BASE = "https://cdn.cloudflare.steamstatic.com/steam/apps";

/** Primary token / library image: 600×900 portrait capsule. */
export function steamLibraryCapsuleUrl(appId: number): string {
  return `${CLOUDFLARE_APP_BASE}/${appId}/library_600x900.jpg`;
}

export function steamLibraryCapsule2xUrl(appId: number): string {
  return `${CLOUDFLARE_APP_BASE}/${appId}/library_600x900_2x.jpg`;
}

export type FetchedSteamImage = {
  bytes: Buffer;
  contentType: string;
  filename: string;
  source: "library_600x900" | "library_600x900_2x" | "capsule" | "header";
};

async function fetchImageFromUrl(
  url: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) return null;
  return { bytes, contentType: type };
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "bin";
}

/**
 * Download the best vertical cover for IPFS: library portrait first, then store capsule/header.
 */
export async function fetchSteamCoverForPinning(
  appId: number,
  fallbacks: { capsule: string | null; header: string | null },
): Promise<FetchedSteamImage> {
  const tries: { url: string; source: FetchedSteamImage["source"]; filename: string }[] = [
    { url: steamLibraryCapsuleUrl(appId), source: "library_600x900", filename: `steam-${appId}-library.jpg` },
    {
      url: steamLibraryCapsule2xUrl(appId),
      source: "library_600x900_2x",
      filename: `steam-${appId}-library-2x.jpg`,
    },
  ];
  if (fallbacks.capsule) {
    tries.push({
      url: fallbacks.capsule,
      source: "capsule",
      filename: `steam-${appId}-capsule.${extFromUrl(fallbacks.capsule)}`,
    });
  }
  if (fallbacks.header) {
    tries.push({
      url: fallbacks.header,
      source: "header",
      filename: `steam-${appId}-header.${extFromUrl(fallbacks.header)}`,
    });
  }

  for (const t of tries) {
    const got = await fetchImageFromUrl(t.url);
    if (!got) continue;
    return {
      bytes: got.bytes,
      contentType: got.contentType,
      filename: t.filename,
      source: t.source,
    };
  }

  throw new Error(
    "Could not download any Steam cover image (library 600×900, capsule, or header).",
  );
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".png")) return "png";
    if (path.endsWith(".webp")) return "webp";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "jpg";
  } catch {
    /* ignore */
  }
  return "jpg";
}
