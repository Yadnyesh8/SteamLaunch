/**
 * Lists Steamworks app IDs tied to your publisher Web API key.
 * @see https://partner.steamgames.com/doc/webapi/isteamapps (GetPartnerAppListForWebAPIKey v2)
 */

export type PartnerAppEntry = {
  appid: number;
  app_type: string;
  app_name: string;
};

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * @param typeFilter Optional comma-separated: game, application, tool, demo, dlc, music (Valve docs).
 */
export async function fetchPartnerAppListForWebApiKey(
  webApiKey: string,
  options?: { typeFilter?: string },
): Promise<PartnerAppEntry[]> {
  const url = new URL(
    "https://partner.steam-api.com/ISteamApps/GetPartnerAppListForWebAPIKey/v2/",
  );
  url.searchParams.set("key", webApiKey);
  url.searchParams.set("format", "json");
  const tf = options?.typeFilter?.trim();
  if (tf) url.searchParams.set("type_filter", tf);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      raw && typeof raw === "object" && "message" in raw
        ? String((raw as { message: unknown }).message)
        : `GetPartnerAppListForWebAPIKey HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (!raw || typeof raw !== "object") return [];

  const applist = (raw as Record<string, unknown>).applist;
  if (!applist || typeof applist !== "object") return [];

  const apps = (applist as Record<string, unknown>).apps;
  if (!apps || typeof apps !== "object") return [];

  const appField = (apps as Record<string, unknown>).app;
  const rows = asArray(appField as Record<string, unknown> | Record<string, unknown>[] | undefined);

  const out: PartnerAppEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const appid = typeof r.appid === "number" ? r.appid : Number(r.appid);
    if (!Number.isInteger(appid) || appid <= 0) continue;
    const app_type = typeof r.app_type === "string" ? r.app_type : "unknown";
    const app_name = typeof r.app_name === "string" ? r.app_name : `App ${appid}`;
    out.push({ appid, app_type, app_name });
  }

  out.sort((a, b) => a.app_name.localeCompare(b.app_name, undefined, { sensitivity: "base" }));
  return out;
}
