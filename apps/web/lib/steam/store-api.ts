/**
 * Steam Store front-end JSON APIs (unofficial but widely used).
 * Rate limits apply — cache in DB and avoid hammering.
 *
 * Search: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI#storesearch
 * Details: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI#appdetails
 */

export type SteamStoreSearchItem = {
  type: string;
  name: string;
  id: number;
  tiny_image?: string;
  platforms?: Record<string, boolean>;
};

export type SteamStoreSearchResponse = {
  total: number;
  items: SteamStoreSearchItem[];
};

export type SteamAppDetailsData = {
  type?: string;
  name?: string;
  steam_appid?: number;
  /** Long store description (HTML); preferred for token metadata when present. */
  detailed_description?: string;
  short_description?: string;
  header_image?: string;
  capsule_image?: string;
  capsule_imagev5?: string;
  screenshots?: { path_full?: string; path_thumbnail?: string }[];
  background?: string;
  background_raw?: string;
};

function storeBaseParams(): { cc: string; l: string } {
  return {
    cc: process.env.STEAM_STORE_CC ?? "US",
    l: process.env.STEAM_STORE_LANG ?? "en",
  };
}

export async function steamStoreSearch(term: string): Promise<SteamStoreSearchResponse> {
  const { cc, l } = storeBaseParams();
  const u = new URL("https://store.steampowered.com/api/storesearch/");
  u.searchParams.set("term", term);
  u.searchParams.set("cc", cc);
  u.searchParams.set("l", l);

  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Steam storesearch HTTP ${res.status}`);
  }

  const body = (await res.json()) as SteamStoreSearchResponse;
  const items = (body.items ?? []).filter((i) => i.type === "app");
  return { total: body.total ?? items.length, items };
}

/**
 * `filters=basic` returns name, short_description, header/capsule images, etc.
 * @see https://partner.steamgames.com is unrelated — this is the public store API.
 */
export async function steamAppDetails(appId: number): Promise<SteamAppDetailsData | null> {
  const { l } = storeBaseParams();
  const u = new URL("https://store.steampowered.com/api/appdetails");
  u.searchParams.set("appids", String(appId));
  u.searchParams.set("l", l);
  // Omit `filters` so we get `detailed_description` (and images) for token metadata.

  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Steam appdetails HTTP ${res.status}`);
  }

  const json = (await res.json()) as Record<
    string,
    { success?: boolean; data?: SteamAppDetailsData | [] }
  >;
  const entry = json[String(appId)];
  if (!entry?.success || !entry.data || Array.isArray(entry.data)) {
    return null;
  }
  return entry.data;
}
